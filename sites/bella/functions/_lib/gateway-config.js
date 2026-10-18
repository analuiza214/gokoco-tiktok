/** Configuração de gateways — Supabase (tabela payment_gateways) com fallback padrão. */

const DEFAULT_GATEWAYS = [
  { id: "ironpay", name: "IronPay", method: "pix", enabled: false },
  { id: "masterfy", name: "MasterFy", method: "pix", enabled: false },
  { id: "umbrellapag", name: "UmbrellaPag", method: "pix", enabled: false },
  { id: "venuspay", name: "Venus Pay", method: "card", enabled: true },
  { id: "venuspay_pix", name: "Venus Pay", method: "pix", enabled: false },
];

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function supabaseFetch(env, path, options = {}) {
  const url = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Banco de gateways não configurado.");

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...supabaseHeaders(key), ...(options.headers || {}) },
  });

  if (!res.ok) throw new Error("Não foi possível consultar a configuração dos gateways.");
  try {
    return await res.json();
  } catch {
    throw new Error("Resposta inválida ao consultar gateways.");
  }
}

export function gatewayConfigured(env, id) {
  if (id === "ironpay") {
    return [env.IRONPAY_API_TOKEN, env.IRONPAY_OFFER_HASH, env.IRONPAY_PRODUCT_HASH]
      .every((value) => String(value || "").trim());
  }
  if (id === "masterfy") {
    return !!String(env.MASTERFY_API_KEY || "").trim();
  }
  if (id === "umbrellapag") {
    return !!String(env.UMBRELLAPAG_API_KEY || "").trim();
  }
  // Cartão e PIX da Venus Pay usam a mesma credencial
  if (id === "venuspay" || id === "venuspay_pix") {
    return !!String(env.VENUS_PAY_SECRET_KEY || "").trim();
  }
  return false;
}

export async function listGateways(env) {
  const rows = await supabaseFetch(env, "/rest/v1/payment_gateways?select=id,name,method,enabled,updated_at&order=method,id");
  const saved = Array.isArray(rows) ? rows : [];
  const savedById = new Map(saved.map((gateway) => [gateway.id, gateway]));
  const source = DEFAULT_GATEWAYS.map((gateway) => ({
    ...gateway,
    ...(savedById.get(gateway.id) || {}),
  }));

  return source.map((g) => ({
    id: g.id,
    name: g.name,
    method: g.method,
    enabled: !!g.enabled,
    configured: gatewayConfigured(env, g.id),
    updated_at: g.updated_at || null,
  }));
}

export async function getActivePixGateway(env) {
  const gateways = await listGateways(env);
  const active = gateways.filter((g) => g.method === "pix" && g.enabled);
  if (active.length > 1) throw new Error("Mais de um gateway PIX ativo. Salve novamente a escolha no painel.");
  if (!active.length) return null;
  if (!active[0].configured) throw new Error("O gateway PIX selecionado está sem credenciais completas.");
  return active[0].id;
}

export async function setGatewayEnabled(env, id, enabled) {
  const url = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  const all = await listGateways(env);
  const target = all.find((g) => g.id === id);
  if (!target) throw new Error("Gateway não encontrado.");

  const headers = supabaseHeaders(key);

  if (enabled && target.method === "pix") {
    const otherPix = all.filter((g) => g.method === "pix" && g.id !== id && g.enabled);
    for (const g of otherPix) {
      const disabled = await fetch(`${url}/rest/v1/payment_gateways?id=eq.${encodeURIComponent(g.id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
      });
      if (!disabled.ok) throw new Error("Não foi possível desativar o gateway anterior.");
    }
  }

  const res = await fetch(`${url}/rest/v1/payment_gateways?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id, name: target.name, method: target.method, enabled: !!enabled, updated_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || "Erro ao atualizar gateway.");
  }

  const saved = await res.json();
  if (!Array.isArray(saved) || !saved.some((g) => g.id === id && g.enabled === !!enabled)) {
    throw new Error("A configuração do gateway não foi salva.");
  }
  return listGateways(env);
}
