import { sendUtmifyOrder } from "./utmify.js";
import { sendFacebookPurchase } from "./facebook.js";

function config(env) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, key };
}

async function supabaseRequest(env, path, options = {}) {
  const { url, key } = config(env);
  if (!url || !key) throw new Error("Supabase do servidor não configurado.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
  return response;
}

const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck", "gclid", "fbclid", "ttclid", "fbc", "fbp"];

function trackingValues(tracking) {
  const source = tracking && typeof tracking === "object" ? tracking : {};
  return Object.fromEntries(TRACKING_KEYS.map((key) => [key, source[key] || null]));
}

function hasAttribution(tracking) {
  return TRACKING_KEYS.some((key) => Boolean(tracking?.[key]));
}

async function previousCustomerTracking(env, body) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const candidates = [];
  const filters = [];
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  if (email) filters.push(`email=ilike.${encodeURIComponent(email)}`);
  if (phone) filters.push(`telefone=eq.${encodeURIComponent(phone)}`);

  for (const filter of filters) {
    const response = await supabaseRequest(
      env,
      `leads?${filter}&created_at=gte.${encodeURIComponent(since)}&select=tracking,created_at&order=created_at.desc&limit=5`,
    );
    const rows = await response.json();
    if (Array.isArray(rows)) candidates.push(...rows);
  }
  return candidates
    .filter((row) => hasAttribution(row?.tracking))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.tracking || null;
}

async function resolveLeadTracking(env, body) {
  const current = trackingValues(body.tracking);
  let previous = null;
  try { previous = await previousCustomerTracking(env, body); }
  catch (error) { console.warn("[leads] Falha ao consultar atribuição anterior:", error?.message); }
  const prior = trackingValues(previous);
  const effective = hasAttribution(current) ? current : (hasAttribution(prior) ? prior : current);
  return {
    ...effective,
    first_touch: hasAttribution(prior) ? prior : effective,
    last_touch: hasAttribution(current) ? current : null,
    attribution_source: hasAttribution(current) ? "current_visit" : (hasAttribution(prior) ? "recovered_customer_history" : "unattributed"),
    recovered_via_whatsapp: !hasAttribution(current) && hasAttribution(prior),
    attribution_window_days: 30,
  };
}

function leadRow(body, method, tracking) {
  const address = body.address || {};
  return {
    nome: String(body.name || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    telefone: String(body.phone || "").trim(),
    produtos: String(body.products || body.productName || "Pedido"),
    valor: Number(body.amount),
    metodo_pagamento: method,
    status: "checkout_iniciado",
    card_encriptado: body.cardEncrypted || null,
    ga_client_id: body.ga_client_id || null,
    purchase_sent: false,
    tracking,
    cidade: address.city || address.cidade || null,
    estado: address.state || address.estado || null,
    cep: String(address.zipCode || address.cep || "").replace(/\D/g, "") || null,
    rua: address.street || address.rua || null,
    numero: address.number || address.numero || null,
    complemento: address.complement || address.complemento || null,
    bairro: address.neighborhood || address.bairro || address.district || null,
  };
}

export async function createCheckoutLead(env, body, method) {
  const tracking = await resolveLeadTracking(env, body);
  const response = await supabaseRequest(env, "leads?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(leadRow(body, method, tracking)),
  });
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("Supabase não retornou o pedido criado.");
  return { id: String(rows[0].id), tracking };
}

export async function updateLeadById(env, leadId, changes) {
  if (!leadId) return false;
  const response = await supabaseRequest(env, `leads?id=eq.${encodeURIComponent(leadId)}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
  });
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function getLeadById(env, leadId) {
  if (!leadId) return null;
  const response = await supabaseRequest(
    env,
    `leads?id=eq.${encodeURIComponent(leadId)}&select=id,valor,produtos,metodo_pagamento,status&limit=1`,
  );
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function savePixLead(env, body, result, gateway) {
  if (!body.orderId) throw new Error("Pedido interno não informado.");
  const saved = await updateLeadById(env, body.orderId, {
    status: "pix_gerado",
    transaction_id: result.transactionId,
    gateway: gateway || result.gateway || null,
  });
  if (!saved) throw new Error("O pedido interno não foi encontrado.");
  return true;
}

export async function updatePixLeadStatus(env, transactionId, status) {
  if (!transactionId) return false;
  const response = await supabaseRequest(env, `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function listPendingPixLeads(env, limit = 50) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const response = await supabaseRequest(
    env,
    `leads?produtos=ilike.*Escova*&metodo_pagamento=eq.pix&status=in.(checkout_iniciado,pix_gerado)&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&select=id,transaction_id,gateway,status&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`,
  );
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function trackingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `BM${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

async function registerTrackingOrigin(env, code, name) {
  await supabaseRequest(env, "rastreio_origem?on_conflict=codigo", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ codigo: code, origem_at: new Date().toISOString(), nome_cliente: name || null }),
  });
}

async function sendPaidAttribution(env, transactionId, paidAt, paymentMethod = "pix") {
  const response = await supabaseRequest(
    env,
    `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&purchase_sent=eq.false&select=id,transaction_id,nome,email,telefone,cpf,produtos,valor,tracking,created_at`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ purchase_sent: true, updated_at: new Date().toISOString() }),
    },
  );
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return { alreadySent: true };
  const lead = rows[0];
  try {
    const orderPayload = {
      orderId: lead.transaction_id || lead.id,
      status: "paid",
      paymentMethod,
      customerName: lead.nome,
      customerEmail: lead.email,
      customerPhone: String(lead.telefone || "").replace(/\D/g, ""),
      customerDocument: lead.cpf ? String(lead.cpf).replace(/\D/g, "") : null,
      productName: lead.produtos,
      valueInCents: Math.round(Number(lead.valor || 0) * 100),
      tracking: lead.tracking,
      createdAt: lead.created_at,
      paidAt,
    };
    const names = String(lead.nome || "").trim().split(/\s+/);
    await Promise.all([
      sendUtmifyOrder(env, orderPayload),
      sendFacebookPurchase(env, {
        event_id: `${lead.transaction_id || lead.id}_purchase`,
        user_data: {
          em: [lead.email],
          ph: [String(lead.telefone || "").replace(/\D/g, "")],
          fn: [names[0] || ""],
          ln: [names.slice(1).join(" ")],
          fbc: lead.tracking?.fbc || undefined,
          fbp: lead.tracking?.fbp || undefined,
        },
        custom_data: {
          value: Number(lead.valor || 0),
          currency: "BRL",
          content_name: lead.produtos,
          content_type: "product",
        },
      }),
    ]);
    return { sent: true };
  } catch (error) {
    await supabaseRequest(env, `leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ purchase_sent: false, updated_at: new Date().toISOString() }),
    });
    console.error("[leads] Pagamento confirmado, mas envio à UTMify falhou:", error?.message);
    return { sent: false, retryRequired: true };
  }
}

export async function fulfillPaidLead(env, transactionId, paidAt, paymentMethod = "pix") {
  const code = trackingCode();
  const response = await supabaseRequest(
    env,
    `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&codigo_rastreio=is.null&select=id,nome,email`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "pago", codigo_rastreio: code, updated_at: new Date().toISOString() }),
    },
  );
  const claimed = await response.json();
  await updatePixLeadStatus(env, transactionId, "pago");

  let email = { alreadySent: true };
  if (Array.isArray(claimed) && claimed.length > 0) {
    const lead = claimed[0];
    try {
      await registerTrackingOrigin(env, code, lead.nome);
      const siteUrl = String(env.SITE_URL || "").trim().replace(/\/+$/, "");
      if (!siteUrl) throw new Error("SITE_URL não configurada.");
      const mail = await fetch(`${siteUrl}/api/send-tracking-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailCliente: lead.email, nomeCliente: lead.nome, codigoRastreio: code, numeroPedido: lead.id }),
      });
      if (!mail.ok) throw new Error(`Envio de rastreio respondeu ${mail.status}.`);
      email = { sent: true, trackingCode: code };
    } catch (error) {
      await supabaseRequest(env, `leads?id=eq.${encodeURIComponent(lead.id)}&codigo_rastreio=eq.${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ codigo_rastreio: null, updated_at: new Date().toISOString() }),
      });
      console.error("[leads] Pagamento confirmado, mas envio do rastreio falhou:", error?.message);
      email = { sent: false, retryRequired: true };
    }
  }
  const attribution = await sendPaidAttribution(env, transactionId, paidAt || new Date().toISOString(), paymentMethod);
  return { paid: true, email, attribution };
}

export async function fulfillPaidPixLead(env, transactionId, paidAt) {
  return fulfillPaidLead(env, transactionId, paidAt, "pix");
}
