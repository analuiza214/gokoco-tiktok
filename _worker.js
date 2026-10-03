// Gerado por build-worker.mjs. Edite worker-src/.

const { createPixIronpay, statusPixIronpay } = (() => {
// Provider PIX — IronPay
// API: https://api.ironpayapp.com.br/api/public/v1/transactions
// Variáveis de ambiente (Cloudflare Pages):
//   IRONPAY_API_TOKEN, IRONPAY_OFFER_HASH, IRONPAY_PRODUCT_HASH

/**
 * Gera um CPF válido aleatório (dígitos verificadores corretos).
 * Usado quando o cliente não fornece CPF.
 */
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let sum = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((sum * 10) % 11) % 10);
  sum = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((sum * 10) % 11) % 10);
  return d.join("");
}

async function createPixIronpay(context, corsHeaders, body) {
  const { env } = context;

  // ── Credenciais IronPay ──────────────────────────────────────────────────────
  const apiToken = env.IRONPAY_API_TOKEN;
  const offerHash = env.IRONPAY_OFFER_HASH;
  const productHash = env.IRONPAY_PRODUCT_HASH;

  if (!apiToken || !offerHash || !productHash) {
    return new Response(JSON.stringify({ error: "Gateway de pagamento nao configurado." }), { status: 500, headers: corsHeaders });
  }

  const { amount, name, document, productName, email, phone } = body;

  if (!amount || !name) {
    return new Response(JSON.stringify({ error: "Campos obrigatorios: amount, name." }), { status: 400, headers: corsHeaders });
  }

  // ── CPF: usa o informado (se válido) ou gera automaticamente ────────────────
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const payerDocument = [11, 14].includes(cpfDigits.length) ? cpfDigits : "";

  // ── URL do webhook (IronPay chama /api/pix/webhook quando o PIX é pago) ─────
  const siteUrl = env.SITE_URL || "";
  const webhookUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : undefined;

  // ── Valor em centavos ────────────────────────────────────────────────────────
  const amountInCents = Math.round(Number(amount) * 100);

  const payload = {
    amount: amountInCents,
    offer_hash: offerHash,
    payment_method: "pix",
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      phone_number: phone ? String(phone).replace(/\D/g, "") || "00000000000" : "00000000000",
      document: payerDocument,
    },
    cart: [
      {
        product_hash: productHash,
        title: productName || "Kit Escova Secadora 7 em 1",
        cover: null,
        price: amountInCents,
        quantity: 1,
        operation_type: 1,
        tangible: true,
      },
    ],
    expire_in_days: 1,
    transaction_origin: "api",
    ...(webhookUrl ? { postback_url: webhookUrl } : {}),
  };

  // ── Chamada à API IronPay ───────────────────────────────────────────────────
  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${encodeURIComponent(apiToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }), { status: 502, headers: corsHeaders });
    }

    const transactionId = data.hash || data.transaction_hash;

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Resposta invalida do gateway: hash ausente.", rawResponse: data }), { status: 502, headers: corsHeaders });
    }

    // ── Extração do QR Code / copia-e-cola ────────────────────────────────────
    const pix = data.pix || {};
    const pixCode = pix.pix_qr_code || pix.qr_code || pix.code || pix.copy_paste || null;
    const qrCodeBase64 = pix.qr_code_base64 || pix.base64 || null;
    const qrCodeImage = pixCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
      : pix.pix_url || null;

    if (!pixCode) {
      return new Response(JSON.stringify({ error: "QR Code PIX nao gerado.", rawResponse: data }), { status: 502, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "ironpay",
        status: data.payment_status || "PENDENTE",
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage: qrCodeImage || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro de comunicacao com o gateway." }), { status: 502, headers: corsHeaders });
  }
}

async function statusPixIronpay(context, corsHeaders, transactionId) {
  const { env } = context;
  const apiToken = env.IRONPAY_API_TOKEN;

  if (!apiToken) {
    return new Response(JSON.stringify({ error: "Gateway nao configurado" }), { status: 500, headers: corsHeaders });
  }

  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions/${encodeURIComponent(transactionId)}?api_token=${encodeURIComponent(apiToken)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar gateway.", details: data }), { status: 502, headers: corsHeaders });
    }

    // IronPay usa: PAID | PENDING | CANCELED | REFUNDED
    const rawStatus = (data.payment_status || data.status || "").toUpperCase();
    const isPaid = rawStatus === "PAID";
    const isExpired = rawStatus === "CANCELED" || rawStatus === "REFUNDED";

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "ironpay",
        status: rawStatus.toLowerCase(),
        isPaid,
        isExpired,
        payedAt: data.paid_at || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao consultar status do pagamento." }), { status: 502, headers: corsHeaders });
  }
}


return { createPixIronpay, statusPixIronpay };
})();

const { createPixMasterfy, statusPixMasterfy } = (() => {
// Provider PIX — MasterFy Pagamentos
// API: https://api.masterfypagamentos.com/v1/payment
// Variável de ambiente (Cloudflare Pages):
//   MASTERFY_API_KEY  ← chave Bearer da sua conta MasterFy
//
// Rate limiting fica em /api/pix/create.js (compartilhado entre todos os gateways PIX).

/**
 * Gera um CPF válido aleatório (dígitos verificadores corretos).
 * Usado quando o cliente não fornece CPF — a MasterFy exige taxId para BRL.
 */
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((s1 * 10) % 11) % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((s2 * 10) % 11) % 10);
  return d.join("");
}

async function createPixMasterfy(context, corsHeaders, body) {
  const { env } = context;

  // ── Variável de ambiente obrigatória ────────────────────────────────────────
  const apiKey = env.MASTERFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento não configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders }
    );
  }

  const { amount, name, email, phone, productName, address, document } = body;

  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigatórios: amount, name." }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── CPF: usa o informado (se válido) ou gera automaticamente ────────────────
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = [11, 14].includes(cpfDigits.length) ? cpfDigits : "";

  // ── URL do webhook (MasterFy chama /api/pix/webhook quando o PIX é pago) ────
  const siteUrl = env.SITE_URL || "";
  const notificationUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : undefined;

  // ── Valor em centavos ────────────────────────────────────────────────────────
  const amountInCents = Math.round(Number(amount) * 100);

  // ── Endereço de entrega (obrigatório para produtos PHYSICAL) ─────────────────
  const hasAddress = address && address.street && address.city;
  const delivery = hasAddress
    ? {
        fee: 0,
        address: {
          street: String(address.street),
          number: String(address.number || "S/N"),
          complement: String(address.complement || ""),
          district: String(address.neighborhood || address.district || ""),
          city: String(address.city),
          state: String(address.state || ""),
          zipCode: String(address.zipCode || address.cep || "").replace(/\D/g, ""),
          country: "BR",
        },
      }
    : undefined;

  // ── Payload MasterFy ─────────────────────────────────────────────────────────
  const payload = {
    amount: amountInCents,
    currency: "BRL",
    method: "PIX",
    description: productName || "Pedido",
    ...(notificationUrl ? { notificationUrl } : {}),
    payer: {
      name: String(name),
      taxId,
      email: email ? String(email) : "cliente@email.com",
      phone: phone ? String(phone).replace(/\D/g, "") || "00000000000" : "00000000000",
    },
    items: [
      {
        name: productName || "Pedido",
        quantity: 1,
        price: amountInCents,
        type: hasAddress ? "PHYSICAL" : "DIGITAL",
      },
    ],
    ...(delivery ? { delivery } : {}),
  };

  // ── Chamada à API MasterFy ───────────────────────────────────────────────────
  try {
    const res = await fetch("https://api.masterfypagamentos.com/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    // ── Extração do resultado ─────────────────────────────────────────────────
    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inválida do gateway: id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    const pixCode = (data.data && data.data.copypaste) || null;

    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX não gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "masterfy",
        status: data.status || "PENDING",
        pixCode,
        qrCodeBase64: null,
        qrCodeImage,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunicação com o gateway." }),
      { status: 502, headers: corsHeaders }
    );
  }
}

async function statusPixMasterfy(context, corsHeaders, transactionId) {
  const { env } = context;
  const apiKey = env.MASTERFY_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway não configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const res = await fetch(
      `https://api.masterfypagamentos.com/v1/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    // MasterFy usa: PENDING | PAID | CANCELLED | REFUNDED | EXPIRED
    const rawStatus = (data.status || "").toUpperCase();
    const isPaid = rawStatus === "PAID";
    const isExpired = rawStatus === "CANCELLED" || rawStatus === "EXPIRED" || rawStatus === "REFUNDED";

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "masterfy",
        status: rawStatus.toLowerCase(),
        isPaid,
        isExpired,
        payedAt: data.paidAt || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders }
    );
  }
}


return { createPixMasterfy, statusPixMasterfy };
})();

const { createPixUmbrellapag, statusPixUmbrellapag } = (() => {
// Provider PIX — UmbrellaPag (Liberpay)
// Documentação: https://docs.umbrellapag.com/
// API: POST /api/user/transactions  |  GET /api/user/transactions/{id}
// Base URL: https://api-gateway.umbrellapag.com/api
//
// Variável de ambiente (Cloudflare Pages):
//   UMBRELLAPAG_API_KEY  ← chave x-api-key da sua conta UmbrellaPag
//
// Headers obrigatórios em todas as chamadas:
//   x-api-key: {UMBRELLAPAG_API_KEY}
//   User-Agent: UMBRELLAB2B/1.0

const API_BASE = "https://api-gateway.umbrellapag.com/api";

function apiHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "User-Agent": "UMBRELLAB2B/1.0",
  };
}

/** Gera CPF válido aleatório quando o cliente não informa documento. */
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((s1 * 10) % 11) % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((s2 * 10) % 11) % 10);
  return d.join("");
}

/** Monta endereço no formato exigido pela UmbrellaPag. */
function buildAddress(address) {
  const hasStreet = address && address.street;
  return {
    street: hasStreet ? String(address.street) : "Rua Principal",
    streetNumber: String(address?.number || address?.streetNumber || "S/N"),
    complement: String(address?.complement || ""),
    zipCode: String(address?.zipCode || address?.cep || "01001000").replace(/\D/g, ""),
    neighborhood: String(address?.neighborhood || address?.district || "Centro"),
    city: String(address?.city || "Sao Paulo"),
    state: String(address?.state || "SP").slice(0, 2).toUpperCase(),
    country: "BR",
  };
}

/** Extrai o código copia-e-cola PIX da resposta da UmbrellaPag. */
function extractPixCode(data) {
  if (!data || typeof data !== "object") return null;

  if (typeof data.qrCode === "string" && data.qrCode.startsWith("00020")) {
    return data.qrCode;
  }

  const pix = data.pix;
  if (pix && typeof pix === "object") {
    const fromPix =
      pix.qrCode ||
      pix.copyPaste ||
      pix.copypaste ||
      pix.emv ||
      pix.code ||
      null;
    if (fromPix) return String(fromPix);
  }

  if (typeof data.qrCode === "string" && data.qrCode.length > 20) {
    return data.qrCode;
  }

  return null;
}

async function createPixUmbrellapag(context, corsHeaders, body) {
  const { request, env } = context;

  const apiKey = env.UMBRELLAPAG_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento não configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders }
    );
  }

  const { amount, name, email, phone, productName, address, document } = body;

  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigatórios: amount, name." }),
      { status: 400, headers: corsHeaders }
    );
  }

  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = [11, 14].includes(cpfDigits.length) ? cpfDigits : "";
  const amountInCents = Math.round(Number(amount) * 100);
  const customerAddress = buildAddress(address);
  const siteUrl = (env.SITE_URL || "").trim().replace(/\/+$/, "");
  const postbackUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : undefined;

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  const payload = {
    amount: amountInCents,
    currency: "BRL",
    paymentMethod: "PIX",
    installments: 1,
    ...(postbackUrl ? { postbackUrl } : {}),
    metadata: JSON.stringify({ source: "gokoco-tiktok", product: productName || "Pedido" }),
    traceable: true,
    ip: clientIp,
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      document: {
        number: taxId,
        type: "CPF",
      },
      phone: phone ? String(phone).replace(/\D/g, "") || "11999999999" : "11999999999",
      externalRef: email ? String(email) : taxId,
      address: customerAddress,
    },
    shipping: {
      fee: 0,
      address: customerAddress,
    },
    items: [
      {
        title: productName || "Pedido",
        unitPrice: amountInCents,
        quantity: 1,
        tangible: !!(address && address.street),
        externalRef: "item-1",
      },
    ],
    pix: {
      expiresInDays: 1,
    },
  };

  try {
    const res = await fetch(`${API_BASE}/user/transactions`, {
      method: "POST",
      headers: apiHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    const data = json.data || json;

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: json }),
        { status: 502, headers: corsHeaders }
      );
    }

    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inválida do gateway: id ausente.", rawResponse: json }),
        { status: 502, headers: corsHeaders }
      );
    }

    const pixCode = extractPixCode(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX não gerado.", rawResponse: json }),
        { status: 502, headers: corsHeaders }
      );
    }

    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "umbrellapag",
        status: (data.status || "WAITING_PAYMENT").toLowerCase(),
        pixCode,
        qrCodeBase64: null,
        qrCodeImage,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunicação com o gateway." }),
      { status: 502, headers: corsHeaders }
    );
  }
}

async function statusPixUmbrellapag(context, corsHeaders, transactionId) {
  const { env } = context;
  const apiKey = env.UMBRELLAPAG_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway não configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const res = await fetch(
      `${API_BASE}/user/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: apiHeaders(apiKey),
      }
    );

    const json = await res.json();
    const data = json.data || json;

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: json }),
        { status: 502, headers: corsHeaders }
      );
    }

    // UmbrellaPag: WAITING_PAYMENT | PROCESSING | PAID | CANCELED | REFUSED | REFUNDED | ...
    const rawStatus = String(data.status || "").toUpperCase();
    const isPaid = rawStatus === "PAID" || rawStatus === "AUTHORIZED";
    const isExpired =
      rawStatus === "CANCELED" ||
      rawStatus === "REFUSED" ||
      rawStatus === "REFUNDED" ||
      rawStatus === "CHARGEDBACK";

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "umbrellapag",
        status: rawStatus.toLowerCase(),
        isPaid,
        isExpired,
        payedAt: data.paidAt || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders }
    );
  }
}


return { createPixUmbrellapag, statusPixUmbrellapag };
})();

const { createPixVenuspay, statusPixVenuspay } = (() => {
// Provider PIX — VenusPay
// Documentação: https://venuspay.com.br/docs
//
// Criar cobrança:  POST https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment
// Consultar status: GET  https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/check-payment-status?transaction_id={UUID}
//
// É o MESMO endpoint e a MESMA credencial do cartão (VENUS_PAY_SECRET_KEY);
// muda apenas o payment_method. No painel admin o id deste gateway é
// "venuspay_pix", enquanto "venuspay" continua sendo o cartão.
//
// Variável de ambiente (Cloudflare Pages):
//   VENUS_PAY_SECRET_KEY  ← mesma chave sk_live_... já usada no cartão
//
// Atenção ao payload: no PIX a VenusPay espera os campos do cliente SOLTOS na
// raiz (amount, name, email, document, phone) — não dentro de "customer" como
// no cartão. Ver "Criar Pagamento PIX" na documentação.
//
// O webhook NÃO é enviado por requisição (não existe postback_url): a URL é
// cadastrada uma vez em Dashboard → API → Webhooks no painel da VenusPay.
//
// Rate limiting fica em /api/pix/create.js (compartilhado entre todos os PIX).

const CREATE_URL =
  "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment";
const STATUS_URL =
  "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/check-payment-status";

/** Limites de valor exigidos pela VenusPay (em reais). */
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 1000000;

/** Gera CPF válido aleatório quando o cliente não informa documento. */
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  const s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((s1 * 10) % 11) % 10);
  const s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((s2 * 10) % 11) % 10);
  return d.join("");
}

/**
 * Código copia-e-cola PIX (string EMV).
 * Campo documentado: pix_copy_paste. Os outros nomes são só segurança extra.
 */
function extractPixCode(data) {
  const candidatos = [
    data.pix_copy_paste,
    data.pixCopyPaste,
    data.pix_code,
    data.qr_code,
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 20) return c;
  }
  return null;
}

/**
 * Imagem PNG do QR Code em base64 (a VenusPay já devolve como data URI,
 * pronta para usar em <img src="...">).
 */
function extractQrImage(data) {
  const candidatos = [
    data.qr_code_base64,
    data.pix_qr_code_base64,
    data.qrCodeBase64,
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 40) return c;
  }
  return null;
}

async function createPixVenuspay(context, corsHeaders, body) {
  const { env } = context;

  // ── Credencial obrigatória (a mesma do cartão) ──────────────────────────────
  const secretKey = env.VENUS_PAY_SECRET_KEY;
  if (!secretKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento não configurado. Configure VENUS_PAY_SECRET_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders }
    );
  }

  const { amount, name, email, phone, productName, address, document } = body;

  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigatórios: amount, name." }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── Valor: BRL decimal (R$ 29,90 = 29.90), NÃO centavos ────────────────────
  const amountDecimal = Number(Number(amount).toFixed(2));

  if (amountDecimal < MIN_AMOUNT || amountDecimal > MAX_AMOUNT) {
    return new Response(
      JSON.stringify({ error: `A VenusPay aceita PIX de R$ ${MIN_AMOUNT},00 até R$ ${MAX_AMOUNT.toLocaleString("pt-BR")},00.` }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── CPF: usa o informado (se válido) ou gera automaticamente ────────────────
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const cpfFinal = [11, 14].includes(cpfDigits.length) ? cpfDigits : "";

  // ── Payload conforme "Criar Pagamento PIX": campos na raiz ─────────────────
  const payload = {
    amount: amountDecimal,
    payment_method: "pix",
    name: String(name),
    email: email ? String(email) : "cliente@email.com",
    document: cpfFinal,
    phone: phone ? String(phone).replace(/\D/g, "") || "11999999999" : "11999999999",
    description: productName || "Pedido",
    ...(env.VENUS_PAY_PRODUCT_ID ? { product_id: env.VENUS_PAY_PRODUCT_ID } : {}),
    // metadata volta no webhook — serve para casar o pagamento com o pedido
    metadata: {
      source: "gokoco-tiktok",
      customer_name: String(name),
      city: address?.city || "",
      state: address?.state || "",
    },
  };

  // ── Chamada à API VenusPay ─────────────────────────────────────────────────
  try {
    const res = await fetch(CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A documentação aceita x-api-key OU Authorization: Bearer.
        // Usamos Bearer para ficar igual à integração de cartão já em produção.
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log(JSON.stringify({
      event: "VENUSPAY_PIX_RESPONSE",
      httpStatus: res.status,
      success: data.success,
      status: data.status,
      gateway: data.gateway || null,
      errors: data.error || null,
    }));

    if (!res.ok || data.success === false) {
      return new Response(
        JSON.stringify({
          error: Array.isArray(data.error?.message)
            ? data.error.message.join(", ")
            : typeof data.error === "string"
              ? data.error
              : Array.isArray(data.message)
                ? data.message.join(", ")
                : typeof data.message === "string"
                  ? data.message
                  : "Erro ao gerar PIX. Confira seus dados e tente novamente.",
          details: data,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const transactionId = data.transaction_id || null;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inválida do gateway: transaction_id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    const pixCode = extractPixCode(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX não gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    // A VenusPay sempre devolve a imagem em base64; o link do qrserver fica
    // apenas como reserva caso algum dia venha vazia.
    const qrCodeBase64 = extractQrImage(data);
    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "venuspay_pix",
        status: String(data.status || "pending").toLowerCase(),
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage,
        expiresAt: data.expiration_date || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunicação com o gateway." }),
      { status: 502, headers: corsHeaders }
    );
  }
}

/**
 * Consulta o status da transação.
 * Endpoint público (não pede chave) — é o mesmo que o checkout da VenusPay usa.
 * Statuses: pending | approved | failed | expired | refunded | chargeback
 */
async function statusPixVenuspay(context, corsHeaders, transactionId) {
  try {
    const res = await fetch(
      `${STATUS_URL}?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );

    const data = await res.json();

    // 404 = transação ainda não visível na VenusPay. Responde "pending" para o
    // site continuar aguardando em vez de mostrar erro na tela do cliente.
    if (res.status === 404) {
      return new Response(
        JSON.stringify({ transactionId, gateway: "venuspay_pix", status: "pending", isPaid: false, isExpired: false, payedAt: null }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: data }),
        { status: 502, headers: corsHeaders }
      );
    }

    const rawStatus = String(data.status || "pending").toLowerCase();
    const isPaid = rawStatus === "approved";
    const isExpired =
      rawStatus === "expired" ||
      rawStatus === "failed" ||
      rawStatus === "refunded" ||
      rawStatus === "chargeback";

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "venuspay_pix",
        status: rawStatus,
        isPaid,
        isExpired,
        payedAt: isPaid ? data.paid_at || data.created_at || null : null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders }
    );
  }
}


return { createPixVenuspay, statusPixVenuspay };
})();

const { queryPixGatewayStatus } = (() => {

const headers = { "Content-Type": "application/json" };

async function queryPixGatewayStatus(env, transactionId, gateway) {
  let response;
  const context = { env };
  if (gateway === "masterfy") response = await statusPixMasterfy(context, headers, transactionId);
  else if (gateway === "umbrellapag") response = await statusPixUmbrellapag(context, headers, transactionId);
  else if (gateway === "venuspay_pix") response = await statusPixVenuspay(context, headers, transactionId);
  else response = await statusPixIronpay(context, headers, transactionId);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Gateway respondeu ${response.status}.`);
  const normalized = String(data.status || "").trim().toLowerCase();
  const isRefunded = Boolean(data.isRefunded) || ["refunded", "refund", "reembolsado", "reembolsada"].includes(normalized);
  return {
    ...data,
    status: normalized,
    isPaid: Boolean(data.isPaid) || ["paid", "approved", "pago"].includes(normalized),
    isRefunded,
    isExpired: !isRefunded && (Boolean(data.isExpired) || ["expired", "cancelled", "canceled"].includes(normalized)),
    paidAt: data.paidAt || data.payedAt || null,
  };
}

return { queryPixGatewayStatus };
})();

const { verifyAdminToken } = (() => {
/** Valida token Bearer emitido por /api/admin-login (mesmo formato de admin-verify). */

async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyAdminToken(request, env) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) return { valid: false, error: "Servidor não configurado." };

  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return { valid: false, error: "Não autorizado." };

  const dot = token.lastIndexOf(".");
  if (dot === -1) return { valid: false, error: "Token inválido." };

  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = await hmacSign(payloadB64, secret);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: "Token inválido." };
  }

  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return { valid: false, error: "Token inválido." };
  }

  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: "Sessão expirada." };
  }

  return { valid: true };
}

return { verifyAdminToken };
})();

const { capturePurchaseTracking, purchaseDestination, purchaseSummary, deliverPaidPurchase } = (() => {
// Adaptado do envio de pedidos pagos da loja Top Mix.
// O estado de envio usa o JSON tracking existente; não exige migração do banco.
const ATTRIBUTION_KEYS = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
const text = (value, limit = 500) => typeof value === 'string' ? value.slice(0, limit) : '';
const utc = (value) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

function capturePurchaseTracking(request, body) {
  const tracking = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, text(body.tracking?.[key]) || null]));
  const fb = body.fb || {};
  const fbp = text(fb.fbp, 200);
  const fbc = text(fb.fbc, 300);
  const origin = new URL(request.url).origin;
  let sourceUrl = `${origin}/pagamento`;
  try { const url = new URL(body.tracking?.event_source_url); if (url.origin === origin) sourceUrl = url.href.slice(0, 2000); } catch {}
  tracking._browser = {
    fbp: /^fb\.\d+\.\d+\./.test(fbp) ? fbp : null,
    fbc: /^fb\.\d+\.\d+\./.test(fbc) ? fbc : (tracking.fbclid ? `fb.1.${Date.now()}.${tracking.fbclid}` : null),
    ip: request.headers.get('CF-Connecting-IP') || null,
    user_agent: request.headers.get('User-Agent') || null,
    source_url: sourceUrl,
  };
  return tracking;
}

function purchaseDestination(env) {
  const mode = String(env.PURCHASE_DELIVERY_MODE || 'auto').trim().toLowerCase();
  if (mode === 'utmify') return 'utmify';
  if (mode === 'meta') return 'meta';
  if (mode !== 'auto') return null;
  if (String(env.UTMIFY_API_TOKEN || '').trim()) return 'utmify';
  if (String(env.FB_ACCESS_TOKEN || '').trim()) return 'meta';
  return null;
}

function purchaseSummary(env, order) {
  const destination = purchaseDestination(env);
  const state = destination ? order.tracking?._purchase?.[destination] : null;
  return {
    destination,
    state: destination ? state?.state || 'pending' : 'not_configured',
    sent_at: state?.sent_at || null,
    error: state?.error || null,
    event_id: `pix_${order.id}`,
  };
}

function products(order) {
  const rows = (Array.isArray(order.products) ? order.products : []).map((p, i) => ({
    id: `gokoco_${i}`, name: text(p.name, 255) || 'Escova Modeladora GOKOCO',
    planId: null, planName: null,
    quantity: Math.max(1, Math.round(Number(p.quantity) || 1)),
    priceInCents: Math.max(0, Math.round(Number(p.price) * 100) || 0),
  }));
  if (rows.length && rows.reduce((sum, p) => sum + p.priceInCents * p.quantity, 0) === Math.round(Number(order.amount) * 100)) return rows;
  return [{ id: 'gokoco_escova', name: 'Escova Modeladora GOKOCO', planId: null, planName: null, quantity: 1, priceInCents: Math.round(Number(order.amount) * 100) }];
}

async function sendUtmify(env, order, paidAt) {
  const token = String(env.UTMIFY_API_TOKEN || '').trim();
  if (!token) throw new Error('UTMIFY_API_TOKEN não configurado.');
  const cents = Math.round(Number(order.amount) * 100);
  const payload = {
    orderId: String(order.transaction_id || order.id), platform: 'BellaMix', paymentMethod: 'pix', status: 'paid',
    createdAt: utc(order.created_at), approvedDate: utc(paidAt), refundedAt: null,
    customer: { name: order.name, email: order.email, phone: order.phone || null, document: order.document || null, country: 'BR', ...(order.tracking?._browser?.ip ? { ip: order.tracking._browser.ip } : {}) },
    products: products(order),
    trackingParameters: Object.fromEntries(ATTRIBUTION_KEYS.slice(0, 7).map((key) => [key, order.tracking?.[key] || null])),
    commission: { totalPriceInCents: cents, gatewayFeeInCents: 0, userCommissionInCents: cents, currency: 'BRL' },
    isTest: false,
  };
  const response = await fetch('https://api.utmify.com.br/api-credentials/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-token': token },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`UTMify respondeu HTTP ${response.status}. Confira a credencial e os dados do pedido.`);
  return { http_status: response.status };
}

async function hash(value) {
  if (!value) return undefined;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendMeta(env, order, paidAt) {
  const token = String(env.FB_ACCESS_TOKEN || '').trim();
  const pixel = String(env.FB_PIXEL_ID || '1542362403143695').trim();
  if (!token) throw new Error('FB_ACCESS_TOKEN não configurado.');
  if (!/^\d+$/.test(pixel)) throw new Error('FB_PIXEL_ID inválido.');
  const version = String(env.FB_API_VERSION || 'v25.0').trim();
  if (!/^v\d+\.0$/.test(version)) throw new Error('FB_API_VERSION inválida.');
  const phone = String(order.phone || '').replace(/\D/g, '');
  const names = String(order.name || '').trim().split(/\s+/);
  const browser = order.tracking?._browser || {};
  const payload = {
    data: [{
      event_name: 'Purchase', event_id: `pix_${order.id}`, event_time: Math.floor(new Date(paidAt).getTime() / 1000),
      action_source: 'website', event_source_url: browser.source_url || `${String(env.SITE_URL || '').replace(/\/+$/, '')}/pagamento`,
      user_data: {
        em: [await hash(order.email)], ph: phone ? [await hash(phone.length <= 11 ? `55${phone}` : phone)] : undefined,
        fn: names[0] ? [await hash(names[0])] : undefined,
        ln: names.length > 1 ? [await hash(names.slice(1).join(' '))] : undefined,
        external_id: [await hash(order.id)], country: [await hash('br')],
        fbc: browser.fbc || undefined, fbp: browser.fbp || undefined,
        client_ip_address: browser.ip || undefined, client_user_agent: browser.user_agent || undefined,
      },
      custom_data: { value: Number(order.amount), currency: 'BRL', order_id: order.id, content_type: 'product', content_name: products(order).map((p) => p.name).join(' + '), num_items: products(order).reduce((sum, p) => sum + p.quantity, 0) },
    }],
    ...(env.FB_TEST_EVENT_CODE ? { test_event_code: env.FB_TEST_EVENT_CODE } : {}),
  };
  const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error || Number(result.events_received) < 1 || result.events_received === undefined) throw new Error(`Meta não confirmou o evento (HTTP ${response.status}${result.error?.code ? `, código ${result.error.code}` : ''}). Confira o token e o pixel.`);
  return { http_status: response.status, events_received: result.events_received };
}

// Compare-and-swap no JSON impede dois webhooks/admin/status de enviar ao mesmo tempo.
async function swapTracking(db, env, order, tracking) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db(env, 'gokoco_orders', query, 'PATCH', { tracking });
  return rows?.[0] || null;
}

async function deliverPaidPurchase(env, db, orderId, paidAt) {
  const destination = purchaseDestination(env);
  if (!destination) return { state: 'not_configured' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`);
    const order = rows?.[0];
    if (!order) return { state: 'not_paid' };
    const metadata = order.tracking?._purchase || {};
    const prior = metadata[destination] || {};
    if (prior.state === 'sent') return purchaseSummary(env, order);
    if (prior.state === 'sending' && Date.parse(prior.lease_until) > Date.now()) return { state: 'sending' };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: 'retry_pending' };
    const date = metadata.paid_at || paidAt || order.updated_at || order.created_at;
    if (!Number.isFinite(Date.parse(date))) throw new Error('Data de pagamento inválida.');
    const claim = crypto.randomUUID();
    const tracking = { ...order.tracking, _purchase: { ...metadata, paid_at: date, [destination]: { state: 'sending', claim, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 120000).toISOString() } } };
    const claimed = await swapTracking(db, env, order, tracking);
    if (!claimed) continue;
    let result;
    try {
      const receipt = destination === 'utmify' ? await sendUtmify(env, claimed, date) : await sendMeta(env, claimed, date);
      result = { state: 'sent', claim, attempts: tracking._purchase[destination].attempts, sent_at: new Date().toISOString(), ...receipt };
    } catch (error) {
      // Não registrar respostas do fornecedor: podem conter dados pessoais ou tokens.
      result = { state: 'failed', claim, attempts: tracking._purchase[destination].attempts, retry_at: new Date(Date.now() + 60000).toISOString(), error: error.name === 'TimeoutError' ? 'Tempo limite ao enviar a compra. Uma nova tentativa será feita.' : text(error.message, 250) };
      console.error('[purchase]', destination, order.id, result.error);
    }
    const completed = await swapTracking(db, env, claimed, { ...tracking, _purchase: { ...tracking._purchase, [destination]: result } });
    if (!completed) throw new Error('Não foi possível registrar o resultado do envio.');
    return purchaseSummary(env, completed);
  }
  return { state: 'busy' };
}

return { capturePurchaseTracking, purchaseDestination, purchaseSummary, deliverPaidPurchase };
})();

const adminLogin = (() => {
// Cloudflare Pages Function — /api/admin-login
// Valida as credenciais do admin usando variáveis de ambiente da Cloudflare.
// NUNCA expõe a senha no código-fonte — tudo fica nas env vars do painel.
//
// Variáveis de ambiente necessárias (configure em Cloudflare Pages → Settings → Environment variables):
//   ADMIN_USER            — nome de usuário do admin (ex: "bellamix_admin")
//   ADMIN_PASS            — senha do admin (use algo longo e aleatório)
//   ADMIN_SESSION_SECRET  — segredo para assinar os tokens de sessão (64+ caracteres aleatórios)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

/** Assina um payload com HMAC-SHA256 usando a chave secreta */
async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparação em tempo constante para evitar timing attacks */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
    // Ainda percorre 'a' para não vazar o tamanho via tempo
    let dummy = 0;
    for (let i = 0; i < a.length; i++) dummy |= a.charCodeAt(i);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS }
    );
  }

  // Verifica configuração do servidor
  const ADMIN_USER = env.ADMIN_USER;
  const ADMIN_PASS = env.ADMIN_PASS;
  const ADMIN_SESSION_SECRET = env.ADMIN_SESSION_SECRET;

  if (!ADMIN_USER || !ADMIN_PASS || !ADMIN_SESSION_SECRET) {
    console.error("[admin-login] Variáveis de ambiente não configuradas.");
    return new Response(
      JSON.stringify({ error: "Servidor não configurado corretamente." }),
      { status: 500, headers: CORS }
    );
  }

  // Lê o body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "JSON inválido" }),
      { status: 400, headers: CORS }
    );
  }

  const { usuario, senha } = body ?? {};

  // Valida credenciais com comparação em tempo constante
  const userOk = timingSafeEqual(String(usuario ?? ""), ADMIN_USER);
  const passOk = timingSafeEqual(String(senha ?? ""), ADMIN_PASS);

  if (!userOk || !passOk) {
    // Delay fixo para dificultar brute-force
    await new Promise((r) => setTimeout(r, 1500));
    return new Response(
      JSON.stringify({ error: "Usuário ou senha incorretos." }),
      { status: 401, headers: CORS }
    );
  }

  // Gera token assinado com expiração
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ exp });
  const payloadB64 = btoa(payload);
  const sig = await hmacSign(payloadB64, ADMIN_SESSION_SECRET);
  const token = `${payloadB64}.${sig}`;

  return new Response(JSON.stringify({ token }), { status: 200, headers: CORS });
}

return onRequest;
})();

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const gateways = [
  { id: 'ironpay', name: 'IronPay' },
  { id: 'masterfy', name: 'MasterFy' },
  { id: 'umbrellapag', name: 'UmbrellaPag' },
  { id: 'venuspay_pix', name: 'Venus Pay PIX' },
];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const digits = (value) => String(value || '').replace(/\D/g, '');
const BUMPS = {};
const COLORS = { Preta: 37.90, Branca: 37.90, Rosa: 37.90 };
const SHIPPING = { 'Frete Grátis': 0, JADLOG: 18.47, 'SEDEX 12': 33.40 };
function normalizeBuyerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email.slice(0, at).replace(/\.+$/, '')}@${email.slice(at + 1)}` : email;
}
function cartTotal(cart) {
  if (!cart || !Number.isInteger(cart.qty) || cart.qty < 1 || cart.qty > 10) return null;
  let base = 37.90 * cart.qty;
  if (Array.isArray(cart.colors) && cart.colors.length) {
    if (cart.colors.length > 3 || cart.colors.some((c) => !Object.hasOwn(COLORS, c.label) || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 10)) return null;
    if (cart.colors.reduce((sum, c) => sum + c.quantity, 0) !== cart.qty) return null;
    base = cart.colors.reduce((sum, c) => sum + COLORS[c.label] * c.quantity, 0);
  }
  if (!Object.hasOwn(SHIPPING, cart.shipping)) return null;
  if (!Array.isArray(cart.bumps) || cart.bumps.length > 5 || new Set(cart.bumps).size !== cart.bumps.length || cart.bumps.some((id) => !Object.hasOwn(BUMPS, id))) return null;
  if (![1, 0.5].includes(cart.discount) || ![0, 5].includes(cart.bonus)) return null;
  const d = cart.discount;
  const round = (n) => Math.round(n * 100);
  const sum = round(base * d) + round(SHIPPING[cart.shipping] * d)
    + cart.bumps.reduce((acc, id) => acc + round(BUMPS[id] * d), 0) - cart.bonus * 100;
  return Math.max(1, sum) / 100;
}

async function db(env, table, query = '', method = 'GET', body) {
  const base = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!base || !key) throw new Error('Supabase não configurado no servidor.');
  const response = await fetch(`${base}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: query.includes('on_conflict=') ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Banco respondeu ${response.status}: ${value?.message || value?.error || 'erro desconhecido'}`);
  return value;
}

function configured(env, id) {
  if (id === 'ironpay') return !!(env.IRONPAY_API_TOKEN && env.IRONPAY_OFFER_HASH && env.IRONPAY_PRODUCT_HASH);
  if (id === 'masterfy') return !!env.MASTERFY_API_KEY;
  if (id === 'umbrellapag') return !!env.UMBRELLAPAG_API_KEY;
  if (id === 'venuspay_pix') return !!env.VENUS_PAY_SECRET_KEY;
  return false;
}

async function listGateways(env) {
  const rows = await db(env, 'gokoco_gateways', '?select=id,enabled,updated_at');
  return gateways.map((g) => {
    const saved = rows.find((row) => row.id === g.id);
    return { ...g, enabled: !!saved?.enabled, configured: configured(env, g.id), updated_at: saved?.updated_at || null };
  });
}

async function requireAdmin(request, env) {
  const auth = await verifyAdminToken(request, env);
  return auth.valid ? null : json({ error: auth.error || 'Não autorizado.' }, 401);
}

function validateBuyer(body) {
  const buyer = body?.client || {};
  const amount = Number(body?.amount);
  const expected = cartTotal(body?.cart);
  if (!Number.isFinite(amount) || expected === null || Math.abs(Math.round(amount * 100) - Math.round(expected * 100)) > 1) return 'Valor do pedido inválido. Atualize a página e tente novamente.';
  if (String(buyer.name || '').trim().length < 3) return 'Informe seu nome completo.';
  if (!isValidBuyerEmail(normalizeBuyerEmail(buyer.email))) return 'E-mail inválido. Confira o endereço informado e tente novamente.';
  if (![11, 14].includes(digits(buyer.document).length)) return 'CPF/CNPJ inválido.';
  if (digits(buyer.phone).length < 10) return 'Telefone inválido.';
  return null;
}

function isValidBuyerEmail(value) {
  const email = String(value || '').trim();
  if (email.length > 254 || /\.\./.test(email)) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/i.test(email);
}

async function createPix(request, env) {
  const body = await request.json().catch(() => null);
  if (body?.client) body.client.email = normalizeBuyerEmail(body.client.email);
  const invalid = validateBuyer(body);
  if (invalid) return json({ message: invalid, code: 'invalid_document' }, 400);
  const checkoutId = String(body.checkoutId || '');
  if (!/^[a-f0-9-]{20,50}$/i.test(checkoutId)) return json({ message: 'Identificador de checkout inválido.' }, 400);
  const previous = await db(env, 'gokoco_orders', `?checkout_id=eq.${encodeURIComponent(checkoutId)}&select=*&limit=1`);
  if (previous[0]?.pix_code) {
    const old = previous[0];
    return json({ copyPaste: old.pix_code, qrCode: old.qr_code, transactionId: old.transaction_id, gatewayTransactionId: old.transaction_id, orderId: old.id });
  }
  if (previous[0] && previous[0].status !== 'failed') return json({ message: 'A cobrança anterior está em processamento. Aguarde um momento.' }, 409);
  const active = (await listGateways(env)).filter((g) => g.enabled);
  if (active.length !== 1) return json({ message: 'Selecione um gateway PIX no painel admin.' }, 503);
  if (!active[0].configured) return json({ message: 'O gateway PIX selecionado precisa de uma chave de API.' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = `pix:${ip}`;
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.ADMIN_SESSION_SECRET || ''}:${ip}`));
  const ipHash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, '0')).join('');
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    if (count >= 5) return json({ message: 'Muitas cobranças PIX. Tente novamente em uma hora.' }, 429);
  } else {
    const since = new Date(Date.now() - 3600000).toISOString();
    const recent = await db(env, 'gokoco_orders', `?client_ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&status=eq.pending&select=id&limit=5`);
    if (recent.length >= 5) return json({ message: 'Muitas cobranças PIX. Tente novamente em uma hora.' }, 429);
  }
  const shipping = body.shipping || {};
  const order = {
    checkout_id: checkoutId,
    name: String(body.client.name).trim().slice(0, 150),
    email: normalizeBuyerEmail(body.client.email),
    phone: digits(body.client.phone),
    document: digits(body.client.document),
    amount: Number(body.amount),
    products: Array.isArray(body.products) ? body.products.slice(0, 10) : [],
    shipping,
    tracking: capturePurchaseTracking(request, body),
    gateway: active[0].id,
    client_ip_hash: ipHash,
    status: 'creating',
  };
  const saved = previous[0]
    ? await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(previous[0].id)}&status=eq.failed&select=id`, 'PATCH', { ...order, updated_at: new Date().toISOString() })
    : await db(env, 'gokoco_orders', '?select=id', 'POST', order);
  const id = saved?.[0]?.id;
  if (!id) return json({ message: 'A cobrança já está em processamento. Aguarde um momento.' }, 409);
  const payload = {
    amount: order.amount, name: order.name, email: order.email, phone: order.phone,
    document: order.document,
    productName: order.products.map((p) => p.name).filter(Boolean).join(' + ').slice(0, 255) || 'Escova Modeladora GOKOCO',
    address: {
      street: shipping.logradouro, number: shipping.numero, complement: shipping.complemento,
      neighborhood: shipping.bairro, city: shipping.cidade, state: shipping.uf, zipCode: shipping.cep,
    },
  };
  const context = { request, env };
  const headers = { 'Content-Type': 'application/json' };
  const provider = active[0].id;
  const result = provider === 'masterfy' ? await createPixMasterfy(context, headers, payload)
    : provider === 'umbrellapag' ? await createPixUmbrellapag(context, headers, payload)
    : provider === 'venuspay_pix' ? await createPixVenuspay(context, headers, payload)
    : await createPixIronpay(context, headers, payload);
  const payment = await result.json().catch(() => ({}));
  if (!result.ok || !payment.pixCode || !payment.transactionId) {
    await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'failed' });
    const providerMessage = Array.isArray(payment.error?.message)
      ? payment.error.message.join(', ')
      : typeof payment.error === 'string' ? payment.error
      : Array.isArray(payment.message) ? payment.message.join(', ')
      : typeof payment.message === 'string' ? payment.message
      : 'Não foi possível gerar o PIX. Confira seus dados e tente novamente.';
    return json({ message: providerMessage }, result.status || 502);
  }
  const qr = payment.qrCodeBase64 || payment.qrCodeImage || null;
  await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}`, 'PATCH', {
    status: 'pending', transaction_id: String(payment.transactionId), pix_code: payment.pixCode, qr_code: qr,
    updated_at: new Date().toISOString(),
  });
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    await env.PIX_RATELIMIT.put(ipKey, String(count + 1), { expirationTtl: 3600 });
  }
  return json({ copyPaste: payment.pixCode, qrCode: qr, transactionId: payment.transactionId, gatewayTransactionId: payment.transactionId, orderId: id });
}

async function statusPix(request, env) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 150) return json({ error: 'Transação inválida.' }, 400);
  const ids = id.split(',').slice(0, 2);
  let order = null;
  for (const candidate of ids) {
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(candidate)}&select=*&limit=1`);
    if (rows[0]) { order = rows[0]; break; }
  }
  if (!order) return json({ status: 'unknown' }, 404);
  if (order.status === 'paid') {
    await deliverPaidPurchase(env, db, order.id).catch((error) => console.error('[purchase/status]', error.message));
    return json({ status: 'paid', isPaid: true, amount: Number(order.amount), eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
  }
  const result = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
  const status = result.isPaid ? 'paid' : result.isRefunded ? 'refunded' : result.isExpired ? 'expired' : 'pending';
  if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  if (status === 'paid') await deliverPaidPurchase(env, db, order.id, result.paidAt || new Date().toISOString()).catch((error) => console.error('[purchase/status]', error.message));
  return json({ status, isPaid: status === 'paid', isExpired: result.isExpired, amount: Number(order.amount), eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
}

async function webhook(request, env) {
  const notification = await request.json().catch(() => null);
  if (!notification) return json({ received: true });
  const ids = [notification.objectId, notification.data?.transaction_id, notification.data?.id, notification.transaction_hash, notification.transactionId, notification.transaction_id, notification.id].filter(Boolean);
  for (const id of ids) {
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(String(id))}&select=id,transaction_id,gateway,status&limit=1`);
    const order = rows[0];
    if (!order) continue;
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : order.status;
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (status === 'paid') {
      const delivery = await deliverPaidPurchase(env, db, order.id, verified.paidAt || (order.status === 'paid' ? undefined : new Date().toISOString()));
      if (delivery.state === 'failed' || delivery.state === 'retry_pending' || delivery.state === 'busy') return json({ received: true, retryRequired: true }, 503);
    }
    break;
  }
  return json({ received: true });
}

async function adminGateways(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method === 'GET') return json({ gateways: await listGateways(env) });
  if (request.method !== 'PATCH') return json({ error: 'Método inválido.' }, 405);
  const { id, enabled } = await request.json().catch(() => ({}));
  if (!gateways.some((g) => g.id === id) || typeof enabled !== 'boolean') return json({ error: 'Gateway inválido.' }, 400);
  if (enabled && !configured(env, id)) return json({ error: 'Configure a chave deste gateway no Cloudflare antes de ativá-lo.' }, 400);
  if (enabled) await db(env, 'gokoco_gateways', '?enabled=eq.true', 'PATCH', { enabled: false, updated_at: new Date().toISOString() });
  await db(env, 'gokoco_gateways', '?on_conflict=id', 'POST', { id, enabled, updated_at: new Date().toISOString() });
  return json({ gateways: await listGateways(env) });
}

async function adminOrders(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'GET') return json({ error: 'Método inválido.' }, 405);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const pending = await db(env, 'gokoco_orders', `?select=id,transaction_id,gateway,status&status=eq.pending&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=50`);
  await Promise.allSettled(pending.filter((order) => order.transaction_id).map(async (order) => {
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : 'pending';
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (status === 'paid') await deliverPaidPurchase(env, db, order.id, verified.paidAt || new Date().toISOString());
  }));
  await retryPaidPurchases(env);
  const rows = await db(env, 'gokoco_orders', '?select=id,created_at,name,email,phone,amount,products,gateway,status,transaction_id,shipping,tracking&order=created_at.desc&limit=200');
  return json({ orders: rows.map(({ tracking, ...order }) => ({ ...order, purchase: purchaseSummary(env, { ...order, tracking }) })) });
}

async function retryPaidPurchases(env) {
  const destination = purchaseDestination(env);
  if (!destination) return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const path = `tracking->_purchase->${destination}->>state`;
  const rows = await db(env, 'gokoco_orders', `?status=eq.paid&updated_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.asc&limit=10`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidPurchase(env, db, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === 'fulfilled' && r.value.state === 'sent').length, failed: results.filter((r) => r.status === 'rejected' || r.value?.state === 'failed').length };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const path = url.pathname;
      if (path === '/api/admin/login') return await adminLogin({ request, env });
      if (path === '/api/admin/verify') return json({ valid: (await verifyAdminToken(request, env)).valid });
      if (path === '/api/admin/gateways') return await adminGateways(request, env);
      if (path === '/api/admin/orders') return await adminOrders(request, env);
      if (path === '/api/process-purchase-queue' && request.method === 'POST') {
        const secret = String(env.CRON_SECRET || '');
        if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Não autorizado.' }, 401);
        return json(await retryPaidPurchases(env));
      }
      if (path === '/api/public/pix/create' && request.method === 'POST') return await createPix(request, env);
      if (path === '/api/public/pix/status' && request.method === 'GET') return await statusPix(request, env);
      if (path === '/api/pix/webhook' && request.method === 'POST') return await webhook(request, env);
      if (path.startsWith('/api/')) return json({ error: 'Rota não encontrada.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('[gokoco]', error?.message || error);
      return json({ message: error?.message || 'Erro interno do servidor.' }, 500);
    }
  },
};
