// worker-src/admin-login.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
var TOKEN_TTL_MS = 8 * 60 * 60 * 1e3;
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
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
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
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }
  if (request2.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS }
    );
  }
  const ADMIN_USER = env.ADMIN_USER;
  const ADMIN_PASS = env.ADMIN_PASS;
  const ADMIN_SESSION_SECRET = env.ADMIN_SESSION_SECRET;
  if (!ADMIN_USER || !ADMIN_PASS || !ADMIN_SESSION_SECRET) {
    console.error("[admin-login] Vari\xE1veis de ambiente n\xE3o configuradas.");
    return new Response(
      JSON.stringify({ error: "Servidor n\xE3o configurado corretamente." }),
      { status: 500, headers: CORS }
    );
  }
  let body;
  try {
    body = await request2.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "JSON inv\xE1lido" }),
      { status: 400, headers: CORS }
    );
  }
  const { usuario, senha } = body ?? {};
  const userOk = timingSafeEqual(String(usuario ?? ""), ADMIN_USER);
  const passOk = timingSafeEqual(String(senha ?? ""), ADMIN_PASS);
  if (!userOk || !passOk) {
    await new Promise((r) => setTimeout(r, 1500));
    return new Response(
      JSON.stringify({ error: "Usu\xE1rio ou senha incorretos." }),
      { status: 401, headers: CORS }
    );
  }
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ exp });
  const payloadB64 = btoa(payload);
  const sig = await hmacSign(payloadB64, ADMIN_SESSION_SECRET);
  const token = `${payloadB64}.${sig}`;
  return new Response(JSON.stringify({ token }), { status: 200, headers: CORS });
}

// worker-src/upsell-catalog.js
var upsellCatalog = [
  { id: "popozuda", step: 2, name: "Popozuda Creme Modelador Corporal 200g", price: 31.96, rating: 4.6, sourceId: "1731410956394792439", folder: "01 - Popozuda Creme Modelador Corporal", category: "Cuidados com o corpo", description: "Creme modelador corporal Popozuda, embalagem de 200g.", contents: "1 frasco de 200g" },
  { id: "liso-obrigatorio", step: 3, name: "Kit Profissional Liso Obrigat\xF3rio 1L + \xD3leo Ativador de Escova", price: 38.36, rating: 4.8, sourceId: "1737439077064541825", folder: "02 - Kit Liso Obrigatorio", category: "Cuidados com os cabelos", description: "Kit capilar profissional com 3 itens da linha Liso Obrigat\xF3rio e \xF3leo ativador de escova.", contents: "Kit com 3 itens" },
  { id: "ultra-bond", step: 4, name: "Eudora Si\xE0ge Ultra Bond Reset \u2014 Kit Completo", price: 103.96, rating: 4.9, sourceId: "1737119339326637650", folder: "03 - Eudora Siage Ultra Bond Reset", category: "Cuidados com os cabelos", description: "Kit completo Eudora Si\xE0ge Ultra Bond Reset com 4 itens para a rotina de cuidados capilares.", contents: "Kit com 4 itens" },
  { id: "pro-cronology", step: 5, name: "Eudora Si\xE0ge Pro Cronology \u2014 Shampoo + Condicionador", price: 27.2, rating: 4.7, sourceId: "1737278707688638076", folder: "04 - Eudora Siage Pro Cronology", category: "Cuidados com os cabelos", description: "Kit Eudora Si\xE0ge Pro Cronology com shampoo de 250ml e condicionador de 200ml.", contents: "Shampoo 250ml + condicionador 200ml" },
  { id: "principia-glow", step: 6, name: "Principia Kit Essencial Glow GL-02 + CH + VC + PS", price: 63.24, rating: 4.9, sourceId: "1736972891285063316", folder: "05 - Principia Kit Essencial Glow", category: "Cuidados com a pele", description: "Kit de cuidados com a pele Principia Essencial Glow com os produtos GL-02, CH, VC e PS.", contents: "Kit GL-02 + CH + VC + PS" }
];

// worker-src/admin-auth.js
async function hmacSign2(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual2(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyAdminToken(request2, env) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) return { valid: false, error: "Servidor n\xE3o configurado." };
  const auth = request2.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return { valid: false, error: "N\xE3o autorizado." };
  const dot = token.lastIndexOf(".");
  if (dot === -1) return { valid: false, error: "Token inv\xE1lido." };
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = await hmacSign2(payloadB64, secret);
  if (!timingSafeEqual2(expectedSig, providedSig)) {
    return { valid: false, error: "Token inv\xE1lido." };
  }
  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return { valid: false, error: "Token inv\xE1lido." };
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: "Sess\xE3o expirada." };
  }
  return { valid: true };
}

// worker-src/providers/ironpay.js
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let sum = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(sum * 10 % 11 % 10);
  sum = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(sum * 10 % 11 % 10);
  return d.join("");
}
async function createPixIronpay(context, corsHeaders11, body) {
  const { env } = context;
  const apiToken = env.IRONPAY_API_TOKEN;
  const offerHash = env.IRONPAY_OFFER_HASH;
  const productHash = env.IRONPAY_PRODUCT_HASH;
  if (!apiToken || !offerHash || !productHash) {
    return new Response(JSON.stringify({ error: "Gateway de pagamento nao configurado." }), { status: 500, headers: corsHeaders11 });
  }
  const { amount, name, document, productName, email, phone, address } = body;
  if (!amount || !name) {
    return new Response(JSON.stringify({ error: "Campos obrigatorios: amount, name." }), { status: 400, headers: corsHeaders11 });
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const payerDocument = [11, 14].includes(cpfDigits.length) ? cpfDigits : gerarCpfAleatorio();
  const siteUrl = env.SITE_URL || "";
  const webhookUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
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
      street_name: String(address.street || "Rua Principal").trim(),
      number: String(address.number || "S/N").trim(),
      complement: String(address.complement || "").trim(),
      neighborhood: String(address.neighborhood || "Centro").trim(),
      city: String(address.city || "Sao Paulo").trim(),
      state: String(address.state || "SP").trim().toUpperCase(),
      zip_code: String(address.zipCode || "01001000").replace(/\D/g, "")
    },
    cart: [
      {
        product_hash: productHash,
        title: productName || "Kit Escova Secadora 7 em 1",
        cover: null,
        price: amountInCents,
        quantity: 1,
        operation_type: 1,
        tangible: true
      }
    ],
    expire_in_days: 1,
    transaction_origin: "api",
    ...webhookUrl ? { postback_url: webhookUrl } : {}
  };
  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${encodeURIComponent(apiToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }), { status: 502, headers: corsHeaders11 });
    }
    const transactionId = data.hash || data.transaction_hash;
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Resposta invalida do gateway: hash ausente.", rawResponse: data }), { status: 502, headers: corsHeaders11 });
    }
    const pix = data.pix || {};
    const pixCode = pix.pix_qr_code || pix.qr_code || pix.code || pix.copy_paste || null;
    const qrCodeBase64 = pix.qr_code_base64 || pix.base64 || null;
    const qrCodeImage = pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}` : pix.pix_url || null;
    if (!pixCode) {
      return new Response(JSON.stringify({ error: "QR Code PIX nao gerado.", rawResponse: data }), { status: 502, headers: corsHeaders11 });
    }
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "ironpay",
        status: data.payment_status || "PENDENTE",
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage: qrCodeImage || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro de comunicacao com o gateway." }), { status: 502, headers: corsHeaders11 });
  }
}
async function statusPixIronpay(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiToken = env.IRONPAY_API_TOKEN;
  if (!apiToken) {
    return new Response(JSON.stringify({ error: "Gateway nao configurado" }), { status: 500, headers: corsHeaders11 });
  }
  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions/${encodeURIComponent(transactionId)}?api_token=${encodeURIComponent(apiToken)}`,
      { method: "GET", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12e3) }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar gateway.", upstreamStatus: res.status }), { status: 502, headers: corsHeaders11 });
    }
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
        payedAt: data.paid_at || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao consultar status do pagamento." }), { status: 502, headers: corsHeaders11 });
  }
}

// worker-src/providers/masterfy.js
function gerarCpfAleatorio2() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
async function createPixMasterfy(context, corsHeaders11, body) {
  const { env } = context;
  const apiKey = env.MASTERFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = [11, 14].includes(cpfDigits.length) ? cpfDigits : gerarCpfAleatorio2();
  const siteUrl = env.SITE_URL || "";
  const notificationUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
  const amountInCents = Math.round(Number(amount) * 100);
  const hasAddress = address && address.street && address.city;
  const delivery = hasAddress ? {
    fee: 0,
    address: {
      street: String(address.street),
      number: String(address.number || "S/N"),
      complement: String(address.complement || ""),
      district: String(address.neighborhood || address.district || ""),
      city: String(address.city),
      state: String(address.state || ""),
      zipCode: String(address.zipCode || address.cep || "").replace(/\D/g, ""),
      country: "BR"
    }
  } : void 0;
  const payload = {
    amount: amountInCents,
    currency: "BRL",
    method: "PIX",
    description: productName || "Pedido",
    ...notificationUrl ? { notificationUrl } : {},
    payer: {
      name: String(name),
      taxId,
      email: email ? String(email) : "cliente@email.com",
      phone: phone ? String(phone).replace(/\D/g, "") || "00000000000" : "00000000000"
    },
    items: [
      {
        name: productName || "Pedido",
        quantity: 1,
        price: amountInCents,
        type: hasAddress ? "PHYSICAL" : "DIGITAL"
      }
    ],
    ...delivery ? { delivery } : {}
  };
  try {
    const res = await fetch("https://api.masterfypagamentos.com/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = data.data && data.data.copypaste || null;
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
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
        qrCodeImage
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixMasterfy(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiKey = env.MASTERFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway n\xE3o configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  try {
    const res = await fetch(
      `https://api.masterfypagamentos.com/v1/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(12e3),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        }
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", upstreamStatus: res.status }),
        { status: 502, headers: corsHeaders11 }
      );
    }
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
        payedAt: data.paidAt || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// worker-src/providers/umbrellapag.js
var API_BASE = "https://api-gateway.umbrellapag.com/api";
function apiHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "User-Agent": "UMBRELLAB2B/1.0"
  };
}
function gerarCpfAleatorio3() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
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
    country: "BR"
  };
}
function extractPixCode(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.qrCode === "string" && data.qrCode.startsWith("00020")) {
    return data.qrCode;
  }
  const pix = data.pix;
  if (pix && typeof pix === "object") {
    const fromPix = pix.qrCode || pix.copyPaste || pix.copypaste || pix.emv || pix.code || null;
    if (fromPix) return String(fromPix);
  }
  if (typeof data.qrCode === "string" && data.qrCode.length > 20) {
    return data.qrCode;
  }
  return null;
}
async function createPixUmbrellapag(context, corsHeaders11, body) {
  const { request: request2, env } = context;
  const apiKey = env.UMBRELLAPAG_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = [11, 14].includes(cpfDigits.length) ? cpfDigits : gerarCpfAleatorio3();
  const amountInCents = Math.round(Number(amount) * 100);
  const customerAddress = buildAddress(address);
  const siteUrl = (env.SITE_URL || "").trim().replace(/\/+$/, "");
  const postbackUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
  const clientIp = request2.headers.get("CF-Connecting-IP") || request2.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "127.0.0.1";
  const payload = {
    amount: amountInCents,
    currency: "BRL",
    paymentMethod: "PIX",
    installments: 1,
    ...postbackUrl ? { postbackUrl } : {},
    metadata: JSON.stringify({ source: "gokoco-tiktok", product: productName || "Pedido" }),
    traceable: true,
    ip: clientIp,
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      document: {
        number: taxId,
        type: "CPF"
      },
      phone: phone ? String(phone).replace(/\D/g, "") || "11999999999" : "11999999999",
      externalRef: email ? String(email) : taxId,
      address: customerAddress
    },
    shipping: {
      fee: 0,
      address: customerAddress
    },
    items: [
      {
        title: productName || "Pedido",
        unitPrice: amountInCents,
        quantity: 1,
        tangible: !!(address && address.street),
        externalRef: "item-1"
      }
    ],
    pix: {
      expiresInDays: 1
    }
  };
  try {
    const res = await fetch(`${API_BASE}/user/transactions`, {
      method: "POST",
      headers: apiHeaders(apiKey),
      body: JSON.stringify(payload)
    });
    const json4 = await res.json();
    const data = json4.data || json4;
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: id ausente.", rawResponse: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = extractPixCode(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: json4 }),
        { status: 502, headers: corsHeaders11 }
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
        qrCodeImage
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixUmbrellapag(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiKey = env.UMBRELLAPAG_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway n\xE3o configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  try {
    const res = await fetch(
      `${API_BASE}/user/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(12e3),
        headers: apiHeaders(apiKey)
      }
    );
    const json4 = await res.json();
    const data = json4.data || json4;
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const rawStatus = String(data.status || "").toUpperCase();
    const isPaid = rawStatus === "PAID" || rawStatus === "AUTHORIZED";
    const isExpired = rawStatus === "CANCELED" || rawStatus === "REFUSED" || rawStatus === "REFUNDED" || rawStatus === "CHARGEDBACK";
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "umbrellapag",
        status: rawStatus.toLowerCase(),
        isPaid,
        isExpired,
        payedAt: data.paidAt || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// worker-src/providers/venuspay.js
var CREATE_URL = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment";
var STATUS_URL = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/check-payment-status";
var MIN_AMOUNT = 5;
var MAX_AMOUNT = 1e6;
function gerarCpfAleatorio4() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  const s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  const s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
function extractPixCode2(data) {
  const candidatos = [
    data.pix_copy_paste,
    data.pixCopyPaste,
    data.pix_code,
    data.qr_code
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 20) return c;
  }
  return null;
}
function extractQrImage(data) {
  const candidatos = [
    data.qr_code_base64,
    data.pix_qr_code_base64,
    data.qrCodeBase64
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 40) return c;
  }
  return null;
}
async function createPixVenuspay(context, corsHeaders11, body) {
  const { env } = context;
  const secretKey = env.VENUS_PAY_SECRET_KEY;
  if (!secretKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure VENUS_PAY_SECRET_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const amountDecimal = Number(Number(amount).toFixed(2));
  if (amountDecimal < MIN_AMOUNT || amountDecimal > MAX_AMOUNT) {
    return new Response(
      JSON.stringify({ error: `A VenusPay aceita PIX de R$ ${MIN_AMOUNT},00 at\xE9 R$ ${MAX_AMOUNT.toLocaleString("pt-BR")},00.` }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const cpfFinal = [11, 14].includes(cpfDigits.length) ? cpfDigits : gerarCpfAleatorio4();
  const payload = {
    amount: amountDecimal,
    payment_method: "pix",
    name: String(name),
    email: email ? String(email) : "cliente@email.com",
    document: cpfFinal,
    phone: phone ? String(phone).replace(/\D/g, "") || "11999999999" : "11999999999",
    description: productName || "Pedido",
    ...env.VENUS_PAY_PRODUCT_ID ? { product_id: env.VENUS_PAY_PRODUCT_ID } : {},
    // metadata volta no webhook — serve para casar o pagamento com o pedido
    metadata: {
      source: "gokoco-tiktok",
      customer_name: String(name),
      city: address?.city || "",
      state: address?.state || "",
      shipping_address: {
        street: String(address.street || "").trim(),
        number: String(address.number || "").trim(),
        complement: String(address.complement || "").trim(),
        neighborhood: String(address.neighborhood || "").trim(),
        city: String(address.city || "").trim(),
        state: String(address.state || "").trim().toUpperCase(),
        zip_code: String(address.zipCode || "").replace(/\D/g, "")
      }
    }
  };
  try {
    const res = await fetch(CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A documentação aceita x-api-key OU Authorization: Bearer.
        // Usamos Bearer para ficar igual à integração de cartão já em produção.
        Authorization: `Bearer ${secretKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(JSON.stringify({
      event: "VENUSPAY_PIX_RESPONSE",
      httpStatus: res.status,
      success: data.success,
      status: data.status,
      gateway: data.gateway || null,
      errors: data.error || null
    }));
    if (!res.ok || data.success === false) {
      return new Response(
        JSON.stringify({
          error: Array.isArray(data.error?.message) ? data.error.message.join(", ") : typeof data.error === "string" ? data.error : Array.isArray(data.message) ? data.message.join(", ") : typeof data.message === "string" ? data.message : "Erro ao gerar PIX. Confira seus dados e tente novamente.",
          details: data
        }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.transaction_id || null;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: transaction_id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = extractPixCode2(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
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
        expiresAt: data.expiration_date || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixVenuspay(context, corsHeaders11, transactionId) {
  try {
    const res = await fetch(
      `${STATUS_URL}?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12e3) }
    );
    const data = await res.json();
    if (res.status === 404) {
      return new Response(
        JSON.stringify({ transactionId, gateway: "venuspay_pix", status: "pending", isPaid: false, isExpired: false, payedAt: null }),
        { status: 200, headers: corsHeaders11 }
      );
    }
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const rawStatus = String(data.status || "pending").toLowerCase();
    const isPaid = rawStatus === "approved";
    const isExpired = rawStatus === "expired" || rawStatus === "failed" || rawStatus === "refunded" || rawStatus === "chargeback";
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "venuspay_pix",
        status: rawStatus,
        isPaid,
        isExpired,
        payedAt: isPaid ? data.paid_at || data.created_at || null : null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// worker-src/providers/flevopay.js
var BASE = "https://app.flevopag.com/api/v1";
var reply = (data, status, headers6) => new Response(JSON.stringify(data), { status, headers: headers6 });
function gerarCpfAleatorio5() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
async function createPixFlevopay({ request: request2, env }, headers6, body) {
  const key = String(env.FLEVOPAY_API_KEY || "").trim();
  if (!key) return reply({ error: "FlevoPay n\xE3o configurada." }, 503, headers6);
  const amount = Math.round(Number(body.amount) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) return reply({ error: "Valor PIX inv\xE1lido." }, 400, headers6);
  const reference = String(body.reference || crypto.randomUUID());
  const address = body.address || {};
  const docDigits = String(body.document || "").replace(/\D/g, "");
  const document = [11, 14].includes(docDigits.length) ? docDigits : gerarCpfAleatorio5();
  const payload = {
    amount,
    description: String(body.productName || "Pedido GOKOCO").slice(0, 255),
    reference,
    ...env.FLEVOPAY_PRODUCT_HASH ? { productHash: env.FLEVOPAY_PRODUCT_HASH } : { source: "api_externa" },
    customer: {
      name: String(body.name || "").trim(),
      email: String(body.email || "").trim(),
      document,
      phone: String(body.phone || "").replace(/\D/g, "")
    },
    address: {
      street: String(address.street || ""),
      number: String(address.number || ""),
      complement: String(address.complement || ""),
      neighborhood: String(address.neighborhood || ""),
      city: String(address.city || ""),
      state: String(address.state || ""),
      zipcode: String(address.zipCode || address.zipcode || "").replace(/\D/g, "")
    }
  };
  if (request2?.url) {
    const prefix = new URL(request2.url).pathname.startsWith("/video/") ? "/video" : "";
    payload.postback_url = new URL(`${prefix}/api/pix/webhook`, request2.url).toString();
  }
  let response;
  try {
    response = await fetch(`${BASE}/transaction`, {
      method: "POST",
      signal: AbortSignal.timeout(15e3),
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify(payload)
    });
  } catch {
    return reply({ error: "Falha de comunica\xE7\xE3o com a FlevoPay." }, 502, headers6);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return reply({ error: "FlevoPay recusou a cobran\xE7a.", upstreamStatus: response.status }, 502, headers6);
  const transactionId = data.transaction_id ?? data.id;
  const pixCode = data.qr_code || data.pix_code;
  if (!transactionId || !pixCode) return reply({ error: "Resposta incompleta da FlevoPay." }, 502, headers6);
  return reply({
    transactionId: String(transactionId),
    gateway: "flevopay",
    status: "pending",
    pixCode: String(pixCode),
    qrCodeBase64: data.qr_code_base64 || null
  }, 200, headers6);
}
async function statusPixFlevopay({ env }, headers6, transactionId) {
  const key = String(env.FLEVOPAY_API_KEY || "").trim();
  if (!key) return reply({ error: "FlevoPay n\xE3o configurada." }, 503, headers6);
  let response;
  try {
    const url = new URL(`${BASE}/query`);
    url.searchParams.set("action", "get_transaction");
    url.searchParams.set("id", String(transactionId));
    response = await fetch(url, { signal: AbortSignal.timeout(12e3), headers: { "X-API-Key": key } });
  } catch {
    return reply({ error: "Falha ao consultar a FlevoPay." }, 502, headers6);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return reply({ error: "FlevoPay n\xE3o confirmou a transa\xE7\xE3o.", upstreamStatus: response.status }, 502, headers6);
  const status = String(data.status || data.transaction?.status || "").toLowerCase();
  if (!status) return reply({ error: "Status ausente na resposta da FlevoPay." }, 502, headers6);
  return reply({
    transactionId: String(transactionId),
    gateway: "flevopay",
    status,
    isPaid: status === "approved" || status === "paid",
    isRefunded: status === "refunded",
    isExpired: ["failed", "expired", "cancelled", "canceled"].includes(status),
    paidAt: data.paid_at || data.payed_at || null
  }, 200, headers6);
}

// worker-src/pix-gateway-status.js
var headers = { "Content-Type": "application/json" };
async function queryPixGatewayStatus(env, transactionId, gateway) {
  let response;
  const context = { env };
  if (gateway === "masterfy") response = await statusPixMasterfy(context, headers, transactionId);
  else if (gateway === "umbrellapag") response = await statusPixUmbrellapag(context, headers, transactionId);
  else if (gateway === "venuspay_pix") response = await statusPixVenuspay(context, headers, transactionId);
  else if (gateway === "flevopay") response = await statusPixFlevopay(context, headers, transactionId);
  else response = await statusPixIronpay(context, headers, transactionId);
  const data = await response.json();
  if (!response.ok) throw new Error(`${data?.error || "Falha na consulta ao gateway."}${data?.upstreamStatus ? ` HTTP ${data.upstreamStatus}` : ""}`);
  const normalized = String(data.status || "").trim().toLowerCase();
  const isRefunded = Boolean(data.isRefunded) || ["refunded", "refund", "reembolsado", "reembolsada"].includes(normalized);
  return {
    ...data,
    status: normalized,
    isPaid: Boolean(data.isPaid) || ["paid", "approved", "pago"].includes(normalized),
    isRefunded,
    isExpired: !isRefunded && (Boolean(data.isExpired) || ["expired", "cancelled", "canceled"].includes(normalized)),
    paidAt: data.paidAt || data.payedAt || null
  };
}

// worker-src/purchase-tracking.js
var ATTRIBUTION_KEYS = ["src", "sck", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ttclid"];
var text = (value, limit = 500) => typeof value === "string" ? value.slice(0, limit) : "";
var utc = (value) => new Date(value).toISOString().slice(0, 19).replace("T", " ");
function capturePurchaseTracking(request2, body) {
  const tracking = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, text(body.tracking?.[key]) || null]));
  const fb = body.fb || {};
  const fbp = text(fb.fbp, 200);
  const fbc = text(fb.fbc, 300);
  const origin = new URL(request2.url).origin;
  let sourceUrl = `${origin}/pagamento`;
  try {
    const url = new URL(body.tracking?.event_source_url);
    if (url.origin === origin) sourceUrl = url.href.slice(0, 2e3);
  } catch {
  }
  tracking._browser = {
    fbp: /^fb\.\d+\.\d+\./.test(fbp) ? fbp : null,
    fbc: /^fb\.\d+\.\d+\./.test(fbc) ? fbc : tracking.fbclid ? `fb.1.${Date.now()}.${tracking.fbclid}` : null,
    ip: request2.headers.get("CF-Connecting-IP") || null,
    user_agent: request2.headers.get("User-Agent") || null,
    source_url: sourceUrl
  };
  return tracking;
}
async function recoverCustomerAttribution(env, db2, tracking, buyer) {
  const current = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, tracking?.[key] || null]));
  const hasAttribution2 = (values) => ATTRIBUTION_KEYS.some((key) => Boolean(values?.[key]));
  if (hasAttribution2(current)) return { ...tracking, attribution_source: "current_visit" };
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const email = String(buyer?.email || "").trim().toLowerCase();
  const phone = String(buyer?.phone || "").replace(/\D/g, "");
  const filters = [email ? `email=eq.${encodeURIComponent(email)}` : null, phone ? `phone=eq.${encodeURIComponent(phone)}` : null].filter(Boolean);
  if (!filters.length) return { ...tracking, attribution_source: "unattributed" };
  try {
    const results = await Promise.all(filters.map((filter) => db2(env, "gokoco_orders", `?${filter}&created_at=gte.${encodeURIComponent(since)}&select=tracking,created_at&order=created_at.desc&limit=5`)));
    const previous = results.flat().filter((order) => hasAttribution2(order?.tracking)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.tracking;
    if (!previous) return { ...tracking, attribution_source: "unattributed" };
    const recovered = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, previous[key] || null]));
    return { ...tracking, ...recovered, first_touch: recovered, last_touch: null, attribution_source: "recovered_customer_history" };
  } catch (error) {
    console.warn("[attribution] N\xE3o foi poss\xEDvel consultar hist\xF3rico do cliente:", error?.message || error);
    return { ...tracking, attribution_source: "unattributed" };
  }
}
function purchaseDestination(env) {
  const mode = String(env.PURCHASE_DELIVERY_MODE || "auto").trim().toLowerCase();
  if (mode === "utmify") return "utmify";
  if (mode === "meta") return "meta";
  if (mode !== "auto") return null;
  if (String(env.UTMIFY_API_TOKEN || "").trim()) return "utmify";
  if (String(env.FB_ACCESS_TOKEN || "").trim()) return "meta";
  return null;
}
function purchaseSummary(env, order) {
  const destination = purchaseDestination(env);
  const state = destination ? order.tracking?._purchase?.[destination] : null;
  return {
    destination,
    state: destination ? state?.state || "pending" : "not_configured",
    sent_at: state?.sent_at || null,
    error: state?.error || null,
    event_id: `pix_${order.id}`
  };
}
function products(order) {
  const rows = (Array.isArray(order.products) ? order.products : []).map((p, i) => ({
    id: `gokoco_${i}`,
    name: text(p.name, 255) || "Escova Modeladora GOKOCO",
    planId: null,
    planName: null,
    quantity: Math.max(1, Math.round(Number(p.quantity) || 1)),
    priceInCents: Math.max(0, Math.round(Number(p.price) * 100) || 0)
  }));
  if (rows.length && rows.reduce((sum, p) => sum + p.priceInCents * p.quantity, 0) === Math.round(Number(order.amount) * 100)) return rows;
  return [{ id: "gokoco_escova", name: "Escova Modeladora GOKOCO", planId: null, planName: null, quantity: 1, priceInCents: Math.round(Number(order.amount) * 100) }];
}
async function sendUtmify(env, order, status, paidAt = null) {
  const token = String(env.UTMIFY_API_TOKEN || "").trim();
  if (!token) throw new Error("UTMIFY_API_TOKEN n\xE3o configurado.");
  const cents = Math.round(Number(order.amount) * 100);
  const payload = {
    orderId: String(order.transaction_id || order.id),
    platform: "BellaMix",
    paymentMethod: "pix",
    status,
    createdAt: utc(order.created_at),
    approvedDate: paidAt ? utc(paidAt) : null,
    refundedAt: null,
    customer: { name: order.name, email: order.email, phone: order.phone || null, document: order.document || null, country: "BR", ...order.tracking?._browser?.ip ? { ip: order.tracking._browser.ip } : {} },
    products: products(order),
    trackingParameters: Object.fromEntries(ATTRIBUTION_KEYS.slice(0, 7).map((key) => [key, order.tracking?.[key] || null])),
    commission: { totalPriceInCents: cents, gatewayFeeInCents: 0, userCommissionInCents: cents, currency: "BRL" },
    isTest: false
  };
  const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12e3)
  });
  if (!response.ok) throw new Error(`UTMify respondeu HTTP ${response.status}. Confira a credencial e os dados do pedido.`);
  return { http_status: response.status };
}
async function deliverPendingPurchase(env, db2, orderId) {
  if (purchaseDestination(env) !== "utmify") return { state: "not_configured" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&status=eq.pending&select=*&limit=1`);
    const order = rows?.[0];
    if (!order?.transaction_id) return { state: "not_pending" };
    const prior = order.tracking?._purchase?.utmify_pending || {};
    if (prior.state === "sent") return { state: "sent" };
    if (prior.state === "sending" && Date.parse(prior.lease_until) > Date.now()) return { state: "sending" };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: "retry_pending" };
    const claim2 = crypto.randomUUID();
    const tracking = { ...order.tracking, _purchase: { ...order.tracking?._purchase, utmify_pending: { state: "sending", claim: claim2, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 12e4).toISOString() } } };
    const claimed = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`, "PATCH", { tracking });
    if (!claimed?.[0]) continue;
    let result;
    try {
      const receipt = await sendUtmify(env, claimed[0], "waiting_payment");
      result = { state: "sent", claim: claim2, attempts: tracking._purchase.utmify_pending.attempts, sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...receipt };
    } catch (error) {
      result = { state: "failed", claim: claim2, attempts: tracking._purchase.utmify_pending.attempts, retry_at: new Date(Date.now() + 6e4).toISOString(), error: error.name === "TimeoutError" ? "Tempo limite ao enviar o PIX pendente." : text(error.message, 250) };
      console.error("[purchase/pending]", order.id, result.error);
    }
    const completed = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&tracking=eq.${encodeURIComponent(JSON.stringify(claimed[0].tracking || {}))}&select=id`, "PATCH", { tracking: { ...tracking, _purchase: { ...tracking._purchase, utmify_pending: result } } });
    return completed?.length ? result : { state: "status_changed" };
  }
  return { state: "busy" };
}
async function hash(value) {
  if (!value) return void 0;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value).trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sendMeta(env, order, paidAt) {
  const token = String(env.FB_ACCESS_TOKEN || "").trim();
  const pixel = String(env.FB_PIXEL_ID || "1542362403143695").trim();
  if (!token) throw new Error("FB_ACCESS_TOKEN n\xE3o configurado.");
  if (!/^\d+$/.test(pixel)) throw new Error("FB_PIXEL_ID inv\xE1lido.");
  const version = String(env.FB_API_VERSION || "v25.0").trim();
  if (!/^v\d+\.0$/.test(version)) throw new Error("FB_API_VERSION inv\xE1lida.");
  const phone = String(order.phone || "").replace(/\D/g, "");
  const names = String(order.name || "").trim().split(/\s+/);
  const browser = order.tracking?._browser || {};
  const payload = {
    data: [{
      event_name: "Purchase",
      event_id: `pix_${order.id}`,
      event_time: Math.floor(new Date(paidAt).getTime() / 1e3),
      action_source: "website",
      event_source_url: browser.source_url || `${String(env.SITE_URL || "").replace(/\/+$/, "")}/pagamento`,
      user_data: {
        em: [await hash(order.email)],
        ph: phone ? [await hash(phone.length <= 11 ? `55${phone}` : phone)] : void 0,
        fn: names[0] ? [await hash(names[0])] : void 0,
        ln: names.length > 1 ? [await hash(names.slice(1).join(" "))] : void 0,
        external_id: [await hash(order.id)],
        country: [await hash("br")],
        fbc: browser.fbc || void 0,
        fbp: browser.fbp || void 0,
        client_ip_address: browser.ip || void 0,
        client_user_agent: browser.user_agent || void 0
      },
      custom_data: { value: Number(order.amount), currency: "BRL", order_id: order.id, content_type: "product", content_name: products(order).map((p) => p.name).join(" + "), num_items: products(order).reduce((sum, p) => sum + p.quantity, 0) }
    }],
    ...env.FB_TEST_EVENT_CODE ? { test_event_code: env.FB_TEST_EVENT_CODE } : {}
  };
  const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12e3)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error || Number(result.events_received) < 1 || result.events_received === void 0) throw new Error(`Meta n\xE3o confirmou o evento (HTTP ${response.status}${result.error?.code ? `, c\xF3digo ${result.error.code}` : ""}). Confira o token e o pixel.`);
  return { http_status: response.status, events_received: result.events_received };
}
async function swapTracking(db2, env, order, tracking) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db2(env, "gokoco_orders", query, "PATCH", { tracking });
  return rows?.[0] || null;
}
async function deliverPaidPurchase(env, db2, orderId, paidAt) {
  const destination = purchaseDestination(env);
  if (!destination) return { state: "not_configured" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`);
    const order = rows?.[0];
    if (!order) return { state: "not_paid" };
    if (order.tracking?.manualExternal) return { state: "external_tracking" };
    const metadata = order.tracking?._purchase || {};
    const prior = metadata[destination] || {};
    if (prior.state === "sent") return purchaseSummary(env, order);
    if (destination === "utmify" && metadata.utmify_pending?.state === "sending" && Date.parse(metadata.utmify_pending.lease_until) > Date.now()) return { state: "pending_sending" };
    if (prior.state === "sending" && Date.parse(prior.lease_until) > Date.now()) return { state: "sending" };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: "retry_pending" };
    const date = metadata.paid_at || order.tracking?._payment?.paid_at || paidAt || order.updated_at || order.created_at;
    if (!Number.isFinite(Date.parse(date))) throw new Error("Data de pagamento inv\xE1lida.");
    const claim2 = crypto.randomUUID();
    const tracking = { ...order.tracking, _purchase: { ...metadata, paid_at: date, [destination]: { state: "sending", claim: claim2, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 12e4).toISOString() } } };
    const claimed = await swapTracking(db2, env, order, tracking);
    if (!claimed) continue;
    let result;
    try {
      const receipt = destination === "utmify" ? await sendUtmify(env, claimed, "paid", date) : await sendMeta(env, claimed, date);
      result = { state: "sent", claim: claim2, attempts: tracking._purchase[destination].attempts, sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...receipt };
    } catch (error) {
      result = { state: "failed", claim: claim2, attempts: tracking._purchase[destination].attempts, retry_at: new Date(Date.now() + 6e4).toISOString(), error: error.name === "TimeoutError" ? "Tempo limite ao enviar a compra. Uma nova tentativa ser\xE1 feita." : text(error.message, 250) };
      console.error("[purchase]", destination, order.id, result.error);
    }
    const completed = await swapTracking(db2, env, claimed, { ...tracking, _purchase: { ...tracking._purchase, [destination]: result } });
    if (!completed) throw new Error("N\xE3o foi poss\xEDvel registrar o resultado do envio.");
    return purchaseSummary(env, completed);
  }
  return { state: "busy" };
}
async function deliverReshippingFee(env, db2, orderId) {
  if (purchaseDestination(env) !== "utmify") return { state: "not_configured" };
  const rows = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`);
  const order = rows?.[0];
  const fee = order?.tracking?.reshipping;
  if (!fee || fee.status !== "paid") return { state: "not_paid" };
  if (fee.utmify?.state === "sent") return { state: "already_sent" };
  const feeOrder = {
    ...order,
    transaction_id: `${order.transaction_id || order.id}_taxa`,
    amount: Number(fee.amount) || 0,
    products: [{ name: "Taxa Alfandeg\xE1ria", quantity: 1, price: Number(fee.amount) || 0 }],
    created_at: fee.created_at || order.created_at
  };
  try {
    await sendUtmify(env, feeOrder, "paid", fee.confirmed_at || (/* @__PURE__ */ new Date()).toISOString());
  } catch (error) {
    console.error("[reshipping/utmify]", orderId, error?.message || error);
    return { state: "failed", error: text(error.message, 200) };
  }
  const tracking = { ...order.tracking || {}, reshipping: { ...fee, utmify: { state: "sent", sent_at: (/* @__PURE__ */ new Date()).toISOString() } } };
  await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { tracking });
  return { state: "sent" };
}

// worker-src/order-email.js
var emailText = (value, limit = 300) => String(value || "").trim().slice(0, limit);
var emailAddress = (value) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
var escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var EMAIL_ACTIVATION_AT = Date.parse("2026-10-14T19:56:21Z");
function emailSettings(env) {
  const key = emailText(env.RESEND_API_KEY, 300);
  const from = emailText(env.RESEND_FROM_EMAIL, 254);
  let site;
  try {
    site = new URL(String(env.SITE_URL || ""));
  } catch {
    return null;
  }
  if (!key || !emailAddress(from) || site.protocol !== "https:") return null;
  return { key, from, replyTo: from, start: EMAIL_ACTIVATION_AT, site: site.origin };
}
function brandedOrderEmail(title, content, code, settings2) {
  const trackingUrl = `${settings2.site}/rastreio.html?codigo=${encodeURIComponent(code || "")}`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;color:#24252b;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(title)} \u2014 novidades sobre seu pedido GOKOCO.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden">
<tr><td bgcolor="#17181f" style="padding:30px 28px;border-bottom:4px solid #ef3456"><a href="${escapeHtml(settings2.site)}" style="color:#ffffff;text-decoration:none;font-size:28px;font-weight:800;letter-spacing:3px">GOKOCO<span style="color:#ff5976">.</span></a><p style="margin:9px 0 0;color:#d1d5db;font-size:12px;letter-spacing:1px">CUIDADO EM CADA DETALHE</p></td></tr>
<tr><td style="padding:32px 28px 12px"><p style="margin:0 0 12px;color:#c52646;font-size:11px;font-weight:bold;letter-spacing:1.5px">SOBRE SEU PEDIDO</p><h1 style="margin:0 0 24px;font-size:25px;line-height:1.3;color:#17181f;overflow-wrap:anywhere">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.75;color:#4b5563;overflow-wrap:anywhere;word-break:break-word">${content}</div></td></tr>
${code ? `<tr><td style="padding:12px 28px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fff2f5" style="border:1px solid #ffd6df;border-radius:12px"><tr><td align="center" style="padding:24px 16px"><p style="margin:0 0 10px;color:#9d2440;font-size:11px;font-weight:bold;letter-spacing:1.5px">SEU C\xD3DIGO DE RASTREIO</p><p style="margin:0 0 22px;font-family:Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:2px;color:#17181f;word-break:break-all">${escapeHtml(code)}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#d92a4b" style="border-radius:8px;mso-padding-alt:15px 24px"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:15px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">Acompanhar meu pedido &rarr;</a></td></tr></table></td></tr></table></td></tr>` : ""}
<tr><td style="padding:22px 28px;border-top:1px solid #edf0f3;background-color:#fafafa"><p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#17181f">Conte com a gente.</p><p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280">Precisa de ajuda? Responda a este e-mail ou <a href="https://api.whatsapp.com/send?phone=5583993302240" style="color:#a72340;text-decoration:underline">fale com nosso atendimento</a>.</p></td></tr>
</table><p style="max-width:550px;margin:20px auto 0;color:#777e8b;font-size:11px;line-height:1.7;text-align:center">GOKOCO &bull; Atendimento ao cliente<br>Esta mensagem \xE9 referente ao seu pedido em nossa loja.</p>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
function composeEmail(order, code, settings2) {
  const firstName = emailText(order.name, 100).split(/\s+/)[0] || "cliente";
  const url = `${settings2.site}/rastreio.html?codigo=${encodeURIComponent(code)}`;
  const questions = [
    "Por qual motivo voc\xEA comprou com a gente?",
    "Gostou do nosso site?",
    "Gostou do meu atendimento?",
    "O que te chamou aten\xE7\xE3o para comprar pelo nosso an\xFAncio e n\xE3o pelo dos concorrentes?"
  ];
  const intro = `Ol\xE1, ${firstName}!

Seu pagamento da escova GOKOCO foi confirmado. Seu c\xF3digo de rastreio \xE9 ${code}.
Acompanhe seu pedido: ${url}

Posso te fazer algumas perguntas simples para nos ajudar a entender melhor nossos clientes? Se quiser, responda diretamente a este e-mail:

`;
  const text2 = intro + questions.map((question, index) => `${index + 1}. ${question}`).join("\n") + "\n\nObrigado por comprar com a gente!\nEquipe GOKOCO";
  const html = brandedOrderEmail(`Pagamento confirmado, ${firstName}!`, `<p style="margin:0 0 20px">Recebemos o pagamento da sua escova GOKOCO. Obrigado por escolher nossa loja!</p><p style="margin:0 0 16px">Queremos conhecer voc\xEA melhor. Se quiser, responda a este e-mail contando:</p><ol style="padding-left:22px;margin:0 0 24px">${questions.map((question) => `<li style="margin-bottom:8px">${escapeHtml(question)}</li>`).join("")}</ol>`, code, settings2);
  return { from: `GOKOCO <${settings2.from}>`, to: [emailText(order.email, 254)], reply_to: settings2.replyTo, subject: `Seu pedido GOKOCO foi confirmado \xB7 rastreio ${code}`, text: text2, html };
}
async function swapEmailState(db2, env, order, tracking) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db2(env, "gokoco_orders", query, "PATCH", { tracking });
  return rows?.[0] || null;
}
async function deliverPaidEmail(env, db2, orderId, paidAt) {
  const settings2 = emailSettings(env);
  if (!settings2) return { state: "not_configured" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`);
    const order = rows?.[0];
    if (!order) return { state: "not_paid" };
    if (order.tracking?.manualExternal) return { state: "external_tracking" };
    const code = emailText(order.tracking?.shipping?.code, 40);
    if (!/^[A-Z0-9]{8,40}$/.test(code)) return { state: "tracking_pending" };
    if (!emailAddress(String(order.email || ""))) return { state: "invalid_email" };
    const date = order.tracking?.manualPayment?.paidAt || order.tracking?._purchase?.paid_at || order.tracking?._payment?.paid_at || paidAt || order.updated_at || order.created_at;
    if (!Number.isFinite(Date.parse(date)) || Date.parse(date) < settings2.start) return { state: "before_activation" };
    const prior = order.tracking?._email || {};
    if (prior.state === "sent") return { state: "sent", sent_at: prior.sent_at, email_id: prior.email_id };
    if (prior.state === "sending" && Date.parse(prior.lease_until) > Date.now()) return { state: "sending" };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: "retry_pending" };
    const claim2 = crypto.randomUUID();
    const sending = { state: "sending", claim: claim2, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 12e4).toISOString() };
    const tracking = { ...order.tracking, _email: sending };
    const claimed = await swapEmailState(db2, env, order, tracking);
    if (!claimed) continue;
    let result;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings2.key}`, "Content-Type": "application/json", "Idempotency-Key": `gokoco-paid-${order.id}` },
        body: JSON.stringify(composeEmail(claimed, code, settings2)),
        signal: AbortSignal.timeout(12e3)
      });
      const receipt = await response.json().catch(() => ({}));
      if (!response.ok || !receipt.id) throw new Error(`Resend n\xE3o confirmou o envio (HTTP ${response.status}).`);
      result = { state: "sent", claim: claim2, attempts: sending.attempts, sent_at: (/* @__PURE__ */ new Date()).toISOString(), email_id: String(receipt.id) };
    } catch (error) {
      result = { state: "failed", claim: claim2, attempts: sending.attempts, retry_at: new Date(Date.now() + 6e4).toISOString(), error: error.name === "TimeoutError" ? "Tempo limite ao enviar o e-mail." : emailText(error.message, 160) };
      console.error("[order-email]", order.id, result.error);
    }
    const completed = await swapEmailState(db2, env, claimed, { ...tracking, _email: result });
    if (!completed) throw new Error("N\xE3o foi poss\xEDvel registrar o resultado do envio do e-mail.");
    return result;
  }
  return { state: "busy" };
}
async function retryPaidEmails(env, db2, limit = 1) {
  const settings2 = emailSettings(env);
  if (!settings2) return { configured: false, processed: 0 };
  const path = "tracking->_email->>state";
  const codePath = encodeURIComponent("tracking->shipping->>code");
  const rows = await db2(env, "gokoco_orders", `?status=eq.paid&gateway=neq.manual_tracking&${codePath}=not.is.null&updated_at=gte.${encodeURIComponent(new Date(settings2.start).toISOString())}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.desc&limit=${Math.max(1, Math.min(3, limit))}`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidEmail(env, db2, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === "fulfilled" && r.value.state === "sent").length, failed: results.filter((r) => r.status === "rejected" || r.value?.state === "failed").length };
}
async function sendManualOrderEmail(env, order, subject, message) {
  const settings2 = emailSettings(env);
  if (!settings2) return { state: "not_configured" };
  const recipient = emailText(order.email, 254);
  const title = emailText(subject, 150);
  const body = emailText(message, 5e3);
  if (!emailAddress(recipient) || !title || !body) return { state: "invalid_input" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${settings2.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `GOKOCO <${settings2.from}>`,
      to: [recipient],
      reply_to: settings2.replyTo,
      subject: title,
      text: body,
      html: brandedOrderEmail(title, `<p style="margin:0 0 20px">${escapeHtml(body).replace(/\r?\n/g, "<br>")}</p>`, order.status === "paid" ? order.tracking?.shipping?.code : null, settings2)
    }),
    signal: AbortSignal.timeout(12e3)
  });
  const receipt = await response.json().catch(() => ({}));
  if (!response.ok || !receipt.id) return { state: "failed" };
  return { state: "sent", email_id: String(receipt.id) };
}

// worker-src/recovery-email.js
var RECOVERY_ACTIVATION_AT = "2026-10-14T22:28:59Z";
var RECOVERY_DELAYS = [30 * 6e4, 4 * 36e5, 24 * 36e5];
var recoveryText = (value, limit = 200) => String(value || "").trim().slice(0, limit);
var recoveryEmail = (value) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
var recoveryHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
function recoverySettings(env) {
  const key = recoveryText(env.RESEND_API_KEY, 300);
  const from = recoveryText(env.RESEND_FROM_EMAIL, 254);
  let site;
  try {
    site = new URL(String(env.SITE_URL || ""));
  } catch {
    return null;
  }
  if (!key || !recoveryEmail(from) || site.protocol !== "https:") return null;
  return { key, from, site: site.origin };
}
function recoveryMessage(order, number, settings2) {
  const name = recoveryText(order.name, 100).split(/\s+/)[0] || "cliente";
  const items = Array.isArray(order.products) ? order.products.map((item) => recoveryText(item.name, 120)).filter(Boolean).join(", ") : "";
  const amount = Number(order.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const link = `${settings2.site}/?utm_source=recovery&utm_medium=email&utm_campaign=email${number}`;
  const messages = [
    `Seu PIX foi gerado, mas ainda n\xE3o identificamos o pagamento. Se quiser concluir a compra da sua escova GOKOCO, acesse a loja. Caso j\xE1 tenha pago, desconsidere esta mensagem.`,
    `Seu pedido da escova GOKOCO ainda aparece sem pagamento confirmado. Voc\xEA pode voltar \xE0 loja para concluir a compra. Caso j\xE1 tenha pago, desconsidere esta mensagem.`,
    `Este \xE9 nosso \xFAltimo lembrete sobre o pedido da escova GOKOCO que ainda aparece sem pagamento confirmado. Se quiser, voc\xEA pode concluir a compra na loja. Caso j\xE1 tenha pago, desconsidere esta mensagem.`
  ];
  const subject = [`Seu pedido GOKOCO ainda est\xE1 aguardando pagamento`, `Ainda quer sua escova GOKOCO?`, `\xDAltimo lembrete sobre seu pedido GOKOCO`][number - 1];
  const body = messages[number - 1];
  const text2 = `Ol\xE1, ${name}!

${body}

${items ? `Produto: ${items}
` : ""}Valor do pedido: ${amount}

Voltar \xE0 loja: ${link}

Equipe GOKOCO`;
  const html = `<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#17212b;line-height:1.6"><h1 style="font-size:22px">Ol\xE1, ${recoveryHtml(name)}!</h1><p>${recoveryHtml(body)}</p>${items ? `<p><strong>Produto:</strong> ${recoveryHtml(items)}</p>` : ""}<p><strong>Valor do pedido:</strong> ${recoveryHtml(amount)}</p><p><a href="${recoveryHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#15803d;color:#fff;text-decoration:none;font-weight:bold">Voltar \xE0 loja</a></p><p>Equipe GOKOCO</p></div>`;
  return { from: `GOKOCO <${settings2.from}>`, to: [order.email], reply_to: settings2.from, subject, text: text2, html };
}
async function recoverySwap(db2, env, order, state) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db2(env, "gokoco_orders", query, "PATCH", { tracking: { ...order.tracking || {}, _recovery: state } });
  return rows?.[0] || null;
}
async function stopRecovery(db2, env, order, count, reason) {
  await recoverySwap(db2, env, order, { ...order.tracking?._recovery || {}, count, state: "stopped", reason });
  return { state: reason, count };
}
async function processRecoveryOrder(env, db2, verifyPayment, orderId, now = Date.now()) {
  const settings2 = recoverySettings(env);
  if (!settings2) return { state: "not_configured" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`);
    const order = rows?.[0];
    if (!order || order.status !== "pending" || !order.transaction_id || order.gateway === "manual_tracking") return { state: "not_pending" };
    const email = recoveryText(order.email, 254).toLowerCase();
    if (!recoveryEmail(email)) return { state: "invalid_email" };
    if (Date.parse(order.created_at) < Date.parse(RECOVERY_ACTIVATION_AT)) return { state: "before_activation" };
    const prior = order.tracking?._recovery || {};
    const count = Number(prior.count) || 0;
    if (count >= 3 || prior.state === "stopped") return { state: prior.state || "complete", count };
    const dueAt = count ? Date.parse(prior.next_at) : Date.parse(order.created_at) + RECOVERY_DELAYS[0];
    if (!Number.isFinite(dueAt) || dueAt > now) return { state: "scheduled", count };
    if (prior.state === "sending" && Date.parse(prior.lease_until) > now) return { state: "sending", count };
    if (Date.parse(prior.retry_at) > now) return { state: "retry_pending", count };
    const paid = await db2(env, "gokoco_orders", `?email=eq.${encodeURIComponent(email)}&status=eq.paid&select=id&limit=1`);
    if (paid?.length) return stopRecovery(db2, env, order, count, "customer_paid");
    if (!count) {
      const latest = await db2(env, "gokoco_orders", `?email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id&order=created_at.desc&limit=1`);
      if (latest?.[0]?.id !== order.id) return stopRecovery(db2, env, order, count, "newer_order");
      const others = await db2(env, "gokoco_orders", `?email=eq.${encodeURIComponent(email)}&id=neq.${encodeURIComponent(order.id)}&tracking->_recovery->>count=gte.1&select=id&limit=1`);
      if (others?.length) return stopRecovery(db2, env, order, count, "already_contacted");
    }
    const payment = await verifyPayment(env, order.transaction_id, order.gateway);
    if (payment.isPaid || payment.isRefunded || payment.isExpired) return stopRecovery(db2, env, order, count, "payment_changed");
    const number = count + 1;
    const sending = { ...prior, count, state: "sending", number, claim: crypto.randomUUID(), lease_until: new Date(now + 12e4).toISOString() };
    const claimed = await recoverySwap(db2, env, order, sending);
    if (!claimed) continue;
    const stillPending = await db2(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&select=id&limit=1`);
    if (!stillPending?.length) return { state: "payment_changed", count };
    let result;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings2.key}`, "Content-Type": "application/json", "Idempotency-Key": `gokoco-recovery-${order.id}-${number}` },
        body: JSON.stringify(recoveryMessage(claimed, number, settings2)),
        signal: AbortSignal.timeout(12e3)
      });
      const receipt = await response.json().catch(() => ({}));
      if (!response.ok || !receipt.id) throw new Error(`Resend n\xE3o confirmou o envio (HTTP ${response.status}).`);
      result = { count: number, state: number === 3 ? "complete" : "scheduled", sent: [...Array.isArray(prior.sent) ? prior.sent : [], { number, at: new Date(now).toISOString(), id: String(receipt.id) }], next_at: number < 3 ? new Date(now + RECOVERY_DELAYS[number]).toISOString() : null };
    } catch (error) {
      result = { ...prior, count, state: "failed", retry_at: new Date(now + 30 * 6e4).toISOString(), error: recoveryText(error.message, 160) };
      console.error("[recovery-email]", order.id, result.error);
    }
    const completed = await recoverySwap(db2, env, claimed, result);
    if (!completed) throw new Error("N\xE3o foi poss\xEDvel registrar o resultado da recupera\xE7\xE3o.");
    return { state: result.state, count: result.count, sent: result.state !== "failed" };
  }
  return { state: "busy" };
}
async function processRecoveryQueue(env, db2, verifyPayment, limit = 3) {
  if (!recoverySettings(env)) return { configured: false, processed: 0 };
  const now = Date.now();
  const cutoff = new Date(now - RECOVERY_DELAYS[0]).toISOString();
  const size = Math.max(1, Math.min(3, limit));
  const base = `?status=eq.pending&gateway=neq.manual_tracking&created_at=gte.${encodeURIComponent(RECOVERY_ACTIVATION_AT)}&created_at=lte.${encodeURIComponent(cutoff)}`;
  const [newOrders, followups] = await Promise.all([
    db2(env, "gokoco_orders", `${base}&or=(tracking->_recovery.is.null,tracking->_recovery->>state.eq.failed,tracking->_recovery->>state.eq.sending)&or=(tracking->_recovery->>count.is.null,tracking->_recovery->>count.eq.0)&select=id&order=created_at.desc&limit=${size}`),
    db2(env, "gokoco_orders", `${base}&tracking->_recovery->>count=gte.1&tracking->_recovery->>count=lte.2&tracking->_recovery->>state=neq.stopped&tracking->_recovery->>next_at=lte.${encodeURIComponent(new Date(now).toISOString())}&select=id&order=created_at.asc&limit=${size}`)
  ]);
  const rows = [...followups, ...newOrders].slice(0, size);
  const results = await Promise.allSettled(rows.map((order) => processRecoveryOrder(env, db2, verifyPayment, order.id, now)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === "fulfilled" && r.value.sent).length, failed: results.filter((r) => r.status === "rejected" || r.value?.state === "failed").length };
}

// worker-src/reshipping-fee.js
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var TRANSITO_OFFSET = 30 * HOUR;
var FEE_AFTER_TRANSITO = 5 * MINUTE;
var RECEIPT_BUCKET = "comprovantes-taxa";
var RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
var RECEIPT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };
var CODE_PATTERN = /^GK[A-HJ-NP-Z2-9]{10}$/;
function gerarCpfAleatorio6() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
function feeAmount(env) {
  const value = Number(String(env.RESHIPPING_FEE_AMOUNT || "").replace(",", "."));
  return Number.isFinite(value) && value >= 1 && value <= 500 ? Math.round(value * 100) / 100 : 9;
}
function reshippingSchedule(shipping, fallbackCreatedAt) {
  const origin = Date.parse(shipping?.created_at || fallbackCreatedAt);
  if (!Number.isFinite(origin) || shipping?.status === "delivered") return null;
  const events = Array.isArray(shipping?.events) ? shipping.events : [];
  const manualTransito = Date.parse(events.find((event) => event?.status === "in_transit_2")?.at || "");
  const transitoAt = Number.isFinite(manualTransito) ? manualTransito : origin + TRANSITO_OFFSET;
  return { outForDeliveryAt: new Date(transitoAt).toISOString(), feeAt: new Date(transitoAt + FEE_AFTER_TRANSITO).toISOString() };
}
function publicReshipping(env, order) {
  const shipping = order?.tracking?.shipping;
  const schedule = reshippingSchedule(shipping, order?.created_at);
  if (!schedule) return null;
  const saved = order.tracking?.reshipping || {};
  const confirmed = saved.status === "paid";
  return {
    ...schedule,
    amount: Number(saved.amount) || feeAmount(env),
    available: Date.now() >= Date.parse(schedule.feeAt),
    status: confirmed ? "paid" : saved.status === "receipt_sent" ? "receipt_sent" : saved.pix_code ? "pending" : "none",
    confirmedAt: confirmed ? saved.confirmed_at : null
  };
}
async function loadOrder(deps, env, code) {
  if (!CODE_PATTERN.test(code)) return { error: deps.json({ error: "C\xF3digo de rastreio inv\xE1lido." }, 400) };
  const rows = await deps.db(env, "gokoco_orders", `?tracking->shipping->>code=eq.${encodeURIComponent(code)}&select=id,name,email,phone,document,status,created_at,shipping,tracking&limit=1`);
  const order = rows[0];
  if (!order || order.status !== "paid" && !(order.status === "tracking_only" && order.tracking?.manualExternal)) return { error: deps.json({ error: "Pedido n\xE3o encontrado." }, 404) };
  const schedule = reshippingSchedule(order.tracking?.shipping, order.created_at);
  if (!schedule || Date.now() < Date.parse(schedule.feeAt)) return { error: deps.json({ error: "A taxa alfandeg\xE1ria ainda n\xE3o est\xE1 dispon\xEDvel para este pedido." }, 409) };
  return { order };
}
async function saveReshipping(deps, env, order, reshipping) {
  const tracking = { ...order.tracking || {}, reshipping };
  const saved = await deps.db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { tracking, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  return saved.length > 0;
}
function pixResponse(reshipping) {
  return { pixCode: reshipping.pix_code, qrCode: reshipping.qr_code || null, amount: Number(reshipping.amount), status: reshipping.status };
}
async function createFeePix(request2, env, deps) {
  const body = await request2.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping;
  if (current?.status === "paid") return deps.json(pixResponse(current));
  const createdAt = Date.parse(current?.created_at || "");
  if (current?.pix_code && Date.now() - createdAt < 50 * MINUTE) return deps.json(pixResponse(current));
  const active = (await deps.listGateways(env)).filter((gateway) => gateway.enabled && gateway.method === "pix");
  if (active.length !== 1 || !active[0].configured) return deps.json({ error: "Pagamento PIX indispon\xEDvel no momento. Fale com o atendimento." }, 503);
  const shipping = order.shipping || {};
  const amount = feeAmount(env);
  const docDigits = String(order.document || "").replace(/\D/g, "");
  const payload = {
    amount,
    name: String(order.name || "").trim().length >= 3 && !order.tracking?.manualExternal ? order.name : "Cliente GOKOCO",
    email: String(order.email || "").trim() || "cliente@gokoco.shop",
    phone: String(order.phone || "").replace(/\D/g, "") || "11999999999",
    document: [11, 14].includes(docDigits.length) ? docDigits : gerarCpfAleatorio6(),
    productName: `Taxa Alfandeg\xE1ria - ${code}`,
    address: { street: shipping.logradouro || "Rua Principal", number: shipping.numero || "S/N", complement: shipping.complemento || "", neighborhood: shipping.bairro || "Centro", city: shipping.cidade || "Sao Paulo", state: shipping.uf || "SP", zipCode: shipping.cep || "01001000" }
  };
  const provider = deps.providers[active[0].id] || deps.providers.ironpay;
  const result = await provider({ request: request2, env }, { "Content-Type": "application/json" }, payload);
  const payment = await result.json().catch(() => ({}));
  if (!result.ok || !payment.pixCode || !payment.transactionId) {
    console.error("[reshipping/pix]", code, active[0].id, result.status, payment?.error || payment?.message);
    return deps.json({ error: "N\xE3o foi poss\xEDvel gerar o PIX da taxa. Tente novamente em instantes." }, 502);
  }
  const reshipping = {
    status: "pending",
    amount,
    gateway: active[0].id,
    transaction_id: String(payment.transactionId),
    pix_code: payment.pixCode,
    qr_code: payment.qrCodeBase64 || payment.qrCodeImage || null,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!await saveReshipping(deps, env, order, reshipping)) return deps.json({ error: "O pedido foi atualizado. Tente novamente." }, 409);
  return deps.json(pixResponse(reshipping));
}
async function feeStatus(request2, env, deps) {
  const code = String(new URL(request2.url).searchParams.get("code") || "").trim().toUpperCase();
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping;
  if (!current?.transaction_id) return deps.json({ status: "none" });
  if (current.status === "paid") return deps.json({ status: "paid", confirmedAt: current.confirmed_at });
  const result = await deps.queryPixGatewayStatus(env, current.transaction_id, current.gateway).catch(() => ({}));
  if (!result?.isPaid) return deps.json({ status: current.status === "receipt_sent" ? "receipt_sent" : "pending" });
  const confirmedAt = result.paidAt || (/* @__PURE__ */ new Date()).toISOString();
  await saveReshipping(deps, env, order, { ...current, status: "paid", confirmed_at: confirmedAt });
  await deps.deliverReshippingFee(env, deps.db, order.id).catch((e) => console.error("[reshipping/utmify]", code, e?.message || e));
  return deps.json({ status: "paid", confirmedAt });
}
async function storageRequest(env, path, init) {
  const base = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return fetch(`${base}/storage/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers || {} } });
}
async function uploadReceipt(env, path, file) {
  const upload = () => storageRequest(env, `object/${RECEIPT_BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": file.type, "x-upsert": "true" }, body: file });
  let response = await upload();
  if (response.status === 400 || response.status === 404) {
    const text2 = await response.text().catch(() => "");
    if (!/bucket not found|not found/i.test(text2)) throw new Error(`Storage respondeu ${response.status}`);
    await storageRequest(env, "bucket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: RECEIPT_BUCKET, name: RECEIPT_BUCKET, public: false }) });
    response = await upload();
  }
  if (!response.ok) throw new Error(`Storage respondeu ${response.status}`);
}
async function sendReceipt(request2, env, deps) {
  const form = await request2.formData().catch(() => null);
  const code = String(form?.get("code") || "").trim().toUpperCase();
  const file = form?.get("file");
  if (!file || typeof file === "string" || !file.size) return deps.json({ error: "Anexe o comprovante do PIX." }, 400);
  if (file.size > RECEIPT_MAX_BYTES) return deps.json({ error: "O arquivo deve ter no m\xE1ximo 8 MB." }, 413);
  const extension = RECEIPT_TYPES[file.type];
  if (!extension) return deps.json({ error: "Envie uma imagem (JPG, PNG, WEBP) ou um PDF." }, 415);
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping || {};
  if (current.status === "paid" || current.status === "receipt_sent") return deps.json({ status: current.status, confirmedAt: current.confirmed_at });
  if (!current.pix_code) return deps.json({ error: "Gere o PIX da taxa antes de enviar o comprovante." }, 409);
  const path = `${code}/${Date.now()}.${extension}`;
  try {
    await uploadReceipt(env, path, file);
  } catch (uploadError) {
    console.error("[reshipping/receipt]", code, uploadError.message);
    return deps.json({ error: "N\xE3o foi poss\xEDvel enviar o comprovante. Tente novamente." }, 502);
  }
  const confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
  const reshipping = { ...current, status: "receipt_sent", confirmed_at: confirmedAt, receipt: { path, name: String(file.name || "").slice(0, 120), type: file.type, size: file.size, uploaded_at: confirmedAt } };
  if (!await saveReshipping(deps, env, order, reshipping)) return deps.json({ error: "O pedido foi atualizado. Tente novamente." }, 409);
  return deps.json({ status: "receipt_sent", confirmedAt });
}
async function adminReceiptUrl(request2, env, deps) {
  const denied = await deps.requireAdmin(request2, env);
  if (denied) return denied;
  const id = String(new URL(request2.url).searchParams.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return deps.json({ error: "Pedido inv\xE1lido." }, 400);
  const rows = await deps.db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&select=tracking&limit=1`);
  const path = rows[0]?.tracking?.reshipping?.receipt?.path;
  if (!path) return deps.json({ error: "Comprovante n\xE3o encontrado." }, 404);
  const response = await storageRequest(env, `object/sign/${RECEIPT_BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 600 }) });
  const signed = await response.json().catch(() => ({}));
  if (!response.ok || !signed.signedURL) return deps.json({ error: "N\xE3o foi poss\xEDvel abrir o comprovante." }, 502);
  const base = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  return deps.json({ url: `${base}/storage/v1${signed.signedURL}` });
}
async function adminMarkPaid(request2, env, deps) {
  const denied = await deps.requireAdmin(request2, env);
  if (denied) return denied;
  const body = await request2.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return deps.json({ error: "Pedido inv\xE1lido." }, 400);
  const rows = await deps.db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&select=id,tracking&limit=1`);
  const order = rows[0];
  if (!order) return deps.json({ error: "Pedido n\xE3o encontrado." }, 404);
  const current = order.tracking?.reshipping;
  if (!current?.pix_code) return deps.json({ error: "Este pedido n\xE3o tem taxa gerada." }, 404);
  if (current.status === "paid") return deps.json({ status: "paid", confirmedAt: current.confirmed_at });
  const confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
  const reshipping = { ...current, status: "paid", confirmed_at: confirmedAt, manual: { paidAt: confirmedAt, source: "admin" } };
  if (!await saveReshipping(deps, env, order, reshipping)) return deps.json({ error: "O pedido foi atualizado. Tente novamente." }, 409);
  await deps.deliverReshippingFee(env, deps.db, order.id).catch((e) => console.error("[reshipping/utmify]", order.id, e?.message || e));
  return deps.json({ status: "paid", confirmedAt });
}
async function handleReshippingRoute(path, request2, env, deps) {
  if (path === "/api/public/reshipping-fee/pix" && request2.method === "POST") return createFeePix(request2, env, deps);
  if (path === "/api/public/reshipping-fee/status" && request2.method === "GET") return feeStatus(request2, env, deps);
  if (path === "/api/public/reshipping-fee/receipt" && request2.method === "POST") return sendReceipt(request2, env, deps);
  if (path === "/api/admin/reshipping-receipt" && request2.method === "GET") return adminReceiptUrl(request2, env, deps);
  if (path === "/api/admin/reshipping-fee/paid" && request2.method === "POST") return adminMarkPaid(request2, env, deps);
  return null;
}

// sites/bella/functions/_lib/utmify.js
function trackingParams(tracking) {
  const source = tracking && typeof tracking === "object" ? tracking : {};
  return {
    src: source.src || null,
    sck: source.sck || null,
    utm_source: source.utm_source || null,
    utm_campaign: source.utm_campaign || null,
    utm_medium: source.utm_medium || null,
    utm_content: source.utm_content || null,
    utm_term: source.utm_term || null
  };
}
async function sendUtmifyOrder(env, order) {
  const token = String(env.UTMIFY_API_TOKEN || "").trim();
  if (!token) throw new Error("UTMIFY_API_TOKEN n\xE3o configurado.");
  const status = String(order.status || "paid").toLowerCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const valueInCents = Math.max(0, Math.round(Number(order.valueInCents || 0)));
  const payload = {
    orderId: String(order.orderId || `bellamix_${Date.now()}`),
    platform: "other",
    paymentMethod: order.paymentMethod || "pix",
    status,
    createdAt: order.createdAt || now,
    approvedDate: status === "paid" ? order.paidAt || now : null,
    refundedAt: null,
    customer: {
      name: order.customerName || "Cliente",
      email: order.customerEmail || "sem-email@bellamixbrasil.com.br",
      phone: order.customerPhone || null,
      document: order.customerDocument || null,
      country: "BR"
    },
    products: [{
      id: "bellamix_escovas",
      name: order.productName || "Kit Escova Secadora",
      planId: "bellamix_escovas",
      planName: order.productName || "Kit Escova Secadora",
      quantity: 1,
      priceInCents: valueInCents
    }],
    trackingParameters: trackingParams(order.tracking),
    commission: {
      totalPriceInCents: valueInCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: valueInCents
    },
    isTest: false
  };
  const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`UTMify respondeu ${response.status}: ${responseText}`);
  return { status: response.status, body: responseText };
}

// sites/bella/functions/_lib/meta-config.js
var FACEBOOK_PIXEL_ID = "1542362403143695";

// sites/bella/functions/_lib/facebook.js
async function hash2(value) {
  if (!value) return void 0;
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sendFacebookPurchase(env, payload) {
  const pixelId = FACEBOOK_PIXEL_ID;
  const accessToken = String(env.FB_ACCESS_TOKEN || "").trim();
  if (!pixelId || !accessToken) throw new Error("Pixel da Meta n\xE3o configurado.");
  const { user_data: userData = {}, custom_data: customData = {}, event_id: eventId } = payload || {};
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1e3),
      event_id: eventId || void 0,
      action_source: "website",
      event_source_url: String(env.SITE_URL || "").trim() || void 0,
      user_data: {
        em: userData.em?.[0] ? [await hash2(userData.em[0])] : void 0,
        ph: userData.ph?.[0] ? [await hash2(userData.ph[0])] : void 0,
        fn: userData.fn?.[0] ? [await hash2(userData.fn[0])] : void 0,
        ln: userData.ln?.[0] ? [await hash2(userData.ln[0])] : void 0,
        fbc: userData.fbc || void 0,
        fbp: userData.fbp || void 0
      },
      custom_data: customData
    }]
  };
  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Meta CAPI respondeu ${response.status}: ${responseText}`);
  return { status: response.status, body: responseText };
}

// sites/bella/functions/_lib/card-summary.js
function safeCardSummary(value) {
  const summary = String(value || "").trim();
  return /^(Visa|Mastercard|Amex|Elo|Hipercard|Cartão) ••••[0-9]{4}$/.test(summary) ? summary : null;
}

// sites/bella/functions/_lib/card-crypto.js
function cardSecret(env) {
  return String(
    env.BELLA_ENCRYPT_KEY || env.ENCRYPT_KEY || env.BELLA_VITE_ENCRYPT_KEY || env.VITE_ENCRYPT_KEY || ""
  ).trim();
}
async function encryptCardData(data, secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(data));
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decryptCardData(encryptedBase64, secret) {
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

// sites/bella/functions/_lib/leads-store.js
async function secureCardValue(env, body) {
  const secret = cardSecret(env);
  const card = body.card || {};
  const numero = String(card.numero || "").replace(/\D/g, "");
  if (secret && numero.length >= 13) {
    try {
      return await encryptCardData(JSON.stringify({
        numero,
        nome: String(card.nome || "").slice(0, 80),
        validade: String(card.validade || "").slice(0, 7),
        cvv: String(card.cvv || "").replace(/\D/g, "").slice(0, 4),
        cpf: String(card.cpf || "").replace(/\D/g, "").slice(0, 11)
      }), secret);
    } catch (error) {
      console.warn("[leads] Falha ao criptografar cart\xE3o:", error?.message);
    }
  }
  return safeCardSummary(body.cardEncrypted);
}
function config(env) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, key };
}
async function supabaseRequest(env, path, options = {}) {
  const { url, key } = config(env);
  if (!url || !key) throw new Error("Supabase do servidor n\xE3o configurado.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers || {}
    }
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
  return response;
}
var TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck", "gclid", "fbclid", "ttclid", "fbc", "fbp"];
function trackingValues(tracking) {
  const source = tracking && typeof tracking === "object" ? tracking : {};
  return Object.fromEntries(TRACKING_KEYS.map((key) => [key, source[key] || null]));
}
function hasAttribution(tracking) {
  return TRACKING_KEYS.some((key) => Boolean(tracking?.[key]));
}
async function previousCustomerTracking(env, body) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  const candidates = [];
  const filters = [];
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  if (email) filters.push(`email=ilike.${encodeURIComponent(email)}`);
  if (phone) filters.push(`telefone=eq.${encodeURIComponent(phone)}`);
  for (const filter of filters) {
    const response = await supabaseRequest(
      env,
      `leads?${filter}&created_at=gte.${encodeURIComponent(since)}&select=tracking,created_at&order=created_at.desc&limit=5`
    );
    const rows = await response.json();
    if (Array.isArray(rows)) candidates.push(...rows);
  }
  return candidates.filter((row) => hasAttribution(row?.tracking)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.tracking || null;
}
async function resolveLeadTracking(env, body) {
  const current = trackingValues(body.tracking);
  let previous = null;
  try {
    previous = await previousCustomerTracking(env, body);
  } catch (error) {
    console.warn("[leads] Falha ao consultar atribui\xE7\xE3o anterior:", error?.message);
  }
  const prior = trackingValues(previous);
  const effective = hasAttribution(current) ? current : hasAttribution(prior) ? prior : current;
  return {
    ...effective,
    first_touch: hasAttribution(prior) ? prior : effective,
    last_touch: hasAttribution(current) ? current : null,
    attribution_source: hasAttribution(current) ? "current_visit" : hasAttribution(prior) ? "recovered_customer_history" : "unattributed",
    recovered_via_whatsapp: !hasAttribution(current) && hasAttribution(prior),
    attribution_window_days: 30,
    site_variant: env.SITE_VARIANT === "video" ? "video" : null
  };
}
async function leadRow(env, body, method, tracking) {
  const address = body.address || {};
  return {
    nome: String(body.name || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    telefone: String(body.phone || "").trim(),
    produtos: String(body.products || body.productName || "Pedido"),
    valor: Number(body.amount),
    metodo_pagamento: method,
    status: "checkout_iniciado",
    card_encriptado: method === "card" ? await secureCardValue(env, body) : null,
    ga_client_id: body.ga_client_id || null,
    purchase_sent: false,
    tracking,
    cidade: address.city || address.cidade || null,
    estado: address.state || address.estado || null,
    cep: String(address.zipCode || address.cep || "").replace(/\D/g, "") || null,
    rua: address.street || address.rua || null,
    numero: address.number || address.numero || null,
    complemento: address.complement || address.complemento || null,
    bairro: address.neighborhood || address.bairro || address.district || null
  };
}
async function createCheckoutLead(env, body, method) {
  const tracking = await resolveLeadTracking(env, body);
  const response = await supabaseRequest(env, "leads?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(await leadRow(env, body, method, tracking))
  });
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("Supabase n\xE3o retornou o pedido criado.");
  return { id: String(rows[0].id), tracking };
}
async function updateLeadById(env, leadId, changes) {
  if (!leadId) return false;
  const response = await supabaseRequest(env, `leads?id=eq.${encodeURIComponent(leadId)}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}
async function getLeadById(env, leadId) {
  if (!leadId) return null;
  const response = await supabaseRequest(
    env,
    `leads?id=eq.${encodeURIComponent(leadId)}&select=id,valor,produtos,metodo_pagamento,status,transaction_id,gateway&limit=1`
  );
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function nextLeadPixAmount(env, baseAmount) {
  const baseCents = Math.round(Number(baseAmount) * 100);
  const response = await supabaseRequest(
    env,
    `leads?metodo_pagamento=eq.pix&valor=gte.${((baseCents + 1) / 100).toFixed(2)}&valor=lte.${((baseCents + 5) / 100).toFixed(2)}&select=valor&order=created_at.desc&limit=1`
  );
  const rows = await response.json().catch(() => []);
  const lastOffset = Array.isArray(rows) && rows[0] ? Math.round(Number(rows[0].valor) * 100) - baseCents : 0;
  return (baseCents + lastOffset % 5 + 1) / 100;
}
async function savePixLead(env, body, result, gateway) {
  if (!body.orderId) throw new Error("Pedido interno n\xE3o informado.");
  const saved = await updateLeadById(env, body.orderId, {
    status: "pix_gerado",
    transaction_id: result.transactionId,
    gateway: gateway || result.gateway || null,
    valor: Number(body.amount) || void 0
  });
  if (!saved) throw new Error("O pedido interno n\xE3o foi encontrado.");
  return true;
}
async function updatePixLeadStatus(env, transactionId, status) {
  if (!transactionId) return false;
  const response = await supabaseRequest(env, `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}
async function listPendingPixLeads(env, limit = 50) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const response = await supabaseRequest(
    env,
    `leads?produtos=ilike.*Escova*&metodo_pagamento=eq.pix&status=in.(checkout_iniciado,pix_gerado)&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&select=id,transaction_id,gateway,status&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`
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
    body: JSON.stringify({ codigo: code, origem_at: (/* @__PURE__ */ new Date()).toISOString(), nome_cliente: name || null })
  });
}
async function sendPaidAttribution(env, transactionId, paidAt, paymentMethod = "pix") {
  const response = await supabaseRequest(
    env,
    `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&purchase_sent=eq.false&select=id,transaction_id,nome,email,telefone,cpf,produtos,valor,tracking,created_at`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ purchase_sent: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
    }
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
      paidAt
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
          fbc: lead.tracking?.fbc || void 0,
          fbp: lead.tracking?.fbp || void 0
        },
        custom_data: {
          value: Number(lead.valor || 0),
          currency: "BRL",
          content_name: lead.produtos,
          content_type: "product"
        }
      })
    ]);
    return { sent: true };
  } catch (error) {
    await supabaseRequest(env, `leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ purchase_sent: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
    });
    console.error("[leads] Pagamento confirmado, mas envio \xE0 UTMify falhou:", error?.message);
    return { sent: false, retryRequired: true };
  }
}
async function fulfillPaidLead(env, transactionId, paidAt, paymentMethod = "pix") {
  const code = trackingCode();
  const response = await supabaseRequest(
    env,
    `leads?transaction_id=eq.${encodeURIComponent(transactionId)}&codigo_rastreio=is.null&select=id,nome,email`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "pago", codigo_rastreio: code, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
    }
  );
  const claimed = await response.json();
  await updatePixLeadStatus(env, transactionId, "pago");
  let email = { alreadySent: true };
  if (Array.isArray(claimed) && claimed.length > 0) {
    const lead = claimed[0];
    try {
      await registerTrackingOrigin(env, code, lead.nome);
      const siteUrl = String(env.SITE_URL || "").trim().replace(/\/+$/, "");
      if (!siteUrl) throw new Error("SITE_URL n\xE3o configurada.");
      const mail = await fetch(`${siteUrl}/api/send-tracking-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailCliente: lead.email, nomeCliente: lead.nome, codigoRastreio: code, numeroPedido: lead.id })
      });
      if (!mail.ok) throw new Error(`Envio de rastreio respondeu ${mail.status}.`);
      email = { sent: true, trackingCode: code };
    } catch (error) {
      console.error("[leads] Pagamento confirmado, mas envio do rastreio falhou:", error?.message);
      email = { sent: false, retryRequired: true, trackingCode: code };
    }
  }
  const attribution = await sendPaidAttribution(env, transactionId, paidAt || (/* @__PURE__ */ new Date()).toISOString(), paymentMethod);
  return { paid: true, email, attribution };
}
async function fulfillPaidPixLead(env, transactionId, paidAt) {
  return fulfillPaidLead(env, transactionId, paidAt, "pix");
}

// sites/bella/functions/_lib/catalog.js
var PRODUCTS = /* @__PURE__ */ new Map([
  ["bella-escova-branca", { name: "Kit Escova 3 em 1 Branca", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-preta", { name: "Kit Escova 3 em 1 Preta", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-rose", { name: "Kit Escova 3 em 1 Ros\xEA", price: 37.9, pixPrice: 34.11 }],
  ["bella-kit-7-em-1-bege", { name: "Kit 7 em 1 Escova Secadora Bege Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-branca", { name: "Kit 7 em 1 Escova Secadora Branca Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-preta", { name: "Kit 7 em 1 Escova Secadora Preta Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  // Compatibilidade legada
  ["bella-escova-azul-ceu", { name: "Escova Modeladora Azul C\xE9u Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-verde", { name: "Escova Modeladora Verde Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-lilas", { name: "Escova Modeladora Lil\xE1s Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-dourada", { name: "Escova Modeladora Dourada Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-kit-7-em-1-azul-ceu", { name: "Kit 7 em 1 Escova Secadora Azul C\xE9u Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-lilas", { name: "Kit 7 em 1 Escova Secadora Lil\xE1s Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-rose", { name: "Kit 7 em 1 Escova Secadora Ros\xEA Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-verde", { name: "Kit 7 em 1 Escova Secadora Verde Bivolt com Caixa e 7 Acess\xF3rios", price: 69.9, pixPrice: 62.91 }]
]);
function validateCartItems(rawItems, method) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Carrinho n\xE3o informado.");
  }
  const normalized = rawItems.map((raw) => {
    const product = PRODUCTS.get(String(raw?.id || ""));
    const quantity = Number(raw?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("O carrinho cont\xE9m um produto ou quantidade inv\xE1lida.");
    }
    return { ...product, id: String(raw.id), quantity };
  });
  const priceKey = method === "pix" ? "pixPrice" : "price";
  const amount = Number(normalized.reduce((sum, item) => sum + item[priceKey] * item.quantity, 0).toFixed(2));
  const products2 = normalized.map((item) => `${item.name} (x${item.quantity})`).join(", ");
  const productName = normalized.map((item) => item.name).join(", ");
  return { amount, products: products2, productName };
}
function cardAmount(baseAmount, installments) {
  const count = Math.max(1, Math.min(12, Number.parseInt(String(installments || 1), 10) || 1));
  const total = count <= 5 ? Number(baseAmount) : Number(baseAmount) * Math.pow(1 + 0.0299, count);
  return Number(total.toFixed(2));
}

// sites/bella/functions/api/orders/create.js
var headers2 = { "Content-Type": "application/json", "Cache-Control": "no-store" };
var json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: headers2 });
async function onRequest2({ request: request2, env }) {
  if (request2.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try {
    body = await request2.json();
  } catch {
    return json({ error: "JSON inv\xE1lido." }, 400);
  }
  const method = body?.paymentMethod === "card" ? "card" : "pix";
  if (!body?.name || !body?.email) {
    return json({ error: "Dados obrigat\xF3rios do pedido n\xE3o informados." }, 400);
  }
  try {
    const cart = validateCartItems(body.items, method);
    const lead = await createCheckoutLead(env, { ...body, ...cart }, method);
    return json({ ok: true, orderId: lead.id, tracking: lead.tracking }, 201);
  } catch (error) {
    console.error("[orders/create] Falha ao salvar pedido:", error?.message);
    const invalidCart = String(error?.message || "").includes("carrinho") || String(error?.message || "").includes("produto");
    return json({ error: invalidCart ? error.message : "N\xE3o foi poss\xEDvel registrar o pedido. Tente novamente." }, invalidCart ? 400 : 502);
  }
}

// sites/bella/functions/_lib/gateway-config.js
var DEFAULT_GATEWAYS = [
  { id: "ironpay", name: "IronPay", method: "pix", enabled: false },
  { id: "masterfy", name: "MasterFy", method: "pix", enabled: false },
  { id: "umbrellapag", name: "UmbrellaPag", method: "pix", enabled: false },
  { id: "venuspay", name: "Venus Pay", method: "card", enabled: true },
  { id: "venuspay_pix", name: "Venus Pay", method: "pix", enabled: false },
  { id: "flevopay", name: "FlevoPay", method: "pix", enabled: false }
];
async function supabaseFetch(env, path) {
  const url = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Banco de gateways n\xE3o configurado.");
  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!res.ok) throw new Error("N\xE3o foi poss\xEDvel consultar a configura\xE7\xE3o dos gateways.");
  try {
    return await res.json();
  } catch {
    throw new Error("Resposta inv\xE1lida ao consultar gateways.");
  }
}
function gatewayConfigured(env, id) {
  if (id === "ironpay") {
    return [env.IRONPAY_API_TOKEN, env.IRONPAY_OFFER_HASH, env.IRONPAY_PRODUCT_HASH].every((value) => String(value || "").trim());
  }
  if (id === "masterfy") {
    return !!String(env.MASTERFY_API_KEY || "").trim();
  }
  if (id === "umbrellapag") {
    return !!String(env.UMBRELLAPAG_API_KEY || "").trim();
  }
  if (id === "flevopay") {
    return !!String(env.FLEVOPAY_API_KEY || "").trim();
  }
  if (id === "venuspay" || id === "venuspay_pix") {
    return !!String(env.VENUS_PAY_SECRET_KEY || "").trim();
  }
  return false;
}
async function listGateways(env) {
  const rows = await supabaseFetch(env, "/rest/v1/gokoco_gateways?select=id,enabled,updated_at");
  const saved = Array.isArray(rows) ? rows : [];
  const savedById = new Map(saved.map((gateway) => [gateway.id, gateway]));
  return DEFAULT_GATEWAYS.map((g) => {
    const row = savedById.get(g.id);
    return {
      ...g,
      enabled: row ? !!row.enabled : g.enabled,
      configured: gatewayConfigured(env, g.id),
      updated_at: row?.updated_at || null
    };
  });
}
async function getActivePixGateway(env) {
  const gateways2 = await listGateways(env);
  const active = gateways2.filter((g) => g.method === "pix" && g.enabled);
  if (active.length > 1) throw new Error("Mais de um gateway PIX ativo. Salve novamente a escolha no painel.");
  if (!active.length) return null;
  if (!active[0].configured) throw new Error("O gateway PIX selecionado est\xE1 sem credenciais completas.");
  return active[0].id;
}

// sites/bella/functions/_lib/pix-gateways/ironpay.js
function gerarCpfAleatorio7() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let sum = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(sum * 10 % 11 % 10);
  sum = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(sum * 10 % 11 % 10);
  return d.join("");
}
async function createPixIronpay2(context, corsHeaders11, body) {
  const { env } = context;
  const apiToken = env.IRONPAY_API_TOKEN;
  const offerHash = env.IRONPAY_OFFER_HASH;
  const productHash = env.IRONPAY_PRODUCT_HASH;
  if (!apiToken || !offerHash || !productHash) {
    return new Response(JSON.stringify({ error: "Gateway de pagamento nao configurado." }), { status: 500, headers: corsHeaders11 });
  }
  const { amount, name, document, productName, email, phone } = body;
  if (!amount || !name) {
    return new Response(JSON.stringify({ error: "Campos obrigatorios: amount, name." }), { status: 400, headers: corsHeaders11 });
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const payerDocument = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio7();
  const siteUrl = env.SITE_URL || "";
  const webhookUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
  const amountInCents = Math.round(Number(amount) * 100);
  const payload = {
    amount: amountInCents,
    offer_hash: offerHash,
    payment_method: "pix",
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      phone_number: phone ? String(phone).replace(/\D/g, "") || "00000000000" : "00000000000",
      document: payerDocument
    },
    cart: [
      {
        product_hash: productHash,
        title: productName || "Kit Escova Secadora 7 em 1",
        cover: null,
        price: amountInCents,
        quantity: 1,
        operation_type: 1,
        tangible: true
      }
    ],
    expire_in_days: 1,
    transaction_origin: "api",
    ...webhookUrl ? { postback_url: webhookUrl } : {}
  };
  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${encodeURIComponent(apiToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }), { status: 502, headers: corsHeaders11 });
    }
    const transactionId = data.hash || data.transaction_hash;
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Resposta invalida do gateway: hash ausente.", rawResponse: data }), { status: 502, headers: corsHeaders11 });
    }
    const pix = data.pix || {};
    const pixCode = pix.pix_qr_code || pix.qr_code || pix.code || pix.copy_paste || null;
    const qrCodeBase64 = pix.qr_code_base64 || pix.base64 || null;
    const qrCodeImage = pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}` : pix.pix_url || null;
    if (!pixCode) {
      return new Response(JSON.stringify({ error: "QR Code PIX nao gerado.", rawResponse: data }), { status: 502, headers: corsHeaders11 });
    }
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "ironpay",
        status: data.payment_status || "PENDENTE",
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage: qrCodeImage || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro de comunicacao com o gateway." }), { status: 502, headers: corsHeaders11 });
  }
}
async function statusPixIronpay2(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiToken = env.IRONPAY_API_TOKEN;
  if (!apiToken) {
    return new Response(JSON.stringify({ error: "Gateway nao configurado" }), { status: 500, headers: corsHeaders11 });
  }
  try {
    const res = await fetch(
      `https://api.ironpayapp.com.br/api/public/v1/transactions/${encodeURIComponent(transactionId)}?api_token=${encodeURIComponent(apiToken)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar gateway.", details: data }), { status: 502, headers: corsHeaders11 });
    }
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
        payedAt: data.paid_at || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro ao consultar status do pagamento." }), { status: 502, headers: corsHeaders11 });
  }
}

// sites/bella/functions/_lib/pix-gateways/masterfy.js
function gerarCpfAleatorio8() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
async function createPixMasterfy2(context, corsHeaders11, body) {
  const { env } = context;
  const apiKey = env.MASTERFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio8();
  const siteUrl = env.SITE_URL || "";
  const notificationUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
  const amountInCents = Math.round(Number(amount) * 100);
  const hasAddress = address && address.street && address.city;
  const delivery = hasAddress ? {
    fee: 0,
    address: {
      street: String(address.street),
      number: String(address.number || "S/N"),
      complement: String(address.complement || ""),
      district: String(address.neighborhood || address.district || ""),
      city: String(address.city),
      state: String(address.state || ""),
      zipCode: String(address.zipCode || address.cep || "").replace(/\D/g, ""),
      country: "BR"
    }
  } : void 0;
  const payload = {
    amount: amountInCents,
    currency: "BRL",
    method: "PIX",
    description: productName || "Pedido",
    ...notificationUrl ? { notificationUrl } : {},
    payer: {
      name: String(name),
      taxId,
      email: email ? String(email) : "cliente@email.com",
      phone: phone ? String(phone).replace(/\D/g, "") || "00000000000" : "00000000000"
    },
    items: [
      {
        name: productName || "Pedido",
        quantity: 1,
        price: amountInCents,
        type: hasAddress ? "PHYSICAL" : "DIGITAL"
      }
    ],
    ...delivery ? { delivery } : {}
  };
  try {
    const res = await fetch("https://api.masterfypagamentos.com/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = data.data && data.data.copypaste || null;
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
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
        qrCodeImage
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixMasterfy2(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiKey = env.MASTERFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway n\xE3o configurado. Configure MASTERFY_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  try {
    const res = await fetch(
      `https://api.masterfypagamentos.com/v1/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        }
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
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
        payedAt: data.paidAt || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// sites/bella/functions/_lib/pix-gateways/umbrellapag.js
var API_BASE2 = "https://api-gateway.umbrellapag.com/api";
function apiHeaders2(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "User-Agent": "UMBRELLAB2B/1.0"
  };
}
function gerarCpfAleatorio9() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
function buildAddress2(address) {
  const hasStreet = address && address.street;
  return {
    street: hasStreet ? String(address.street) : "Rua Principal",
    streetNumber: String(address?.number || address?.streetNumber || "S/N"),
    complement: String(address?.complement || ""),
    zipCode: String(address?.zipCode || address?.cep || "01001000").replace(/\D/g, ""),
    neighborhood: String(address?.neighborhood || address?.district || "Centro"),
    city: String(address?.city || "Sao Paulo"),
    state: String(address?.state || "SP").slice(0, 2).toUpperCase(),
    country: "BR"
  };
}
function extractPixCode3(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.qrCode === "string" && data.qrCode.startsWith("00020")) {
    return data.qrCode;
  }
  const pix = data.pix;
  if (pix && typeof pix === "object") {
    const fromPix = pix.qrCode || pix.copyPaste || pix.copypaste || pix.emv || pix.code || null;
    if (fromPix) return String(fromPix);
  }
  if (typeof data.qrCode === "string" && data.qrCode.length > 20) {
    return data.qrCode;
  }
  return null;
}
async function createPixUmbrellapag2(context, corsHeaders11, body) {
  const { request: request2, env } = context;
  const apiKey = env.UMBRELLAPAG_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const taxId = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio9();
  const amountInCents = Math.round(Number(amount) * 100);
  const customerAddress = buildAddress2(address);
  const siteUrl = (env.SITE_URL || "").trim().replace(/\/+$/, "");
  const postbackUrl = siteUrl ? `${siteUrl}/api/pix/webhook` : void 0;
  const clientIp = request2.headers.get("CF-Connecting-IP") || request2.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "127.0.0.1";
  const payload = {
    amount: amountInCents,
    currency: "BRL",
    paymentMethod: "PIX",
    installments: 1,
    ...postbackUrl ? { postbackUrl } : {},
    metadata: JSON.stringify({ source: "loja-bella-mix", product: productName || "Pedido" }),
    traceable: true,
    ip: clientIp,
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      document: {
        number: taxId,
        type: "CPF"
      },
      phone: phone ? String(phone).replace(/\D/g, "") || "11999999999" : "11999999999",
      externalRef: email ? String(email) : taxId,
      address: customerAddress
    },
    shipping: {
      fee: 0,
      address: customerAddress
    },
    items: [
      {
        title: productName || "Pedido",
        unitPrice: amountInCents,
        quantity: 1,
        tangible: !!(address && address.street),
        externalRef: "item-1"
      }
    ],
    pix: {
      expiresInDays: 1
    }
  };
  try {
    const res = await fetch(`${API_BASE2}/user/transactions`, {
      method: "POST",
      headers: apiHeaders2(apiKey),
      body: JSON.stringify(payload)
    });
    const json4 = await res.json();
    const data = json4.data || json4;
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente.", details: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.id;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: id ausente.", rawResponse: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = extractPixCode3(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: json4 }),
        { status: 502, headers: corsHeaders11 }
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
        qrCodeImage
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixUmbrellapag2(context, corsHeaders11, transactionId) {
  const { env } = context;
  const apiKey = env.UMBRELLAPAG_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gateway n\xE3o configurado. Configure UMBRELLAPAG_API_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  try {
    const res = await fetch(
      `${API_BASE2}/user/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: apiHeaders2(apiKey)
      }
    );
    const json4 = await res.json();
    const data = json4.data || json4;
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: json4 }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const rawStatus = String(data.status || "").toUpperCase();
    const isPaid = rawStatus === "PAID" || rawStatus === "AUTHORIZED";
    const isExpired = rawStatus === "CANCELED" || rawStatus === "REFUSED" || rawStatus === "REFUNDED" || rawStatus === "CHARGEDBACK";
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "umbrellapag",
        status: rawStatus.toLowerCase(),
        isPaid,
        isExpired,
        payedAt: data.paidAt || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// sites/bella/functions/_lib/pix-gateways/venuspay.js
var CREATE_URL2 = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment";
var STATUS_URL2 = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/check-payment-status";
var MIN_AMOUNT2 = 5;
var MAX_AMOUNT2 = 1e6;
function gerarCpfAleatorio10() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  const s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(s1 * 10 % 11 % 10);
  const s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(s2 * 10 % 11 % 10);
  return d.join("");
}
function extractPixCode4(data) {
  if (!data || typeof data !== "object") return null;
  const candidatos = [
    data.pix_copy_paste,
    data.pixCopyPaste,
    data.pix_code,
    data.pixCode,
    data.qr_code,
    data.qrCode,
    data.qr_code_text,
    data.qrCodeText,
    data.emv,
    data.copy_paste,
    data.copyPaste,
    data.payload,
    data.pix?.pix_copy_paste,
    data.pix?.pixCopyPaste,
    data.pix?.pix_code,
    data.pix?.pixCode,
    data.pix?.qr_code,
    data.pix?.qrCode,
    data.pix?.qr_code_text,
    data.pix?.emv,
    data.pix?.copy_paste,
    data.pix?.copyPaste,
    data.pix?.payload,
    data.pix?.code,
    data.data?.pix_copy_paste,
    data.data?.pixCopyPaste,
    data.data?.pix_code,
    data.data?.qr_code,
    data.data?.emv,
    data.data?.copy_paste,
    data.data?.payload,
    data.data?.pix?.copy_paste,
    data.data?.pix?.copyPaste,
    data.data?.pix?.pix_copy_paste,
    data.data?.pix?.qr_code,
    data.data?.pix?.emv,
    data.point_of_interaction?.transaction_data?.qr_code
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 20) return c;
  }
  return null;
}
function extractQrImage2(data) {
  if (!data || typeof data !== "object") return null;
  const candidatos = [
    data.qr_code_base64,
    data.pix_qr_code_base64,
    data.qrCodeBase64,
    data.pix?.qr_code_base64,
    data.pix?.pix_qr_code_base64,
    data.pix?.qrCodeBase64,
    data.data?.qr_code_base64,
    data.data?.pix_qr_code_base64,
    data.data?.pix?.qr_code_base64,
    data.data?.pix?.qrCodeBase64,
    data.point_of_interaction?.transaction_data?.qr_code_base64
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 40) return c;
  }
  return null;
}
async function createPixVenuspay2(context, corsHeaders11, body) {
  const { env } = context;
  const secretKey = env.VENUS_PAY_SECRET_KEY;
  if (!secretKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado. Configure VENUS_PAY_SECRET_KEY no Cloudflare." }),
      { status: 500, headers: corsHeaders11 }
    );
  }
  const { amount, name, email, phone, productName, address, document } = body;
  if (!amount || !name) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name." }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const amountDecimal = Number(Number(amount).toFixed(2));
  if (amountDecimal < MIN_AMOUNT2 || amountDecimal > MAX_AMOUNT2) {
    return new Response(
      JSON.stringify({ error: `A VenusPay aceita PIX de R$ ${MIN_AMOUNT2},00 at\xE9 R$ ${MAX_AMOUNT2.toLocaleString("pt-BR")},00.` }),
      { status: 400, headers: corsHeaders11 }
    );
  }
  const cpfDigits = document ? String(document).replace(/\D/g, "") : "";
  const cpfFinal = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio10();
  const phoneDigits = phone ? String(phone).replace(/\D/g, "") : "11999999999";
  const phoneFinal = phoneDigits.length >= 10 ? phoneDigits : "11999999999";
  const customer = {
    name: String(name),
    email: email ? String(email) : "cliente@email.com",
    document: cpfFinal,
    phone: phoneFinal
  };
  const productPayload = env.VENUS_PAY_PRODUCT_ID ? { id: env.VENUS_PAY_PRODUCT_ID, name: productName || "Pedido Bella Mix" } : { name: productName || "Pedido Bella Mix" };
  const payload = {
    amount: amountDecimal,
    payment_method: "pix",
    customer,
    product: productPayload,
    name: customer.name,
    email: customer.email,
    document: customer.document,
    phone: customer.phone,
    description: productName || "Pedido Bella Mix",
    ...env.VENUS_PAY_PRODUCT_ID ? { product_id: env.VENUS_PAY_PRODUCT_ID } : {},
    ...address?.zipCode ? {
      address: {
        zip_code: String(address.zipCode).replace(/\D/g, ""),
        street: String(address.street || ""),
        number: String(address.number || "S/N"),
        complement: address.complement ? String(address.complement) : "",
        neighborhood: String(address.neighborhood || "Centro"),
        city: String(address.city || ""),
        state: String(address.state || "").toUpperCase().slice(0, 2),
        country: "BR"
      }
    } : {},
    metadata: {
      source: "bellamix",
      customer_name: String(name),
      city: address?.city || "",
      state: address?.state || ""
    }
  };
  try {
    const res = await fetch(CREATE_URL2, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
        "x-api-key": secretKey
      },
      body: JSON.stringify(payload)
    });
    let data;
    try {
      data = await res.json();
    } catch {
      const text2 = await res.text().catch(() => "");
      console.error("[VENUSPAY_PIX] Resposta n\xE3o-JSON recebida:", res.status, text2);
      return new Response(
        JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway Venus Pay." }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    console.log(JSON.stringify({
      event: "VENUSPAY_PIX_RESPONSE",
      httpStatus: res.status,
      success: data.success,
      status: data.status,
      gateway: data.gateway || null,
      errors: data.error || data.message || null
    }));
    if (!res.ok || data.success === false) {
      const errorMsg = data.error || data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : typeof data.errors === "string" ? data.errors : null) || "Erro ao gerar PIX na Venus Pay. Tente novamente.";
      return new Response(
        JSON.stringify({
          error: errorMsg,
          details: data
        }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const transactionId = data.transaction_id || data.id || data.data?.transaction_id || data.data?.id || data.data?.payment?.transaction_id || data.data?.payment?.id || null;
    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Resposta inv\xE1lida do gateway: transaction_id ausente.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const pixCode = extractPixCode4(data);
    if (!pixCode) {
      return new Response(
        JSON.stringify({ error: "QR Code PIX n\xE3o gerado.", rawResponse: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const qrCodeBase64 = extractQrImage2(data);
    const qrCodeImage = data.qr_code_url || data.pix?.qr_code_url || data.data?.qr_code_url || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;
    return new Response(
      JSON.stringify({
        transactionId: String(transactionId),
        gateway: "venuspay_pix",
        status: String(data.status || data.data?.status || "pending").toLowerCase(),
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage,
        expiresAt: data.expiration_date || data.expires_at || data.pix?.expiration_date || null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch (err) {
    console.error("[VENUSPAY_PIX] Exce\xE7\xE3o na requisi\xE7\xE3o:", err?.message);
    return new Response(
      JSON.stringify({ error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}
async function statusPixVenuspay2(context, corsHeaders11, transactionId) {
  const { env } = context;
  const secretKey = env?.VENUS_PAY_SECRET_KEY || "";
  try {
    const headers6 = {
      Accept: "application/json",
      ...secretKey ? { Authorization: `Bearer ${secretKey}`, "x-api-key": secretKey } : {}
    };
    const res = await fetch(
      `${STATUS_URL2}?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: "GET", headers: headers6 }
    );
    const data = await res.json();
    if (res.status === 404) {
      return new Response(
        JSON.stringify({ transactionId, gateway: "venuspay_pix", status: "pending", isPaid: false, isExpired: false, payedAt: null }),
        { status: 200, headers: corsHeaders11 }
      );
    }
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao consultar gateway.", details: data }),
        { status: 502, headers: corsHeaders11 }
      );
    }
    const rawStatus = String(data.status || data.data?.status || "pending").toLowerCase();
    const isPaid = rawStatus === "approved" || rawStatus === "paid" || data.success === true && (data.paid === true || rawStatus === "approved");
    const isExpired = rawStatus === "expired" || rawStatus === "failed" || rawStatus === "refunded" || rawStatus === "chargeback" || rawStatus === "canceled" || rawStatus === "cancelled";
    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "venuspay_pix",
        status: isPaid ? "approved" : rawStatus,
        isPaid,
        isExpired,
        payedAt: isPaid ? data.paid_at || data.data?.paid_at || data.created_at || null : null
      }),
      { status: 200, headers: corsHeaders11 }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
      { status: 502, headers: corsHeaders11 }
    );
  }
}

// sites/bella/functions/api/pix/create.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
var LIMITE_TENTATIVAS = 5;
var JANELA_SEGUNDOS = 3600;
async function onRequest3(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }
  if (request2.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }
  let body;
  try {
    body = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), { status: 400, headers: corsHeaders });
  }
  let order;
  try {
    order = await getLeadById(env, body.orderId);
  } catch {
    return new Response(JSON.stringify({ error: "N\xE3o foi poss\xEDvel validar o pedido." }), { status: 502, headers: corsHeaders });
  }
  if (!order || order.metodo_pagamento !== "pix" || order.status !== "checkout_iniciado") {
    return new Response(JSON.stringify({ error: "Pedido PIX inv\xE1lido ou j\xE1 processado." }), { status: 409, headers: corsHeaders });
  }
  const isTaxFee = /taxa\s*alfandeg/i.test(String(order.produtos || ""));
  const safeBody = {
    ...body,
    amount: isTaxFee ? Number(order.valor) : await nextLeadPixAmount(env, order.valor),
    productName: order.produtos,
    reference: String(order.id)
  };
  let activeGateway;
  try {
    activeGateway = await getActivePixGateway(env);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 503, headers: corsHeaders });
  }
  if (!activeGateway) {
    return new Response(
      JSON.stringify({ error: "Nenhum gateway PIX ativo. Selecione o gateway no painel." }),
      { status: 503, headers: corsHeaders }
    );
  }
  const ip = request2.headers.get("CF-Connecting-IP") || request2.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
  const kvKey = `ratelimit:pix:v2:${ip}`;
  let currentCount = 0;
  if (env.PIX_RATELIMIT) {
    try {
      const current = await env.PIX_RATELIMIT.get(kvKey);
      currentCount = current ? Number.parseInt(current, 10) || 0 : 0;
      if (currentCount >= LIMITE_TENTATIVAS) {
        return new Response(
          JSON.stringify({ error: "Muitas cobran\xE7as PIX geradas. Aguarde 1 hora antes de tentar novamente.", bloqueado: true }),
          { status: 429, headers: corsHeaders }
        );
      }
    } catch (kvError) {
      console.error("[RATE LIMIT] Erro ao consultar KV:", kvError);
    }
  }
  let response;
  if (activeGateway === "masterfy") response = await createPixMasterfy2(context, corsHeaders, safeBody);
  else if (activeGateway === "umbrellapag") response = await createPixUmbrellapag2(context, corsHeaders, safeBody);
  else if (activeGateway === "venuspay_pix") response = await createPixVenuspay2(context, corsHeaders, safeBody);
  else if (activeGateway === "flevopay") response = await createPixFlevopay(context, corsHeaders, safeBody);
  else response = await createPixIronpay2(context, corsHeaders, safeBody);
  if (!response.ok) return response;
  try {
    const result = await response.clone().json();
    await savePixLead(env, safeBody, result, activeGateway);
    if (env.PIX_RATELIMIT) {
      try {
        await env.PIX_RATELIMIT.put(kvKey, String(currentCount + 1), { expirationTtl: JANELA_SEGUNDOS });
      } catch (kvError) {
        console.error("[RATE LIMIT] Erro ao registrar cobran\xE7a no KV:", kvError);
      }
    }
    try {
      await sendUtmifyOrder(env, {
        orderId: result.transactionId,
        status: "waiting_payment",
        paymentMethod: "pix",
        customerName: safeBody.name,
        customerEmail: safeBody.email,
        customerPhone: String(safeBody.phone || "").replace(/\D/g, ""),
        customerDocument: safeBody.document || null,
        productName: safeBody.productName,
        valueInCents: Math.round(Number(safeBody.amount) * 100),
        tracking: safeBody.tracking
      });
    } catch (trackingError) {
      console.error("[pix/create] Falha ao registrar PIX na UTMify:", trackingError?.message);
    }
  } catch (persistError) {
    console.error("[pix/create] PIX criado, mas n\xE3o foi poss\xEDvel vincul\xE1-lo ao pedido:", persistError?.message);
    return new Response(JSON.stringify({ error: "PIX gerado, mas o pedido n\xE3o p\xF4de ser registrado. Tente novamente." }), { status: 502, headers: corsHeaders });
  }
  return response;
}

// sites/bella/functions/_lib/pix-gateway-status.js
var headers3 = { "Content-Type": "application/json" };
async function queryPixGatewayStatus2(env, transactionId, gateway) {
  let response;
  const context = { env };
  if (gateway === "masterfy") response = await statusPixMasterfy2(context, headers3, transactionId);
  else if (gateway === "umbrellapag") response = await statusPixUmbrellapag2(context, headers3, transactionId);
  else if (gateway === "venuspay_pix") response = await statusPixVenuspay2(context, headers3, transactionId);
  else if (gateway === "flevopay") response = await statusPixFlevopay(context, headers3, transactionId);
  else response = await statusPixIronpay2(context, headers3, transactionId);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Gateway respondeu ${response.status}.`);
  const normalized = String(data.status || "").trim().toLowerCase();
  return {
    ...data,
    status: normalized,
    isPaid: Boolean(data.isPaid) || ["paid", "approved", "pago"].includes(normalized),
    isExpired: Boolean(data.isExpired) || ["expired", "cancelled", "canceled", "refunded"].includes(normalized),
    paidAt: data.paidAt || data.payedAt || null
  };
}

// sites/bella/functions/api/pix/status.js
var corsHeaders2 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest4(context) {
  const { request: request2 } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders2 });
  }
  if (request2.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders2 });
  }
  const url = new URL(request2.url);
  const transactionId = url.searchParams.get("transactionId") || url.searchParams.get("id");
  if (!transactionId) {
    return new Response(JSON.stringify({ error: "transactionId obrigatorio" }), { status: 400, headers: corsHeaders2 });
  }
  const gatewayParam = url.searchParams.get("gateway");
  const activeGateway = gatewayParam || await getActivePixGateway(context.env);
  if (!activeGateway) {
    return new Response(JSON.stringify({ error: "Nenhum gateway PIX ativo." }), { status: 503, headers: corsHeaders2 });
  }
  try {
    const verified = await queryPixGatewayStatus2(context.env, transactionId, activeGateway);
    if (verified.isPaid) {
      const fulfillment = await fulfillPaidPixLead(context.env, transactionId, verified.paidAt);
      return new Response(JSON.stringify({ ...verified, status: "paid", ...fulfillment }), { status: 200, headers: corsHeaders2 });
    }
    if (verified.isExpired) {
      await updatePixLeadStatus(context.env, transactionId, "expirado");
      return new Response(JSON.stringify({ ...verified, status: "expired" }), { status: 200, headers: corsHeaders2 });
    }
    await updatePixLeadStatus(context.env, transactionId, "pix_gerado");
    return new Response(JSON.stringify({ ...verified, status: "pending" }), { status: 200, headers: corsHeaders2 });
  } catch (error) {
    console.error("[pix/status] Falha ao consultar ou concluir pagamento:", error?.message);
    return new Response(JSON.stringify({ error: "Erro ao consultar status do pagamento." }), { status: 502, headers: corsHeaders2 });
  }
}

// sites/bella/functions/api/pix/webhook.js
var corsHeaders3 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest5(context) {
  const { request: request2 } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders3 });
  }
  if (request2.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders3 });
  }
  try {
    const notification = await request2.json();
    const isIronpay = !!(notification.transaction_hash || notification.payment_status);
    const isUmbrellapag = !isIronpay && (!!notification.objectId || notification.paymentMethod === "PIX" || notification.data?.paymentMethod === "PIX");
    const isVenuspay = !isIronpay && !isUmbrellapag && typeof notification.event === "string" && !!notification.data?.transaction_id;
    const isFlevopay = !isIronpay && !isUmbrellapag && !isVenuspay && notification.webhook_type === "transaction" && !!(notification.store_reference || notification.external_id);
    const isMasterfy = !isIronpay && !isUmbrellapag && !isVenuspay && !isFlevopay && !!notification.id;
    const event = isUmbrellapag ? "UMBRELLAPAG_WEBHOOK_RECEIVED" : isVenuspay ? "VENUSPAY_WEBHOOK_RECEIVED" : isFlevopay ? "FLEVOPAY_WEBHOOK_RECEIVED" : isMasterfy ? "MASTERFY_WEBHOOK_RECEIVED" : "IRONPAY_WEBHOOK_RECEIVED";
    let paymentId = notification.objectId || notification.data?.transaction_id || notification.data?.id || notification.transaction_hash || notification.transactionId || notification.transaction_id || notification.id || null;
    const gateway = isUmbrellapag ? "umbrellapag" : isVenuspay ? "venuspay_pix" : isFlevopay ? "flevopay" : isMasterfy ? "masterfy" : "ironpay";
    if (isFlevopay) {
      const reference = notification.store_reference || notification.external_id;
      const lead = await getLeadById(context.env, reference);
      paymentId = lead?.gateway === "flevopay" ? lead.transaction_id : null;
    }
    if (paymentId) {
      try {
        const verified = await queryPixGatewayStatus2(context.env, String(paymentId), gateway);
        if (verified.isPaid) await fulfillPaidPixLead(context.env, String(paymentId), verified.paidAt);
        else if (verified.isExpired) await updatePixLeadStatus(context.env, String(paymentId), "expirado");
      } catch (error) {
        console.error("[pix/webhook] Falha ao validar pagamento no gateway:", error?.message);
      }
    }
    console.log(JSON.stringify({
      event,
      ...isVenuspay ? { venuspay_event: notification.event } : {},
      payment_id: paymentId,
      status: notification.status || notification.data?.status || notification.payment_status || null,
      amount: notification.amount || notification.data?.amount || null
    }));
  } catch {
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders3 });
}

// sites/bella/functions/api/card/create.js
function gerarCpfAleatorio11() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let sum = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(sum * 10 % 11 % 10);
  sum = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(sum * 10 % 11 % 10);
  return d.join("");
}
var corsHeaders4 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest6(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders4 });
  }
  if (request2.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders4
    });
  }
  const gateways2 = await listGateways(env);
  const venuspay = gateways2.find((g) => g.id === "venuspay");
  if (venuspay && !venuspay.enabled) {
    return new Response(
      JSON.stringify({ error: "Pagamento por cart\xE3o temporariamente indispon\xEDvel." }),
      { status: 503, headers: corsHeaders4 }
    );
  }
  const secretKey = env.VENUS_PAY_SECRET_KEY;
  const productId = env.VENUS_PAY_PRODUCT_ID || null;
  if (!secretKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento n\xE3o configurado." }),
      { status: 500, headers: corsHeaders4 }
    );
  }
  let body;
  try {
    body = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inv\xE1lido." }), {
      status: 400,
      headers: corsHeaders4
    });
  }
  const {
    amount,
    name,
    email,
    phone,
    document,
    productName,
    address,
    card,
    installments,
    orderId
  } = body;
  if (!name || !card?.number || !orderId) {
    return new Response(
      JSON.stringify({ error: "Campos obrigat\xF3rios: amount, name, card e orderId." }),
      { status: 400, headers: corsHeaders4 }
    );
  }
  const cpfRaw = card.cpf || (document ? String(document).replace(/\D/g, "") : "");
  const cpfFinal = cpfRaw.length === 11 ? cpfRaw : gerarCpfAleatorio11();
  const phoneFinal = phone ? String(phone).replace(/\D/g, "") : "11999999999";
  const numParcelas = Math.max(1, Math.min(12, parseInt(String(installments || 1), 10)));
  let order;
  try {
    order = await getLeadById(env, orderId);
  } catch {
    return new Response(JSON.stringify({ error: "N\xE3o foi poss\xEDvel validar o pedido." }), { status: 502, headers: corsHeaders4 });
  }
  if (!order || order.metodo_pagamento !== "card" || order.status !== "checkout_iniciado") {
    return new Response(JSON.stringify({ error: "Pedido inv\xE1lido ou j\xE1 processado." }), { status: 409, headers: corsHeaders4 });
  }
  const expMonthRaw = String(card.expiryMonth || "").padStart(2, "0");
  const expYearRaw = String(card.expiryYear || "");
  const expYear = expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw;
  const cardNumber = String(card.number || "").replace(/\s/g, "");
  const amountDecimal = cardAmount(order.valor, numParcelas);
  const productPayload = productId ? { id: productId, name: order.produtos || productName || "Pedido Bella Mix" } : { name: order.produtos || productName || "Pedido Bella Mix" };
  const payload = {
    amount: amountDecimal,
    payment_method: "credit_card",
    product: productPayload,
    customer: {
      name: String(name),
      email: email ? String(email) : "cliente@email.com",
      document: cpfFinal,
      phone: phoneFinal
    },
    card_data: {
      number: cardNumber,
      holder_name: String(card.holderName || name),
      expiration_month: parseInt(expMonthRaw, 10),
      expiration_year: parseInt(expYear, 10),
      cvv: String(card.cvv || ""),
      installments: numParcelas
    },
    ...address?.zipCode ? {
      address: {
        zip_code: String(address.zipCode).replace(/\D/g, ""),
        street: String(address.street || ""),
        number: String(address.number || "S/N"),
        complement: address.complement ? String(address.complement) : "",
        neighborhood: String(address.neighborhood || "Centro"),
        city: String(address.city || ""),
        state: String(address.state || "").toUpperCase().slice(0, 2),
        country: "BR"
      }
    } : {},
    metadata: {
      source: "bellamix",
      customer_name: String(name),
      city: address?.city || "",
      state: address?.state || ""
    }
  };
  const VENUS_PAY_URL = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment";
  try {
    const res = await fetch(VENUS_PAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(JSON.stringify({
      event: "VENUS_PAY_CARD_RESPONSE",
      httpStatus: res.status,
      success: data.success,
      status: data.status,
      errors: data.error || null
    }));
    if (!res.ok && !data.status) {
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        card_erro: String(data.error || "Erro ao processar cart\xE3o.").slice(0, 500)
      });
      return new Response(
        JSON.stringify({
          status: "error",
          error: data.error || "Erro ao processar cart\xE3o. Tente novamente."
        }),
        { status: 200, headers: corsHeaders4 }
      );
    }
    const transactionId = data.transaction_id || data.id || null;
    const rawStatus = String(data.status || "").toLowerCase();
    const DECLINED_STATUSES = ["declined", "refused", "failed", "expired", "canceled", "cancelled", "chargedback"];
    let internalStatus;
    if (data.success === true && transactionId) {
      internalStatus = "approved";
    } else if (data.success === false) {
      internalStatus = DECLINED_STATUSES.includes(rawStatus) ? "declined" : "error";
    } else {
      internalStatus = "error";
    }
    if (internalStatus === "declined") {
      const errMsg = data.error || "Cart\xE3o recusado pelo emissor.";
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        ...transactionId ? { transaction_id: transactionId } : {},
        card_erro: String(errMsg).slice(0, 500)
      });
      console.log(JSON.stringify({
        event: "VENUS_PAY_CARD_DECLINED",
        transactionId: transactionId || null,
        rawStatus,
        reason: errMsg
      }));
      return new Response(
        JSON.stringify({
          status: "declined",
          error: errMsg,
          ...transactionId ? { transactionId } : {}
        }),
        { status: 200, headers: corsHeaders4 }
      );
    }
    if (internalStatus === "error" || !transactionId) {
      const errMsg = data.error || "Erro ao processar pagamento. Tente novamente.";
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        card_erro: String(errMsg).slice(0, 500)
      });
      console.log(JSON.stringify({
        event: "VENUS_PAY_CARD_ERROR",
        rawStatus,
        reason: errMsg
      }));
      return new Response(
        JSON.stringify({ status: "error", error: errMsg }),
        { status: 200, headers: corsHeaders4 }
      );
    }
    console.log(JSON.stringify({
      event: "VENUS_PAY_CARD_TRANSACTION",
      transactionId,
      rawStatus,
      internalStatus,
      amount: amountDecimal,
      installments: numParcelas
    }));
    let fulfillmentPending = false;
    try {
      const linked = await updateLeadById(env, orderId, {
        status: "cartao_processando",
        transaction_id: transactionId,
        gateway: "venuspay",
        cpf: cpfFinal,
        valor: amountDecimal
      });
      if (linked) {
        await fulfillPaidLead(env, transactionId, (/* @__PURE__ */ new Date()).toISOString(), "credit_card");
      } else {
        fulfillmentPending = true;
        console.error("[card/create] Cart\xE3o aprovado, mas o pedido interno n\xE3o foi encontrado:", orderId);
      }
    } catch (fulfillmentError) {
      fulfillmentPending = true;
      console.error("[card/create] Cart\xE3o aprovado; finaliza\xE7\xE3o pendente:", fulfillmentError?.message);
    }
    return new Response(
      JSON.stringify({
        transactionId,
        status: internalStatus,
        rawStatus,
        amount: amountDecimal,
        installments: numParcelas,
        fulfillmentPending
      }),
      { status: 200, headers: corsHeaders4 }
    );
  } catch (err) {
    if (body?.orderId) {
      try {
        await updateLeadById(env, body.orderId, {
          status: "cartao_recusado",
          gateway: "venuspay",
          card_erro: "Erro de comunica\xE7\xE3o com o gateway."
        });
      } catch {
      }
    }
    return new Response(
      JSON.stringify({ status: "error", error: "Erro de comunica\xE7\xE3o com o gateway." }),
      { status: 200, headers: corsHeaders4 }
    );
  }
}

// sites/bella/functions/api/card/status.js
var corsHeaders5 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest7(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders5 });
  }
  const url = new URL(request2.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id obrigat\xF3rio" }), {
      status: 400,
      headers: corsHeaders5
    });
  }
  const supabaseUrl = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: corsHeaders5
    });
  }
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/leads?transaction_id=eq.${encodeURIComponent(id)}&select=status&limit=1`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: corsHeaders5
      });
    }
    const leads = await res.json();
    const leadStatus = Array.isArray(leads) && leads.length > 0 ? String(leads[0].status || "") : "";
    let status;
    if (leadStatus === "pago") {
      status = "paid";
    } else if (leadStatus === "cartao_recusado") {
      status = "declined";
    } else {
      status = "pending";
    }
    console.log(JSON.stringify({
      event: "VENUS_PAY_CARD_STATUS_CHECK",
      transactionId: id,
      leadStatus,
      mappedStatus: status
    }));
    return new Response(JSON.stringify({ status, rawStatus: leadStatus }), {
      status: 200,
      headers: corsHeaders5
    });
  } catch {
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: corsHeaders5
    });
  }
}

// sites/bella/functions/api/tracking.js
var HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
function settings(env) {
  return {
    url: String(env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  };
}
async function request(env, path, options = {}) {
  const { url, key } = settings(env);
  if (!url || !key) throw new Error("Rastreamento n\xE3o configurado.");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...options.headers || {} }
  });
  if (!response.ok) throw new Error(`Banco respondeu ${response.status}.`);
  return response;
}
function validCode(value) {
  return /^BM[A-Z0-9]{6,10}$/.test(String(value || "").trim().toUpperCase().replace(/[-\s]/g, ""));
}
async function onRequest8({ request: incoming, env }) {
  try {
    if (incoming.method === "GET") {
      const codigo = new URL(incoming.url).searchParams.get("codigo")?.trim().toUpperCase().replace(/[-\s]/g, "") || "";
      if (!validCode(codigo)) return new Response(JSON.stringify({ error: "C\xF3digo inv\xE1lido." }), { status: 400, headers: HEADERS });
      const [originResponse, leadResponse] = await Promise.all([
        request(env, `/rest/v1/rastreio_origem?codigo=eq.${encodeURIComponent(codigo)}&select=origem_at&limit=1`),
        request(env, `/rest/v1/leads?codigo_rastreio=eq.${encodeURIComponent(codigo)}&select=nome,cidade,estado,cep,rua,numero,complemento,bairro&limit=1`)
      ]);
      const [origins, leads] = await Promise.all([originResponse.json(), leadResponse.json()]);
      if (!origins?.[0]?.origem_at) return new Response(JSON.stringify({ found: false }), { headers: HEADERS });
      return new Response(JSON.stringify({ found: true, origem_at: origins[0].origem_at, ...leads?.[0] || {} }), { headers: HEADERS });
    }
    if (incoming.method === "POST") {
      const form = await incoming.formData();
      const codigo = String(form.get("codigo") || "").trim().toUpperCase().replace(/[-\s]/g, "");
      const file = form.get("file");
      if (!validCode(codigo) || !(file instanceof File) || file.size > 8 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Comprovante inv\xE1lido." }), { status: 400, headers: HEADERS });
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${codigo}/${Date.now()}-${safeName}`;
      const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
      const { url } = settings(env);
      await request(env, `/storage/v1/object/comprovantes/${encodedPath}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: file
      });
      const publicUrl = `${url}/storage/v1/object/public/comprovantes/${encodedPath}`;
      await request(env, "/rest/v1/comprovantes_taxa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ tracking_code: codigo, file_url: publicUrl, file_name: file.name })
      });
      return new Response(JSON.stringify({ ok: true }), { headers: HEADERS });
    }
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Erro no rastreamento." }), { status: 500, headers: HEADERS });
  }
}

// sites/bella/functions/api/marketing-config.js
function onRequest9({ request: request2, env }) {
  const headers6 = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (request2.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: headers6 });
  }
  const pixelId = FACEBOOK_PIXEL_ID;
  return new Response(JSON.stringify({ facebookPixelId: /^\d+$/.test(pixelId) ? pixelId : null }), { headers: headers6 });
}

// sites/bella/functions/api/checkout-health.js
var headers4 = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
async function onRequest10({ request: request2, env }) {
  if (request2.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: headers4 });
  }
  const requiredServerConfig = {
    supabaseUrl: !!String(env.SUPABASE_URL || "").trim(),
    supabaseServiceRole: !!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    siteUrl: !!String(env.SITE_URL || "").trim(),
    pixRateLimit: !!env.PIX_RATELIMIT
  };
  let databaseProject = null;
  try {
    databaseProject = new URL(String(env.SUPABASE_URL || "")).hostname.split(".")[0] || null;
  } catch {
  }
  let gateways2 = [];
  let activePixGateway = null;
  let gatewayError = null;
  try {
    gateways2 = await listGateways(env);
    activePixGateway = await getActivePixGateway(env);
  } catch (error) {
    gatewayError = error instanceof Error ? error.message : "Falha ao consultar gateways.";
  }
  const pixGateways = gateways2.filter((gateway) => gateway.method === "pix").map(({ id, name, enabled, configured: configured2 }) => ({ id, name, enabled, configured: configured2 }));
  const ok = requiredServerConfig.supabaseUrl && requiredServerConfig.supabaseServiceRole && !!activePixGateway && !gatewayError;
  return new Response(JSON.stringify({
    ok,
    store: "Bella Mix",
    databaseProject,
    requiredServerConfig,
    activePixGateway,
    pixGateways,
    gatewayError
  }), { status: ok ? 200 : 503, headers: headers4 });
}

// sites/bella/functions/api/send-tracking-email.js
var corsHeaders6 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest11(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders6 });
  if (request2.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders6 });
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY nao configurado nas variaveis de ambiente do Cloudflare" }), { status: 500, headers: corsHeaders6 });
  }
  if (!RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({ error: "RESEND_FROM_EMAIL nao configurado. Configure nas variaveis de ambiente do Cloudflare com um email do seu dominio verificado na Resend." }), { status: 500, headers: corsHeaders6 });
  }
  let payload;
  try {
    payload = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders6 });
  }
  const { emailCliente, nomeCliente, codigoRastreio, numeroPedido } = payload;
  if (!emailCliente || !codigoRastreio) {
    return new Response(JSON.stringify({ error: "emailCliente e codigoRastreio sao obrigatorios" }), { status: 400, headers: corsHeaders6 });
  }
  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "cliente";
  const siteUrl = String(env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (!siteUrl) {
    return new Response(JSON.stringify({ error: "SITE_URL nao configurado" }), { status: 500, headers: corsHeaders6 });
  }
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>C\xF3digo de Rastreio \u2014 Bella Mix Brasil</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#15803d;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">\u{1F4E6} Bella Mix Brasil</p>
              <p style="margin:6px 0 0;font-size:13px;color:#bbf7d0;">Seu pedido est\xE1 a caminho!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Ol\xE1, <strong>${primeiroNome}</strong>! \u{1F44B}</p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
                ${numeroPedido ? `Seu pedido <strong>#${numeroPedido}</strong> foi confirmado e j\xE1 est\xE1 sendo preparado para envio.` : "Seu pedido foi confirmado e j\xE1 est\xE1 sendo preparado para envio."}
                Use o c\xF3digo abaixo para acompanhar a entrega:
              </p>
              <div style="background:#f0fdf4;border:2px dashed #86efac;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:1px;">C\xF3digo de Rastreio</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#15803d;letter-spacing:4px;font-family:monospace;">${codigoRastreio}</p>
              </div>
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${siteUrl}/rastrear-pedido"
                   style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;">
                  Rastrear meu pedido \u2192
                </a>
              </div>
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                D\xFAvidas? Entre em contato conosco pelo WhatsApp.<br/>
                Obrigado por comprar na <strong>Bella Mix Brasil</strong>! \u{1F31F}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Bella Mix Brasil \xB7 Este email foi enviado automaticamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [emailCliente],
        subject: `\u{1F4E6} Seu c\xF3digo de rastreio Bella Mix${numeroPedido ? ` \u2014 Pedido #${numeroPedido}` : ""}`,
        html
      })
    });
    const result = await res.json();
    if (res.ok) {
      return new Response(JSON.stringify({ ok: true, id: result.id }), { status: 200, headers: corsHeaders6 });
    }
    const msg = result.message || result.error || JSON.stringify(result);
    return new Response(JSON.stringify({ error: `Resend erro ${res.status}: ${msg}` }), { status: 502, headers: corsHeaders6 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: corsHeaders6 });
  }
}

// sites/bella/functions/api/send-recovery-email.js
var corsHeaders7 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
function buildEmail1(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, storeUrl, status) {
  const introducao = status === "pix_gerado" ? "Seu PIX foi gerado, mas o pagamento ainda n\xE3o caiu. Seu pedido continua reservado \u2014 mas s\xF3 por pouco tempo." : "Voc\xEA quase finalizou. Seu pedido ainda est\xE1 guardado aqui pra voc\xEA.";
  const desejoComCidade = cidadeFormatada ? `Confirme agora e seu kit sai daqui direto pra <strong>${cidadeFormatada}</strong> \u2014 entrega garantida em <strong>at\xE9 2 dias \xFAteis</strong>, com rastreio do come\xE7o ao fim.` : `Confirme agora e seu kit chega onde voc\xEA est\xE1 \u2014 entrega garantida em <strong>at\xE9 2 dias \xFAteis</strong>, com rastreio do come\xE7o ao fim.`;
  return `
    <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:700;">Oi, ${primeiroNome}! \u{1F44B}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">${introducao}</p>
    ${localidade ? `
    <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">\u{1F69A} Entrega garantida para voc\xEA</p>
      <p style="margin:0;font-size:20px;font-weight:900;color:#111827;line-height:1.3;">${cidadeFormatada} em at\xE9 2 dias \xFAteis</p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Frete 100% gr\xE1tis \xB7 Rastreio em tempo real \xB7 Embalagem refor\xE7ada</p>
    </div>` : `
    <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">\u{1F69A} Entrega garantida onde voc\xEA estiver</p>
      <p style="margin:0;font-size:20px;font-weight:900;color:#111827;line-height:1.3;">Chega em at\xE9 2 dias \xFAteis</p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Frete 100% gr\xE1tis \xB7 Rastreio em tempo real \xB7 Embalagem refor\xE7ada</p>
    </div>`}
    ${produtos ? `
    <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Seu pedido reservado:</p>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#374151;font-weight:600;">${produtos}</p>
      ${valorFormatado ? `<p style="margin:4px 0 0;font-size:15px;color:#15803d;font-weight:900;">${valorFormatado}</p>` : ""}
    </div>` : ""}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">${desejoComCidade}</p>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${storeUrl}?utm_source=recovery&utm_medium=email&utm_campaign=email1"
         style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:900;font-size:16px;padding:18px 40px;border-radius:12px;">
        ${ctaLabel}
      </a>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:0 0 20px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;">\u23F3 Estoque limitado \u2014 kits esgotam r\xE1pido.</p>
    </div>
  `;
}
function buildEmail2(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, storeUrl) {
  return `
    <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:700;">${primeiroNome}, ainda d\xE1 tempo! \u{1F3C6}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
      Desde que voc\xEA visitou a loja, <strong>dezenas de clientes j\xE1 garantiram o kit</strong> e est\xE3o esperando o kit chegar na porta.
    </p>
    <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">\u2705 Seu pedido ainda est\xE1 aqui</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:#111827;line-height:1.3;">
        ${localidade ? `Entrega garantida em ${cidadeFormatada}` : "Entrega garantida para voc\xEA"}
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">\u{1F69A} Chega em at\xE9 2 dias \xFAteis \xB7 Frete gr\xE1tis</p>
    </div>
    ${produtos ? `
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Seu kit reservado</p>
      <p style="margin:0;font-size:13px;color:#374151;font-weight:600;">${produtos}</p>
      ${valorFormatado ? `<p style="margin:4px 0 0;font-size:15px;color:#15803d;font-weight:900;">${valorFormatado}</p>` : ""}
    </div>` : ""}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      N\xE3o deixe seu kit ir para outra pessoa. ${localidade ? `Em ${cidadeFormatada}, a entrega \xE9 garantida em <strong>at\xE9 2 dias \xFAteis</strong>.` : "A entrega \xE9 garantida em <strong>at\xE9 2 dias \xFAteis</strong>."}
    </p>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${storeUrl}?utm_source=recovery&utm_medium=email&utm_campaign=email2"
         style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:900;font-size:16px;padding:18px 40px;border-radius:12px;">
        ${ctaLabel}
      </a>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:0 0 20px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;">\u{1F525} O estoque est\xE1 acabando \u2014 muita gente finalizou hoje.</p>
    </div>
  `;
}
function buildEmail3(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, storeUrl) {
  return `
    <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:700;">${primeiroNome}, este \xE9 o \xFAltimo aviso. \u26A0\uFE0F</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
      Seu pedido ficou reservado por horas \u2014 mas o estoque est\xE1 chegando ao limite. <strong>Depois disso, n\xE3o podemos mais garantir o seu kit.</strong>
    </p>
    <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">\u26A1 \xDAltima chance de garantir</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:#111827;line-height:1.3;">
        ${localidade ? `Seu kit em ${cidadeFormatada} em 2 dias` : "Seu kit na sua porta em 2 dias"}
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Frete gr\xE1tis \xB7 Entrega garantida \xB7 Rastreio incluso</p>
    </div>
    ${produtos ? `
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Kit reservado para voc\xEA</p>
      <p style="margin:0;font-size:13px;color:#374151;font-weight:600;">${produtos}</p>
      ${valorFormatado ? `<p style="margin:4px 0 0;font-size:15px;color:#15803d;font-weight:900;">${valorFormatado}</p>` : ""}
    </div>` : ""}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      Se n\xE3o finalizar agora, seu pedido ser\xE1 cancelado e o kit vai para a fila de espera de outros clientes.
    </p>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${storeUrl}?utm_source=recovery&utm_medium=email&utm_campaign=email3"
         style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:900;font-size:16px;padding:18px 40px;border-radius:12px;">
        ${ctaLabel}
      </a>
    </div>
  `;
}
async function onRequest12(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders7 });
  if (request2.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders7 });
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY nao configurado" }), { status: 500, headers: corsHeaders7 });
  }
  if (!RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({ error: "RESEND_FROM_EMAIL nao configurado" }), { status: 500, headers: corsHeaders7 });
  }
  let body;
  try {
    body = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders7 });
  }
  const {
    emailCliente,
    nomeCliente,
    cidade,
    estado,
    produtos,
    valor,
    emailNum,
    status,
    storeUrl
  } = body;
  if (!emailCliente) {
    return new Response(JSON.stringify({ error: "emailCliente obrigatorio" }), { status: 400, headers: corsHeaders7 });
  }
  const num = Number(emailNum) || 1;
  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "cliente";
  const cidadeFormatada = cidade ? `${cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()}${estado ? `/${estado.toUpperCase()}` : ""}` : null;
  const localidade = !!cidadeFormatada;
  const valorFormatado = valor ? `R$ ${(Number(valor) / 100).toFixed(2).replace(".", ",")}` : null;
  const ctaLabel = "\u2705 Garantir meu kit agora \u2192";
  const url = storeUrl || env.SITE_URL;
  if (!url) {
    return new Response(JSON.stringify({ error: "SITE_URL nao configurado" }), { status: 500, headers: corsHeaders7 });
  }
  let corpoHtml;
  let assunto;
  if (num >= 3) {
    assunto = `\u26A0\uFE0F ${primeiroNome}, \xFAltimo aviso \u2014 seu kit vai para outra pessoa`;
    corpoHtml = buildEmail3(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, url);
  } else if (num === 2) {
    assunto = cidadeFormatada ? `\u{1F3C6} ${primeiroNome}, outros j\xE1 garantiram \u2014 seu kit ainda est\xE1 aqui em ${cidadeFormatada}` : `\u{1F3C6} ${primeiroNome}, outros j\xE1 garantiram \u2014 seu kit ainda est\xE1 aqui`;
    corpoHtml = buildEmail2(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, url);
  } else {
    assunto = cidadeFormatada ? `\u2728 ${primeiroNome}, falta 1 minuto \u2014 seu kit chega em 2 dias em ${cidadeFormatada}!` : `\u2728 ${primeiroNome}, seu kit chega em 2 dias \u2014 garanta agora!`;
    corpoHtml = buildEmail1(primeiroNome, localidade, cidadeFormatada, produtos, valorFormatado, ctaLabel, url, status);
  }
  const headerSubtitles = {
    1: cidadeFormatada ? `Seu kit chega em ${cidadeFormatada} em 2 dias. \u26A1` : "Entrega em 2 dias, garantida. S\xF3 falta 1 clique. \u26A1",
    2: "Outros clientes j\xE1 garantiram. Voc\xEA ainda pode. \u{1F3C6}",
    3: "\xDAltimo aviso \u2014 seu kit vai para outra pessoa. \u26A0\uFE0F"
  };
  const headerSubtitle = headerSubtitles[num] || headerSubtitles[1];
  const garantiasHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="padding:6px 8px 6px 0;font-size:12px;color:#6b7280;">\u2705 <strong>Kit Escova Secadora</strong> Bella Mix</td>
        <td style="padding:6px 0 6px 8px;font-size:12px;color:#6b7280;">\u{1F512} Pagamento 100% seguro</td>
      </tr>
      <tr>
        <td style="padding:6px 8px 6px 0;font-size:12px;color:#6b7280;">\u{1F4E6} Embalagem refor\xE7ada anti-amassado</td>
        <td style="padding:6px 0 6px 8px;font-size:12px;color:#6b7280;">\u{1F69A} Rastreio em tempo real</td>
      </tr>
    </table>
  `;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bella Mix Brasil</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#dc2626;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">\u2728 Bella Mix Brasil</p>
            <p style="margin:6px 0 0;font-size:14px;color:#fecaca;font-weight:700;">${headerSubtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${corpoHtml}
            ${garantiasHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">D\xFAvidas? Chame no WhatsApp. Somos sempre r\xE1pidos! \u{1F60A}</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">
              \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Bella Mix Brasil \xB7 Voc\xEA recebeu este email pois iniciou um pedido em nossa loja.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [emailCliente],
        subject: assunto,
        html
      })
    });
    const result = await res.json();
    console.log(`[send-recovery-email] email #${num} \u2192 Status Resend:`, res.status);
    if (res.ok) {
      return new Response(JSON.stringify({ ok: true, id: result.id }), { status: 200, headers: corsHeaders7 });
    }
    const msg = result.message || result.error || JSON.stringify(result);
    return new Response(JSON.stringify({ error: `Resend erro ${res.status}: ${msg}` }), { status: 502, headers: corsHeaders7 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: corsHeaders7 });
  }
}

// sites/bella/functions/api/process-recovery-queue.js
var corsHeaders8 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
var MINUTOS_ATE_EMAIL_1 = 30;
var HORAS_ATE_EMAIL_2 = 4;
var HORAS_ATE_EMAIL_3 = 24;
async function supabaseFetch2(supabaseUrl, supabaseKey, path, options = {}) {
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...options.headers || {}
    }
  });
  try {
    return { status: res.status, body: await res.json() };
  } catch {
    return { status: res.status, body: await res.text() };
  }
}
async function claim(supabaseUrl, supabaseKey, leadId, conditionQs, patch) {
  const { status, body } = await supabaseFetch2(
    supabaseUrl,
    supabaseKey,
    `/rest/v1/leads?id=eq.${leadId}&${conditionQs}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  return status < 400 && Array.isArray(body) && body.length > 0;
}
async function enviarEmail(SITE_URL, lead, emailNum) {
  try {
    const res = await fetch(`${SITE_URL}/api/send-recovery-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailCliente: lead.email,
        nomeCliente: lead.nome,
        cidade: lead.cidade,
        estado: lead.estado,
        produtos: lead.produtos,
        valor: lead.valor,
        emailNum,
        status: lead.status,
        storeUrl: SITE_URL
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}
async function onRequest13(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders8 });
  try {
    const CRON_SECRET = env.CRON_SECRET;
    if (CRON_SECRET) {
      const provided = request2.headers.get("x-cron-secret");
      if (provided !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders8 });
      }
    }
    const SUPABASE_URL = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const SUPABASE_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const SITE_URL = (env.SITE_URL || "").trim().replace(/\/+$/, "");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados." }), { status: 500, headers: corsHeaders8 });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cutoff30min = new Date(Date.now() - MINUTOS_ATE_EMAIL_1 * 60 * 1e3).toISOString();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const NAO_INICIADO = `or=(recovery_count.is.null,recovery_count.eq.0)`;
    let started = 0, followups = 0, deduped = 0, errors = 0;
    const queryNew = [
      `produtos=ilike.*Escova*`,
      `status=eq.pix_gerado`,
      NAO_INICIADO,
      `created_at=lte.${encodeURIComponent(cutoff30min)}`,
      `created_at=gte.${encodeURIComponent(cutoff24h)}`,
      `order=created_at.desc`,
      `limit=10`,
      `select=id,nome,email,cidade,estado,produtos,valor,status,recovery_count,created_at`
    ].join("&");
    const { body: novos, status: novosStatus } = await supabaseFetch2(
      SUPABASE_URL,
      SUPABASE_KEY,
      `/rest/v1/leads?${queryNew}`
    );
    if (novosStatus < 400 && Array.isArray(novos) && novos.length > 0) {
      const emails = [...new Set(novos.map((l) => (l.email || "").toLowerCase()).filter(Boolean))];
      const emailList = emails.map((e) => `"${e.replace(/[",()]/g, "")}"`).join(",");
      const { status: dedupStatus, body: jaTratados } = await supabaseFetch2(
        SUPABASE_URL,
        SUPABASE_KEY,
        `/rest/v1/leads?produtos=ilike.*Escova*&email=in.(${encodeURIComponent(emailList)})&or=(recovery_count.gte.1,status.eq.pago)&select=email`
      );
      if (dedupStatus >= 400 || !Array.isArray(jaTratados)) {
        console.error("[recovery-queue] Falha na consulta de dedupe; fase A adiada.", dedupStatus);
        errors++;
      } else {
        const emailsJaTratados = new Set(jaTratados.map((l) => (l.email || "").toLowerCase()));
        const vistos = /* @__PURE__ */ new Set();
        for (const lead of novos) {
          const email = (lead.email || "").toLowerCase();
          try {
            const ehDuplicado = !email || emailsJaTratados.has(email) || vistos.has(email);
            if (email) vistos.add(email);
            if (ehDuplicado) {
              await claim(
                SUPABASE_URL,
                SUPABASE_KEY,
                lead.id,
                NAO_INICIADO,
                { recovery_count: -1, recovery_next_at: null, updated_at: now }
              );
              deduped++;
              continue;
            }
            const travou = await claim(SUPABASE_URL, SUPABASE_KEY, lead.id, NAO_INICIADO, {
              recovery_count: 1,
              recovery_next_at: new Date(Date.now() + HORAS_ATE_EMAIL_2 * 60 * 60 * 1e3).toISOString(),
              updated_at: now
            });
            if (!travou) continue;
            const ok = await enviarEmail(SITE_URL, lead, 1);
            if (!ok) {
              console.error(`[recovery-queue] Erro ao enviar email 1 para lead ${lead.id}`);
              await claim(
                SUPABASE_URL,
                SUPABASE_KEY,
                lead.id,
                `recovery_count=eq.1`,
                { recovery_count: 0, recovery_next_at: null, updated_at: now }
              );
              errors++;
              continue;
            }
            started++;
          } catch (err) {
            console.error(`[recovery-queue] Excecao no auto-start do lead ${lead.id}:`, err);
            errors++;
          }
        }
      }
    }
    const queryFollow = [
      `produtos=ilike.*Escova*`,
      `recovery_count=gte.1`,
      `recovery_count=lte.2`,
      `recovery_next_at=lte.${encodeURIComponent(now)}`,
      `status=in.(checkout_iniciado,pix_gerado)`,
      `limit=10`,
      `select=id,nome,email,cidade,estado,produtos,valor,status,recovery_count`
    ].join("&");
    const { body: leads, status: fetchStatus } = await supabaseFetch2(
      SUPABASE_URL,
      SUPABASE_KEY,
      `/rest/v1/leads?${queryFollow}`
    );
    if (fetchStatus >= 400) {
      return new Response(JSON.stringify({ error: "Erro ao buscar leads", details: leads, iniciados: started, duplicados_ignorados: deduped }), { status: 500, headers: corsHeaders8 });
    }
    if (Array.isArray(leads)) {
      for (const lead of leads) {
        try {
          const countAtual = lead.recovery_count;
          const emailNum = countAtual + 1;
          const nextAt = emailNum < 3 ? new Date(Date.now() + HORAS_ATE_EMAIL_3 * 60 * 60 * 1e3).toISOString() : null;
          const travou = await claim(
            SUPABASE_URL,
            SUPABASE_KEY,
            lead.id,
            `recovery_count=eq.${countAtual}&recovery_next_at=lte.${encodeURIComponent(now)}`,
            { recovery_count: emailNum, recovery_next_at: nextAt, updated_at: now }
          );
          if (!travou) continue;
          const ok = await enviarEmail(SITE_URL, lead, emailNum);
          if (!ok) {
            console.error(`[recovery-queue] Erro ao enviar email ${emailNum} para lead ${lead.id}`);
            await claim(SUPABASE_URL, SUPABASE_KEY, lead.id, `recovery_count=eq.${emailNum}`, {
              recovery_count: countAtual,
              recovery_next_at: new Date(Date.now() + 30 * 60 * 1e3).toISOString(),
              updated_at: now
            });
            errors++;
            continue;
          }
          followups++;
        } catch (err) {
          console.error(`[recovery-queue] Excecao ao processar lead ${lead.id}:`, err);
          errors++;
        }
      }
    }
    return new Response(
      JSON.stringify({ ok: true, iniciados: started, followups, duplicados_ignorados: deduped, errors }),
      { status: 200, headers: corsHeaders8 }
    );
  } catch (err) {
    console.error("[recovery-queue] Erro fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno na automacao", detalhe: String(err && err.message || err) }),
      { status: 500, headers: corsHeaders8 }
    );
  }
}

// sites/bella/functions/_lib/admin-auth.js
async function hmacSign3(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual3(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyAdminToken2(request2, env) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) return { valid: false, error: "Servidor n\xE3o configurado." };
  const auth = request2.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return { valid: false, error: "N\xE3o autorizado." };
  const dot = token.lastIndexOf(".");
  if (dot === -1) return { valid: false, error: "Token inv\xE1lido." };
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = await hmacSign3(payloadB64, secret);
  if (!timingSafeEqual3(expectedSig, providedSig)) {
    return { valid: false, error: "Token inv\xE1lido." };
  }
  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return { valid: false, error: "Token inv\xE1lido." };
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: "Sess\xE3o expirada." };
  }
  return { valid: true };
}

// sites/bella/functions/api/reconcile-payments.js
var headers5 = { "Content-Type": "application/json", "Cache-Control": "no-store" };
var json2 = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: headers5 });
async function onRequest14({ request: request2, env }) {
  if (request2.method !== "POST") return json2({ error: "Method not allowed" }, 405);
  const cronAuthorized = Boolean(env.CRON_SECRET && request2.headers.get("x-cron-secret") === env.CRON_SECRET);
  const adminAuthorized = (await verifyAdminToken2(request2, env)).valid;
  if (!cronAuthorized && !adminAuthorized) return json2({ error: "N\xE3o autorizado." }, 401);
  try {
    const leads = await listPendingPixLeads(env, 50);
    let paid = 0;
    let expired = 0;
    let pending = 0;
    let errors = 0;
    for (const lead of leads) {
      try {
        const result = await queryPixGatewayStatus2(env, lead.transaction_id, lead.gateway || "ironpay");
        if (result.isPaid) {
          await fulfillPaidPixLead(env, lead.transaction_id, result.paidAt);
          paid++;
        } else if (result.isExpired) {
          await updateLeadById(env, lead.id, { status: "expirado" });
          expired++;
        } else {
          pending++;
        }
      } catch (error) {
        console.error(`[reconcile-payments] ${lead.transaction_id}:`, error?.message);
        errors++;
      }
    }
    return json2({ ok: true, checked: leads.length, paid, expired, pending, errors });
  } catch (error) {
    console.error("[reconcile-payments] Falha geral:", error?.message);
    return json2({ error: "N\xE3o foi poss\xEDvel sincronizar os pagamentos." }, 502);
  }
}

// sites/bella/functions/api/fb-purchase.js
var corsHeaders9 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest15(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders9 });
  if (request2.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders9 });
  if (!env.FB_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "Pixel nao configurado" }), { status: 500, headers: corsHeaders9 });
  }
  let payload;
  try {
    payload = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders9 });
  }
  try {
    const result = await sendFacebookPurchase(env, payload);
    console.log("FB CAPI response:", result.status, result.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders9 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders9 });
  }
}

// sites/bella/functions/api/utmify-order.js
var corsHeaders10 = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};
async function onRequest16(context) {
  const { request: request2, env } = context;
  if (request2.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders10 });
  if (request2.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders10 });
  let body;
  try {
    body = await request2.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders10 });
  }
  const {
    orderId,
    status,
    customerName,
    customerEmail,
    customerPhone,
    customerDocument,
    productName,
    valueInCents,
    tracking,
    paymentMethod
  } = body;
  try {
    const result = await sendUtmifyOrder(env, {
      orderId,
      status,
      customerName,
      customerEmail,
      customerPhone,
      customerDocument,
      productName,
      valueInCents,
      tracking,
      paymentMethod
    });
    return new Response(JSON.stringify({ ok: true, utmifyStatus: result.status }), { status: 200, headers: corsHeaders10 });
  } catch (err) {
    console.error("[utmify-order]", err?.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders10 });
  }
}

// worker-src/index.js
var JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
var gateways = [
  { id: "ironpay", name: "IronPay", method: "pix" },
  { id: "masterfy", name: "MasterFy", method: "pix" },
  { id: "umbrellapag", name: "UmbrellaPag", method: "pix" },
  { id: "venuspay_pix", name: "Venus Pay PIX", method: "pix" },
  { id: "flevopay", name: "FlevoPay", method: "pix" },
  { id: "venuspay", name: "Venus Pay Cart\xE3o", method: "card" }
];
var json3 = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
var digits = (value) => String(value || "").replace(/\D/g, "");
var BUMPS = { necessaire: 19.47, siage: 32.63, wella: 45.7 };
var COLORS = { Preta: 37.9, Branca: 37.9, Rosa: 37.9 };
var PRODUCTS2 = { escova: 37.9, pincel: 11.96, ...Object.fromEntries(upsellCatalog.map((p) => [p.id, p.price])) };
var SHIPPING = { "Frete Gr\xE1tis": 0, JADLOG: 18.47, "SEDEX 12": 33.4 };
function normalizeBuyerEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at > 0 ? `${email.slice(0, at).replace(/\.+$/, "")}@${email.slice(at + 1)}` : email;
}
function cartTotal(cart) {
  if (!cart || !Number.isInteger(cart.qty) || cart.qty < 1 || cart.qty > 10) return null;
  const productKey = cart.product || "escova";
  if (!Object.hasOwn(PRODUCTS2, productKey)) return null;
  let base = PRODUCTS2[productKey] * cart.qty;
  if (Array.isArray(cart.colors) && cart.colors.length) {
    if (productKey !== "escova") return null;
    if (cart.colors.length > 3 || cart.colors.some((c) => !Object.hasOwn(COLORS, c.label) || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 10)) return null;
    if (cart.colors.reduce((sum2, c) => sum2 + c.quantity, 0) !== cart.qty) return null;
    base = cart.colors.reduce((sum2, c) => sum2 + COLORS[c.label] * c.quantity, 0);
  }
  if (!Object.hasOwn(SHIPPING, cart.shipping)) return null;
  if (!Array.isArray(cart.bumps) || cart.bumps.length > 5 || new Set(cart.bumps).size !== cart.bumps.length || cart.bumps.some((id) => !Object.hasOwn(BUMPS, id))) return null;
  if (![1, 0.5].includes(cart.discount) || ![0, 5].includes(cart.bonus)) return null;
  const d = cart.discount;
  const round = (n) => Math.round(n * 100);
  const sum = round(base * d) + round(SHIPPING[cart.shipping] * d) + cart.bumps.reduce((acc, id) => acc + round(BUMPS[id] * d), 0) - cart.bonus * 100;
  return Math.max(1, sum) / 100;
}
async function nextPixAmount(env, baseAmount) {
  const baseCents = Math.round(baseAmount * 100);
  const recent = await db(env, "gokoco_orders", `?amount=gte.${((baseCents + 1) / 100).toFixed(2)}&amount=lte.${((baseCents + 5) / 100).toFixed(2)}&status=neq.failed&select=amount&order=created_at.desc&limit=1`);
  const last = recent.find((row) => {
    const difference = Math.round(Number(row.amount) * 100) - baseCents;
    return difference >= 1 && difference <= 5;
  });
  const lastOffset = last ? Math.round(Number(last.amount) * 100) - baseCents : 0;
  return (baseCents + lastOffset % 5 + 1) / 100;
}
async function db(env, table, query = "", method = "GET", body) {
  const base = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!base || !key) throw new Error("Supabase n\xE3o configurado no servidor.");
  const response = await fetch(`${base}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: query.includes("on_conflict=") ? "resolution=merge-duplicates,return=representation" : "return=representation"
    },
    ...body === void 0 ? {} : { body: JSON.stringify(body) }
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Banco respondeu ${response.status}: ${value?.message || value?.error || "erro desconhecido"}`);
  return value;
}
function configured(env, id) {
  if (id === "ironpay") return !!(env.IRONPAY_API_TOKEN && env.IRONPAY_OFFER_HASH && env.IRONPAY_PRODUCT_HASH);
  if (id === "masterfy") return !!env.MASTERFY_API_KEY;
  if (id === "umbrellapag") return !!env.UMBRELLAPAG_API_KEY;
  if (id === "venuspay_pix" || id === "venuspay") return !!env.VENUS_PAY_SECRET_KEY;
  if (id === "flevopay") return !!env.FLEVOPAY_API_KEY;
  return false;
}
async function listGateways2(env) {
  const rows = await db(env, "gokoco_gateways", "?select=id,enabled,updated_at");
  return gateways.map((g) => {
    const saved = rows.find((row) => row.id === g.id);
    return { ...g, enabled: saved ? !!saved.enabled : g.method === "card", configured: configured(env, g.id), updated_at: saved?.updated_at || null };
  });
}
async function requireAdmin(request2, env) {
  const auth = await verifyAdminToken(request2, env);
  return auth.valid ? null : json3({ error: auth.error || "N\xE3o autorizado." }, 401);
}
function validateBuyer(body) {
  const buyer = body?.client || {};
  const amount = Number(body?.amount);
  const expected = cartTotal(body?.cart);
  if (!Number.isFinite(amount) || expected === null || Math.abs(Math.round(amount * 100) - Math.round(expected * 100)) > 1) return "Valor do pedido inv\xE1lido. Atualize a p\xE1gina e tente novamente.";
  if (String(buyer.name || "").trim().length < 3) return "Informe seu nome completo.";
  if (!isValidBuyerEmail(normalizeBuyerEmail(buyer.email))) return "E-mail inv\xE1lido. Confira o endere\xE7o informado e tente novamente.";
  if (![11, 14].includes(digits(buyer.document).length)) return "CPF/CNPJ inv\xE1lido.";
  if (digits(buyer.phone).length < 10) return "Telefone inv\xE1lido.";
  return null;
}
function isValidBuyerEmail(value) {
  const email = String(value || "").trim();
  if (email.length > 254 || /\.\./.test(email)) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/i.test(email);
}
function validateShipping(shipping) {
  const address = shipping && typeof shipping === "object" ? shipping : {};
  if (digits(address.cep).length !== 8) return "Informe um CEP v\xE1lido para a entrega.";
  for (const [field, label] of [["logradouro", "endere\xE7o"], ["numero", "n\xFAmero"], ["bairro", "bairro"], ["cidade", "cidade"]]) {
    if (!String(address[field] || "").trim()) return `Informe ${label} para a entrega.`;
  }
  if (!/^[A-Za-z]{2}$/.test(String(address.uf || "").trim())) return "Informe a UF com duas letras.";
  return null;
}
function maskedGatewayContact(env, orderId, order) {
  if (String(env.GATEWAY_MASK_CUSTOMER || "").toLowerCase() === "false") return { email: order.email, phone: order.phone };
  let domain = String(env.GATEWAY_MASK_EMAIL_DOMAIN || "").trim().replace(/^@/, "");
  if (!domain) {
    try {
      domain = new URL(env.SITE_URL).hostname;
    } catch {
      domain = "gokoco-tiktok.pages.dev";
    }
  }
  const ref = String(orderId).replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase() || "cliente";
  const phone = digits(env.GATEWAY_MASK_PHONE) || "11999999999";
  return { email: `pedido-${ref}@${domain}`, phone };
}
async function createPix(request2, env, ctx, siteVariant = "gokoco") {
  const body = await request2.json().catch(() => null);
  if (body?.client) body.client.email = normalizeBuyerEmail(body.client.email);
  const invalid = validateBuyer(body);
  if (invalid) return json3({ message: invalid, code: "invalid_document" }, 400);
  const invalidShipping = validateShipping(body.shipping);
  if (invalidShipping) return json3({ message: invalidShipping, code: "invalid_address" }, 400);
  const checkoutId = String(body.checkoutId || "");
  if (!/^[a-f0-9-]{20,50}$/i.test(checkoutId)) return json3({ message: "Identificador de checkout inv\xE1lido." }, 400);
  const previous = await db(env, "gokoco_orders", `?checkout_id=eq.${encodeURIComponent(checkoutId)}&select=*&limit=1`);
  if (previous[0]?.pix_code) {
    const old = previous[0];
    if (old.status === "pending" && purchaseDestination(env) === "utmify") {
      const send = deliverPendingPurchase(env, db, old.id).catch((error) => console.error("[purchase/pending]", old.id, error?.message || error));
      if (ctx?.waitUntil) ctx.waitUntil(send);
      else await send;
    }
    return json3({ copyPaste: old.pix_code, qrCode: old.qr_code, transactionId: old.transaction_id, gatewayTransactionId: old.transaction_id, orderId: old.id, amount: Number(old.amount) });
  }
  if (previous[0] && previous[0].status !== "failed") return json3({ message: "A cobran\xE7a anterior est\xE1 em processamento. Aguarde um momento." }, 409);
  const active = (await listGateways2(env)).filter((g) => g.enabled && g.method === "pix");
  if (active.length !== 1) return json3({ message: "Selecione um gateway PIX no painel admin." }, 503);
  if (!active[0].configured) return json3({ message: "O gateway PIX selecionado precisa de uma chave de API." }, 503);
  const ip = request2.headers.get("CF-Connecting-IP") || "unknown";
  const ipKey = `pix:${ip}`;
  const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.ADMIN_SESSION_SECRET || ""}:${ip}`));
  const ipHash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, "0")).join("");
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    if (count >= 5) return json3({ message: "Muitas cobran\xE7as PIX. Tente novamente em uma hora." }, 429);
  } else {
    const since = new Date(Date.now() - 36e5).toISOString();
    const recent = await db(env, "gokoco_orders", `?client_ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&status=eq.pending&select=id&limit=5`);
    if (recent.length >= 5) return json3({ message: "Muitas cobran\xE7as PIX. Tente novamente em uma hora." }, 429);
  }
  const shipping = body.shipping;
  const order = {
    checkout_id: checkoutId,
    name: String(body.client.name).trim().slice(0, 150),
    email: normalizeBuyerEmail(body.client.email),
    phone: digits(body.client.phone),
    document: digits(body.client.document),
    amount: await nextPixAmount(env, cartTotal(body.cart)),
    products: Array.isArray(body.products) ? body.products.slice(0, 10) : [],
    shipping,
    tracking: { ...await recoverCustomerAttribution(env, db, capturePurchaseTracking(request2, body), body.client), site_variant: siteVariant },
    gateway: active[0].id,
    client_ip_hash: ipHash,
    status: "creating"
  };
  const saved = previous[0] ? await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(previous[0].id)}&status=eq.failed&select=id`, "PATCH", { ...order, updated_at: (/* @__PURE__ */ new Date()).toISOString() }) : await db(env, "gokoco_orders", "?select=id", "POST", order);
  const id = saved?.[0]?.id;
  if (!id) return json3({ message: "A cobran\xE7a j\xE1 est\xE1 em processamento. Aguarde um momento." }, 409);
  const gatewayContact = maskedGatewayContact(env, id, order);
  const payload = {
    amount: order.amount,
    name: order.name,
    email: gatewayContact.email,
    phone: gatewayContact.phone,
    reference: id,
    document: order.document,
    productName: order.products.map((p) => p.name).filter(Boolean).join(" + ").slice(0, 255) || "Escova Modeladora GOKOCO",
    address: {
      street: shipping.logradouro,
      number: shipping.numero,
      complement: shipping.complemento,
      neighborhood: shipping.bairro,
      city: shipping.cidade,
      state: shipping.uf,
      zipCode: shipping.cep
    }
  };
  const context = { request: request2, env };
  const headers6 = { "Content-Type": "application/json" };
  const provider = active[0].id;
  const result = provider === "masterfy" ? await createPixMasterfy(context, headers6, payload) : provider === "umbrellapag" ? await createPixUmbrellapag(context, headers6, payload) : provider === "venuspay_pix" ? await createPixVenuspay(context, headers6, payload) : provider === "flevopay" ? await createPixFlevopay(context, headers6, payload) : await createPixIronpay(context, headers6, payload);
  const payment = await result.json().catch(() => ({}));
  if (!result.ok || !payment.pixCode || !payment.transactionId) {
    await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}`, "PATCH", { status: "failed" });
    const providerMessage = Array.isArray(payment.error?.message) ? payment.error.message.join(", ") : typeof payment.error === "string" ? payment.error : Array.isArray(payment.message) ? payment.message.join(", ") : typeof payment.message === "string" ? payment.message : "N\xE3o foi poss\xEDvel gerar o PIX. Confira seus dados e tente novamente.";
    return json3({ message: providerMessage }, result.status || 502);
  }
  const qr = payment.qrCodeBase64 || payment.qrCodeImage || null;
  await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}`, "PATCH", {
    status: "pending",
    transaction_id: String(payment.transactionId),
    pix_code: payment.pixCode,
    qr_code: qr,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (purchaseDestination(env) === "utmify") {
    const send = deliverPendingPurchase(env, db, id).catch((error) => console.error("[purchase/pending]", id, error?.message || error));
    if (ctx?.waitUntil) ctx.waitUntil(send);
    else await send;
  }
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    await env.PIX_RATELIMIT.put(ipKey, String(count + 1), { expirationTtl: 3600 });
  }
  return json3({ copyPaste: payment.pixCode, qrCode: qr, transactionId: payment.transactionId, gatewayTransactionId: payment.transactionId, orderId: id, amount: order.amount });
}
async function createMarketPix(request2, env, ctx) {
  const body = await request2.json().catch(() => null);
  const quantity = Number(body?.quantity);
  if (!body || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json3({ error: "Quantidade inv\xE1lida." }, 400);
  const adapted = {
    amount: body.amount,
    checkoutId: body.checkoutId,
    client: { name: body.name, email: body.email, phone: body.phone, document: body.document },
    cart: { qty: quantity, shipping: "Frete Gr\xE1tis", bumps: [], discount: 1, bonus: 0 },
    shipping: {
      cep: body.address?.zipCode,
      uf: body.address?.state,
      cidade: body.address?.city,
      logradouro: body.address?.street,
      bairro: body.address?.neighborhood,
      numero: body.address?.number,
      complemento: body.address?.complement || ""
    },
    products: [{ name: "Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt", quantity, color: String(body.color || "").slice(0, 40), price: 37.9 }],
    tracking: body.tracking || {},
    fb: body.fb || {}
  };
  const internal = new Request(request2, { body: JSON.stringify(adapted) });
  const result = await createPix(internal, env, ctx, "mercado_livre");
  const data = await result.json();
  if (!result.ok) return json3({ error: data.message || data.error || "N\xE3o foi poss\xEDvel gerar o PIX." }, result.status);
  const qr = String(data.qrCode || "");
  const externalImage = /^(data:|https?:\/\/)/i.test(qr);
  return json3({ transactionId: data.transactionId, pixCode: data.copyPaste, qrCodeBase64: externalImage ? null : qr, qrCodeImage: externalImage ? qr : null, orderId: data.orderId, amount: data.amount });
}
function marketSiteRequest(url, env) {
  const hostname = String(env.MARKET_HOSTNAME || "").trim().toLowerCase();
  return hostname && url.hostname.toLowerCase() === hostname || url.pathname === "/tl" || url.pathname.startsWith("/tl/");
}
function bellaSiteRequest(url, env) {
  const hostname = String(env.BELLA_HOSTNAME || "").trim().toLowerCase();
  return hostname && url.hostname.toLowerCase() === hostname || url.pathname === "/video" || url.pathname.startsWith("/video/");
}
function bellaEnvironment(env) {
  const override = Object.fromEntries(Object.keys(env).filter((key) => key.startsWith("BELLA_") && env[key]).map((key) => [key.slice("BELLA_".length), env[key]]));
  return {
    ...env,
    ...override,
    SITE_VARIANT: "video",
    SITE_URL: env.BELLA_SITE_URL || `${String(env.SITE_URL || "https://gokoco-tiktok.pages.dev").replace(/\/+$/, "")}/video`
  };
}
var bellaRoutes = {
  "/api/orders/create": onRequest2,
  "/api/pix/create": onRequest3,
  "/api/pix/status": onRequest4,
  "/api/pix/webhook": onRequest5,
  "/api/card/create": onRequest6,
  "/api/card/status": onRequest7,
  "/api/tracking": onRequest8,
  "/api/marketing-config": onRequest9,
  "/api/checkout-health": onRequest10,
  "/api/send-tracking-email": onRequest11,
  "/api/send-recovery-email": onRequest12,
  "/api/process-recovery-queue": onRequest13,
  "/api/reconcile-payments": onRequest14,
  "/api/fb-purchase": onRequest15,
  "/api/utmify-order": onRequest16
};
async function bellaRoute(path, request2, env, ctx) {
  const handler = bellaRoutes[path];
  if (!handler) return null;
  const url = new URL(request2.url);
  url.pathname = path;
  return handler({ request: new Request(url, request2), env: bellaEnvironment(env), waitUntil: ctx?.waitUntil?.bind(ctx) });
}
async function adminBellaOrders(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  const bella = bellaEnvironment(env);
  const base = String(bella.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(bella.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !key) return json3({ error: "Banco Bella Mix n\xE3o configurado." }, 503);
  const headers6 = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
  if (request2.method === "GET") {
    const offset = Number(new URL(request2.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1e5) return json3({ error: "P\xE1gina inv\xE1lida." }, 400);
    const missing = await fetch(`${base}/rest/v1/leads?status=eq.pago&codigo_rastreio=is.null&produtos=not.ilike.*Taxa*&select=id,nome&order=created_at.desc&limit=5`, { headers: headers6 });
    if (missing.ok) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const genCode = () => `BM${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join("")}`;
      await Promise.allSettled((await missing.json()).map(async (lead) => {
        const code = genCode();
        const saved = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&codigo_rastreio=is.null&select=id`, { method: "PATCH", headers: headers6, body: JSON.stringify({ codigo_rastreio: code, updated_at: (/* @__PURE__ */ new Date()).toISOString() }) });
        if (!saved.ok || !(await saved.json()).length) return;
        await fetch(`${base}/rest/v1/rastreio_origem?on_conflict=codigo`, { method: "POST", headers: { ...headers6, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ codigo: code, origem_at: (/* @__PURE__ */ new Date()).toISOString(), nome_cliente: lead.nome || null }) });
      }));
    }
    const rows = await fetch(`${base}/rest/v1/leads?select=id,created_at,nome,email,telefone,produtos,valor,metodo_pagamento,status,transaction_id,codigo_rastreio,gateway,cidade,estado,cep,rua,numero,bairro,tracking,card_encriptado&order=created_at.desc&limit=500&offset=${offset}`, { headers: headers6 });
    if (!rows.ok) return json3({ error: "N\xE3o foi poss\xEDvel listar os pedidos Bella Mix." }, 502);
    return json3({ orders: (await rows.json()).map(({ card_encriptado, ...order }) => ({ ...order, cardSummary: safeCardSummary(card_encriptado), cardEncrypted: !!card_encriptado && !safeCardSummary(card_encriptado), siteVariant: order.tracking?.site_variant === "video" ? "video" : "bella_legacy" })) });
  }
  if (request2.method === "PATCH") {
    const body = await request2.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(body.id || ""))) return json3({ error: "Pedido inv\xE1lido." }, 400);
    if (body.mark_paid) {
      const leadRows = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(body.id)}&select=id,produtos,status,tracking&limit=1`, { headers: headers6 });
      const lead = (await leadRows.json().catch(() => []))[0];
      if (!lead) return json3({ error: "Pedido n\xE3o encontrado." }, 404);
      if (!/taxa/i.test(String(lead.produtos || ""))) return json3({ error: "Apenas pagamentos de taxa podem ser marcados por aqui." }, 409);
      if (lead.status === "pago") return json3({ status: "pago" });
      const paidAt = (/* @__PURE__ */ new Date()).toISOString();
      const changed2 = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(body.id)}&status=eq.${encodeURIComponent(lead.status)}&select=id,status`, { method: "PATCH", headers: headers6, body: JSON.stringify({ status: "pago", tracking: { ...lead.tracking || {}, fee_manual: { paidAt, source: "admin" } }, updated_at: paidAt }) });
      if (!changed2.ok || !(await changed2.json().catch(() => [])).length) return json3({ error: "O pedido foi atualizado. Tente novamente." }, 409);
      return json3({ status: "pago", confirmedAt: paidAt });
    }
    const code = String(body.codigo_rastreio || "").trim().toUpperCase().replace(/[-\s]/g, "");
    if (!/^BM[A-Z0-9]{6,10}$/.test(code)) return json3({ error: "C\xF3digo Bella Mix inv\xE1lido. Use BM seguido de 6 a 10 letras ou n\xFAmeros." }, 400);
    const origin = await fetch(`${base}/rest/v1/rastreio_origem?on_conflict=codigo`, { method: "POST", headers: { ...headers6, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ codigo: code, origem_at: (/* @__PURE__ */ new Date()).toISOString(), nome_cliente: null }) });
    if (!origin.ok) return json3({ error: "N\xE3o foi poss\xEDvel registrar a origem do rastreio." }, 502);
    const changed = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(body.id)}&select=id,codigo_rastreio`, { method: "PATCH", headers: headers6, body: JSON.stringify({ codigo_rastreio: code, updated_at: (/* @__PURE__ */ new Date()).toISOString() }) });
    if (!changed.ok) return json3({ error: "N\xE3o foi poss\xEDvel salvar o rastreio." }, 502);
    return json3({ ok: true, order: (await changed.json())[0] || null });
  }
  return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
}
async function adminBellaCard(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "GET") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const id = String(new URL(request2.url).searchParams.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json3({ error: "Pedido inv\xE1lido." }, 400);
  const bella = bellaEnvironment(env);
  const base = String(bella.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(bella.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !key) return json3({ error: "Banco Bella Mix n\xE3o configurado." }, 503);
  const rows = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=id,card_encriptado&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!rows.ok) return json3({ error: "N\xE3o foi poss\xEDvel consultar o pedido." }, 502);
  const stored = String((await rows.json())[0]?.card_encriptado || "");
  if (!stored) return json3({ error: "Este pedido n\xE3o tem dados de cart\xE3o salvos." }, 404);
  const summary = safeCardSummary(stored);
  if (summary) return json3({ summary });
  const secret = cardSecret(bella);
  if (!secret) return json3({ error: "Configure a vari\xE1vel ENCRYPT_KEY (ou VITE_ENCRYPT_KEY) no Cloudflare para visualizar os cart\xF5es." }, 503);
  try {
    const parsed = JSON.parse(await decryptCardData(stored, secret));
    const card = {
      numero: digits(parsed.numero).slice(0, 19),
      nome: String(parsed.nome || "").slice(0, 80),
      validade: String(parsed.validade || "").slice(0, 7),
      cvv: digits(parsed.cvv).slice(0, 4),
      cpf: digits(parsed.cpf).slice(0, 11)
    };
    if (!card.numero) throw new Error("sem n\xFAmero");
    return json3({ card });
  } catch {
    return json3({ error: "N\xE3o foi poss\xEDvel descriptografar o cart\xE3o. O dado pode estar corrompido." }, 422);
  }
}
async function adminBellaTrackingEmail(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const { id } = await request2.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return json3({ error: "Pedido inv\xE1lido." }, 400);
  const bella = bellaEnvironment(env);
  const base = String(bella.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(bella.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !key) return json3({ error: "Banco Bella Mix n\xE3o configurado." }, 503);
  const found = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=id,nome,email,codigo_rastreio&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!found.ok) return json3({ error: "N\xE3o foi poss\xEDvel consultar o pedido." }, 502);
  const order = (await found.json())[0];
  if (!order?.email || !/^BM[A-Z0-9]{6,10}$/.test(String(order.codigo_rastreio || ""))) return json3({ error: "Salve um c\xF3digo de rastreio v\xE1lido antes de enviar o e-mail." }, 400);
  const mail = new Request(request2, { body: JSON.stringify({ emailCliente: order.email, nomeCliente: order.nome, codigoRastreio: order.codigo_rastreio, numeroPedido: order.id }) });
  return onRequest11({ request: mail, env: bella });
}
async function siteAsset(request2, env) {
  const url = new URL(request2.url);
  const normalizedPath = url.pathname.replace(/\/$/, "").replace(/\.html$/, "");
  const catalogRoutes = {};
  for (const [prefix, theme] of [["", "original"], ["/tl", "tl"], ["/video", "bella"]]) {
    for (const product of upsellCatalog) {
      catalogRoutes[`${prefix}/upsell${product.step}`] = `${theme}-${product.id}`;
      catalogRoutes[`${prefix}/pagamento-${product.id}`] = `${theme}-pagamento-${product.id}`;
    }
    catalogRoutes[`${prefix}/upsell-concluido`] = `${theme}-concluido`;
    catalogRoutes[`${prefix}/vitrine`] = `${theme}-vitrine`;
    if (prefix) catalogRoutes[`${prefix}/pagamento-pincel`] = `${theme}-pagamento-pincel`;
  }
  const upsell = catalogRoutes[normalizedPath] || {
    "/upsell1": "original",
    "/tl/upsell1": "tl",
    "/video/upsell1": "bella",
    "/pagamento-pincel": "pagamento",
    "/tl/pagamento-pincel": "pagamento",
    "/video/pagamento-pincel": "pagamento"
  }[normalizedPath];
  if (upsell) {
    if (!["GET", "HEAD"].includes(request2.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    url.pathname = "/upsell-pages/" + upsell + ".txt";
    const asset2 = await env.ASSETS.fetch(new Request(url, request2));
    const headers7 = new Headers(asset2.headers);
    headers7.set("Content-Type", "text/html; charset=utf-8");
    headers7.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(asset2.body, { status: asset2.status, headers: headers7 });
  }
  const site = marketSiteRequest(url, env) ? "tl" : bellaSiteRequest(url, env) ? "video" : null;
  if (!site) return env.ASSETS.fetch(request2);
  let pathname = url.pathname.replace(new RegExp(`^/${site}(?=/|$)`), "") || "/";
  const spaRoute = !/\.[a-z0-9]+$/i.test(pathname) || pathname === "/index.html";
  if (spaRoute) pathname = "/__entry.txt";
  url.pathname = `/${site}${pathname}`;
  const asset = await env.ASSETS.fetch(new Request(url, request2));
  if (!spaRoute) return asset;
  const headers6 = new Headers(asset.headers);
  headers6.set("Content-Type", "text/html; charset=utf-8");
  return new Response(asset.body, { status: asset.status, headers: headers6 });
}
async function statusPix(request2, env) {
  const id = new URL(request2.url).searchParams.get("id");
  if (!id || id.length > 150) return json3({ error: "Transa\xE7\xE3o inv\xE1lida." }, 400);
  const ids = id.split(",").slice(0, 2);
  let order = null;
  for (const candidate of ids) {
    const rows = await db(env, "gokoco_orders", `?transaction_id=eq.${encodeURIComponent(candidate)}&select=*&limit=1`);
    if (rows[0]) {
      order = rows[0];
      break;
    }
  }
  if (!order) return json3({ status: "unknown" }, 404);
  if (order.status === "paid") {
    const shippingTracking2 = await registerOrderTracking(env, order.id, order.updated_at || order.created_at).catch((error) => {
      console.error("[tracking/status]", error.message);
      return null;
    });
    await deliverPaidPurchase(env, db, order.id).catch((error) => console.error("[purchase/status]", error.message));
    await deliverPaidEmail(env, db, order.id).catch((error) => console.error("[email/status]", error.message));
    return json3({ status: "paid", isPaid: true, amount: Number(order.amount), trackingCode: shippingTracking2?.code || null, eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
  }
  const result = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
  const status = result.isPaid ? "paid" : result.isRefunded ? "refunded" : result.isExpired ? "expired" : "pending";
  if (status !== order.status) await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&status=eq.${encodeURIComponent(order.status)}`, "PATCH", { status, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  let shippingTracking = null;
  if (status === "paid") {
    shippingTracking = await registerOrderTracking(env, order.id, result.paidAt || (/* @__PURE__ */ new Date()).toISOString()).catch((error) => {
      console.error("[tracking/status]", error.message);
      return null;
    });
    await deliverPaidPurchase(env, db, order.id, result.paidAt || (/* @__PURE__ */ new Date()).toISOString()).catch((error) => console.error("[purchase/status]", error.message));
    await deliverPaidEmail(env, db, order.id, result.paidAt || (/* @__PURE__ */ new Date()).toISOString()).catch((error) => console.error("[email/status]", error.message));
  }
  return json3({ status, isPaid: status === "paid", isExpired: result.isExpired, amount: Number(order.amount), trackingCode: shippingTracking?.code || null, eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
}
function createTrackingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `GK${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}
async function registerOrderTracking(env, orderId, paidAt) {
  const rows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&select=id,status,tracking&limit=1`);
  const order = rows[0];
  if (!order) return null;
  if (order.tracking?.shipping?.code) return order.tracking.shipping;
  const code = createTrackingCode();
  const tracking = { ...order.tracking || {}, shipping: { code, created_at: order.tracking?._payment?.paid_at || paidAt || (/* @__PURE__ */ new Date()).toISOString(), status: "confirmed", events: [] } };
  const saved = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { status: "paid", tracking });
  if (saved.length) return tracking.shipping;
  const current = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(orderId)}&select=tracking&limit=1`);
  return current[0]?.tracking?.shipping || null;
}
async function webhook(request2, env) {
  const notification = await request2.json().catch(() => null);
  if (!notification) return json3({ received: true });
  const ids = [
    notification.objectId,
    notification.transactionId,
    notification.transaction_id,
    notification.transactionHash,
    notification.transaction_hash,
    notification.id,
    notification.external_id,
    notification.store_reference,
    notification.object?.id,
    notification.object?.transaction_id,
    notification.object?.transactionId,
    notification.object?.hash,
    notification.transaction?.id,
    notification.transaction?.transaction_id,
    notification.transaction?.hash,
    notification.payment?.id,
    notification.payment?.transaction_id,
    notification.payment?.transactionId,
    notification.data?.objectId,
    notification.data?.transaction_id,
    notification.data?.transactionId,
    notification.data?.transactionHash,
    notification.data?.transaction_hash,
    notification.data?.id,
    notification.data?.transaction?.id,
    notification.data?.transaction?.transaction_id,
    notification.data?.object?.id,
    notification.data?.payment?.id
  ].filter((value) => typeof value === "string" || typeof value === "number").map(String).filter(Boolean);
  const seenIds = /* @__PURE__ */ new Set();
  let matchedOrder = false;
  for (const id of ids) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const byReference = notification.external_id === id || notification.store_reference === id;
    const rows = await db(env, "gokoco_orders", `?${byReference ? "id" : "transaction_id"}=eq.${encodeURIComponent(String(id))}&select=id,transaction_id,gateway,status&limit=1`);
    const order = rows[0];
    if (!order) continue;
    matchedOrder = true;
    const manualRows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&select=tracking&limit=1`);
    if (manualRows[0]?.tracking?.manualPayment) continue;
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isRefunded ? "refunded" : verified.isPaid ? "paid" : order.status === "paid" ? "paid" : verified.isExpired ? "expired" : order.status;
    if (status !== order.status) await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&status=eq.${encodeURIComponent(order.status)}`, "PATCH", { status, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    if (status === "paid") {
      await registerOrderTracking(env, order.id, verified.paidAt || (order.status === "paid" ? void 0 : (/* @__PURE__ */ new Date()).toISOString()));
      const delivery = await deliverPaidPurchase(env, db, order.id, verified.paidAt || (order.status === "paid" ? void 0 : (/* @__PURE__ */ new Date()).toISOString()));
      await deliverPaidEmail(env, db, order.id, verified.paidAt).catch((error) => console.error("[email/webhook]", error.message));
      if (delivery.state === "failed" || delivery.state === "retry_pending" || delivery.state === "busy") return json3({ received: true, retryRequired: true }, 503);
    }
    break;
  }
  if (!seenIds.size) console.warn("[payment/webhook] notifica\xE7\xE3o sem identificador de transa\xE7\xE3o reconhecido", { fields: Object.keys(notification).slice(0, 12) });
  else if (!matchedOrder) console.warn("[payment/webhook] transa\xE7\xE3o recebida sem pedido correspondente", { candidates: ids.length, fields: Object.keys(notification).slice(0, 12) });
  return json3({ received: true });
}
function publicTrackingProducts(products2) {
  const brushImages = {
    preta: "/images/f2/cores/preta.webp",
    branca: "/images/f2/cores/branca.webp",
    rosa: "/images/f2/cores/rosa.webp"
  };
  const accessoryImages = [
    ["wella", "/images/bump-wella.webp"],
    ["taiff", "/images/bump-taiff.webp"],
    ["siage", "/images/bump-siage.webp"],
    ["necessaire", "/images/bump-necessaire.webp"],
    ["escovas", "/images/bump-escovas.webp"]
  ];
  const result = [];
  for (const product of Array.isArray(products2) ? products2.slice(0, 10) : []) {
    const name = String(product?.name || "").slice(0, 150);
    if (!name || /frete|envio/i.test(name)) continue;
    const quantity = Math.max(1, Math.min(20, Number.parseInt(product.quantity, 10) || 1));
    if (/escova\s+modeladora\s+gokoco/i.test(name)) {
      const variants = [...name.matchAll(/\b(preta|branca|rosa)\s*x\s*(\d{1,2})\b/gi)];
      const voltage = name.match(/·\s*(bivolt|110\s*v|220\s*v)\b/i)?.[1] || "";
      if (variants.length) {
        for (const variant of variants) {
          const color = variant[1].toLowerCase();
          result.push({ name: `Escova Modeladora GOKOCO - ${color[0].toUpperCase()}${color.slice(1)}${voltage ? ` \xB7 ${voltage}` : ""}`, quantity: Math.max(1, Number(variant[2])), image: brushImages[color] });
        }
      } else {
        const color = name.match(/\b(preta|branca|rosa)\b/i)?.[1]?.toLowerCase();
        result.push({ name, quantity, image: color ? brushImages[color] : null });
      }
      continue;
    }
    const image = accessoryImages.find(([key]) => name.toLowerCase().includes(key))?.[1] || null;
    result.push({ name, quantity, image });
  }
  return result;
}
async function publicOrderTracking(request2, env) {
  const code = new URL(request2.url).searchParams.get("code")?.trim().toUpperCase() || "";
  if (!/^GK[A-HJ-NP-Z2-9]{10}$/.test(code)) return json3({ error: "C\xF3digo inv\xE1lido ou n\xE3o encontrado." }, 404);
  const rows = await db(env, "gokoco_orders", `?tracking->shipping->>code=eq.${encodeURIComponent(code)}&select=id,name,status,created_at,updated_at,products,shipping,tracking&limit=1`);
  const order = rows[0];
  if (!order || order.status !== "paid" && !(order.status === "tracking_only" && order.tracking?.manualExternal)) return json3({ error: "C\xF3digo inv\xE1lido ou n\xE3o encontrado." }, 404);
  if (order.tracking?.manualExternal) return json3({ code, manual: true, createdAt: order.tracking.shipping.created_at || order.created_at, shipping: order.tracking.shipping, reshipping: publicReshipping(env, order) });
  return json3({
    code,
    buyerName: String(order.name || "").trim().slice(0, 100),
    createdAt: order.tracking.shipping.created_at || order.created_at,
    products: publicTrackingProducts(order.products),
    destination: { city: String(order.shipping?.cidade || "").slice(0, 80), state: String(order.shipping?.uf || "").slice(0, 2) },
    shipping: order.tracking.shipping,
    reshipping: publicReshipping(env, order)
  });
}
async function adminUpdateOrderTracking(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "PATCH") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const body = await request2.json().catch(() => ({}));
  const id = String(body.id || "");
  const code = String(body.code || "").trim().toUpperCase();
  const status = String(body.status || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^GK[A-HJ-NP-Z2-9]{10}$/.test(code)) return json3({ error: "C\xF3digo de rastreio inv\xE1lido." }, 400);
  const stages = {
    confirmed: { label: "Pedido confirmado", detail: "Pagamento aprovado e pedido confirmado." },
    preparing: { label: "Preparando pedido", detail: "Seu pedido est\xE1 sendo separado e preparado." },
    shipped: { label: "Pedido enviado", detail: "Seu pedido foi despachado para entrega." },
    out_for_delivery: { label: "Saiu para entrega", detail: "Seu pedido est\xE1 a caminho do endere\xE7o informado." },
    delivered: { label: "Pedido entregue", detail: "A entrega foi conclu\xEDda." }
  };
  if (!Object.hasOwn(stages, status)) return json3({ error: "Etapa de entrega inv\xE1lida." }, 400);
  const rows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&status=eq.paid&select=id,tracking&limit=1`);
  const order = rows[0];
  if (!order) return json3({ error: "Pedido pago n\xE3o encontrado." }, 404);
  const previous = order.tracking?.shipping || {};
  const previousStageIndex = ["confirmed", "preparing", "shipped", "out_for_delivery", "delivered"].indexOf(previous.status || "confirmed");
  const requestedStageIndex = ["confirmed", "preparing", "shipped", "out_for_delivery", "delivered"].indexOf(status);
  if (status !== "confirmed" && requestedStageIndex < previousStageIndex) return json3({ error: "A etapa s\xF3 pode avan\xE7ar. Escolha a etapa atual ou uma etapa posterior." }, 409);
  if (status === "confirmed" && previous.status && previous.status !== "confirmed") return json3({ error: "O rastreio j\xE1 avan\xE7ou e n\xE3o pode voltar \xE0 confirma\xE7\xE3o." }, 409);
  const tracking = {
    ...order.tracking || {},
    shipping: {
      ...previous,
      code: previous.code || code,
      created_at: previous.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      status,
      events: status === "confirmed" ? [] : [...Array.isArray(previous.events) ? previous.events.filter((event) => event.status !== "confirmed") : [], { status, label: stages[status].label, detail: stages[status].detail, at: (/* @__PURE__ */ new Date()).toISOString() }]
    }
  };
  const saved = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { tracking, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  if (!saved.length) return json3({ error: "O pedido mudou durante a atualiza\xE7\xE3o. Atualize a lista e tente novamente." }, 409);
  return json3({ ok: true, shipping: tracking.shipping });
}
async function adminManualPayment(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const body = await request2.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json3({ error: "Pedido inv\xE1lido." }, 400);
  const rows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&select=id,status,tracking&limit=1`);
  const order = rows[0];
  if (!order) return json3({ error: "Pedido n\xE3o encontrado." }, 404);
  if (!["pending", "expired", "failed", "paid"].includes(order.status)) return json3({ error: "Este pedido n\xE3o pode ser marcado como pago." }, 409);
  if (order.status !== "paid") {
    const paidAt = (/* @__PURE__ */ new Date()).toISOString();
    const tracking = { ...order.tracking || {}, manualPayment: { paidAt, source: "admin", method: "external" } };
    const saved = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&status=eq.${order.status}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { status: "paid", tracking, updated_at: paidAt });
    if (!saved.length) return json3({ error: "O pedido mudou. Atualize a lista e tente novamente." }, 409);
  }
  const shipping = await registerOrderTracking(env, id);
  if (!shipping?.code) return json3({ error: "Pagamento salvo. Tente gerar o rastreio novamente." }, 409);
  await deliverPaidPurchase(env, db, id);
  await deliverPaidEmail(env, db, id).catch((error) => console.error("[email/admin]", error.message));
  return json3({ ok: true, shipping });
}
async function adminGenerateTracking(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const body = await request2.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json3({ error: "Pedido inv\xE1lido." }, 400);
  const rows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&status=eq.paid&select=id&limit=1`);
  if (!rows.length) return json3({ error: "Marque o pagamento como recebido antes de gerar o rastreio." }, 409);
  const shipping = await registerOrderTracking(env, id);
  if (!shipping?.code) return json3({ error: "N\xE3o foi poss\xEDvel gerar o rastreio. Tente novamente." }, 409);
  await deliverPaidEmail(env, db, id).catch((error) => console.error("[email/tracking]", error.message));
  return json3({ ok: true, shipping });
}
async function adminCreateExternalTracking(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method === "GET") {
    const rows = await db(env, "gokoco_orders", "?gateway=eq.manual_tracking&select=id,created_at,tracking&order=created_at.desc&limit=30");
    return json3({ codes: rows.map((row) => ({ id: row.id, code: row.tracking?.shipping?.code, createdAt: row.created_at })).filter((row) => row.code) });
  }
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const code = createTrackingCode();
  const order = {
    checkout_id: `external-tracking-${crypto.randomUUID()}`,
    name: "Rastreio manual",
    email: "",
    phone: "",
    document: "",
    amount: 0.01,
    products: [],
    shipping: {},
    tracking: { manualExternal: true, shipping: { code, created_at: now, status: "confirmed", events: [] } },
    gateway: "manual_tracking",
    status: "tracking_only",
    created_at: now,
    updated_at: now
  };
  const saved = await db(env, "gokoco_orders", "?select=id", "POST", order);
  if (!saved.length) return json3({ error: "N\xE3o foi poss\xEDvel salvar o rastreio." }, 500);
  return json3({ ok: true, code, id: saved[0].id }, 201);
}
async function adminGateways(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method === "GET") return json3({ gateways: await listGateways2(env) });
  if (request2.method !== "PATCH") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const { id, enabled } = await request2.json().catch(() => ({}));
  if (!gateways.some((g) => g.id === id) || typeof enabled !== "boolean") return json3({ error: "Gateway inv\xE1lido." }, 400);
  if (enabled && !configured(env, id)) return json3({ error: "Configure a chave deste gateway no Cloudflare antes de ativ\xE1-lo." }, 400);
  if (enabled && gateways.find((g) => g.id === id)?.method === "pix") await db(env, "gokoco_gateways", "?enabled=eq.true&id=neq.venuspay", "PATCH", { enabled: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  await db(env, "gokoco_gateways", "?on_conflict=id", "POST", { id, enabled, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  return json3({ gateways: await listGateways2(env) });
}
async function adminOrders(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "GET") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const params = new URL(request2.url).searchParams;
  const offset = Number(params.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 200 !== 0) return json3({ error: "P\xE1gina de pedidos inv\xE1lida." }, 400);
  const before = params.get("before");
  if (before && !Number.isFinite(Date.parse(before))) return json3({ error: "Data de consulta inv\xE1lida." }, 400);
  if (offset === 0) {
    const missingTracking = encodeURIComponent("tracking->shipping->>code");
    const paidOrders = await db(env, "gokoco_orders", `?status=eq.paid&${missingTracking}=is.null&select=id,tracking,updated_at,created_at&order=created_at.desc&limit=3`);
    await Promise.allSettled(paidOrders.map(
      (order) => registerOrderTracking(env, order.id, order.updated_at || order.created_at)
    ));
    await retryPaidPurchases(env);
  }
  const rows = await db(env, "gokoco_orders", `?gateway=neq.manual_tracking${before ? `&created_at=lte.${encodeURIComponent(before)}` : ""}&select=id,created_at,name,email,phone,amount,products,gateway,status,transaction_id,shipping,tracking&order=created_at.desc,id.desc&limit=200&offset=${offset}`);
  return json3({ orders: rows.map(({ tracking, ...order }) => ({ ...order, siteVariant: tracking?.site_variant === "mercado_livre" ? "tl" : "gokoco", shippingTracking: tracking?.shipping || null, manualPayment: tracking?.manualPayment || null, recovery: tracking?._recovery || null, reshipping: tracking?.reshipping ? { status: tracking.reshipping.status, amount: tracking.reshipping.amount, transaction_id: tracking.reshipping.transaction_id || null, gateway: tracking.reshipping.gateway || null, created_at: tracking.reshipping.created_at || null, confirmed_at: tracking.reshipping.confirmed_at || null, manual: !!tracking.reshipping.manual, hasReceipt: !!tracking.reshipping.receipt?.path } : null, purchase: purchaseSummary(env, { ...order, tracking }) })) });
}
async function adminSendOrderEmail(request2, env) {
  const denied = await requireAdmin(request2, env);
  if (denied) return denied;
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const body = await request2.json().catch(() => ({}));
  const id = String(body.id || "");
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !subject || subject.length > 150 || !message || message.length > 5e3) return json3({ error: "Confira o pedido, assunto e mensagem." }, 400);
  const rows = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(id)}&gateway=neq.manual_tracking&select=id,name,email,status,tracking&limit=1`);
  if (!rows.length) return json3({ error: "Pedido n\xE3o encontrado." }, 404);
  const result = await sendManualOrderEmail(env, rows[0], subject, message);
  if (result.state === "not_configured") return json3({ error: "Configure o Resend no servidor para enviar e-mails." }, 503);
  if (result.state === "invalid_input") return json3({ error: "O e-mail do cliente, assunto ou mensagem \xE9 inv\xE1lido." }, 400);
  if (result.state !== "sent") return json3({ error: "O Resend n\xE3o confirmou o envio. Tente novamente." }, 502);
  return json3({ ok: true, email_id: result.email_id });
}
async function reconcilePendingPayments(env, limit = 2, deferFulfillment = false, newestFirst = false) {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const cooldownMs = newestFirst ? 2e4 : deferFulfillment ? 6e4 : 0;
  const cooldown = cooldownMs ? `&updated_at=lte.${encodeURIComponent(new Date(Date.now() - cooldownMs).toISOString())}` : "";
  const order = newestFirst ? "created_at.desc" : "updated_at.asc,created_at.asc";
  const pending = await db(env, "gokoco_orders", `?select=id,transaction_id,gateway,status,updated_at,tracking&status=in.(pending,expired,failed)&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}${cooldown}&order=${order}&limit=${Math.max(1, Math.min(10, Number(limit) || 2))}`);
  const summary = { checked: 0, paid: 0, expired: 0, failed: 0, rateLimited: false, failures: [] };
  for (const order2 of pending.filter((item) => item.transaction_id)) {
    let claimedAt;
    try {
      const previousUpdatedAt = Date.parse(order2.updated_at || "") || 0;
      claimedAt = new Date(Math.max(Date.now(), previousUpdatedAt + 1)).toISOString();
      const updateFilter = order2.updated_at ? `updated_at=eq.${encodeURIComponent(order2.updated_at)}` : "updated_at=is.null";
      const claimed = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order2.id)}&status=eq.${order2.status}&${updateFilter}&select=id`, "PATCH", { updated_at: claimedAt });
      if (!claimed.length) continue;
      summary.checked++;
      const verified = await queryPixGatewayStatus(env, order2.transaction_id, order2.gateway);
      const status = verified.isPaid ? "paid" : verified.isRefunded ? "refunded" : verified.isExpired ? "expired" : "pending";
      if (status === "pending") continue;
      const updated = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order2.id)}&status=eq.${order2.status}&updated_at=eq.${encodeURIComponent(claimedAt)}&tracking=eq.${encodeURIComponent(JSON.stringify(order2.tracking || {}))}&select=id`, "PATCH", {
        status,
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        ...status === "paid" ? { tracking: { ...order2.tracking || {}, _payment: { paid_at: verified.paidAt || (/* @__PURE__ */ new Date()).toISOString() } } } : {}
      });
      if (!updated.length) continue;
      if (status === "paid") {
        summary.paid++;
        if (deferFulfillment) continue;
        const paidAt = verified.paidAt || (/* @__PURE__ */ new Date()).toISOString();
        await registerOrderTracking(env, order2.id, paidAt);
        await deliverPaidPurchase(env, db, order2.id, paidAt);
        await deliverPaidEmail(env, db, order2.id, paidAt);
      } else {
        summary.expired++;
      }
    } catch (error) {
      summary.failed++;
      const gateway = String(order2.gateway || "desconhecido").slice(0, 32);
      const reason = String(error?.message || "Falha de comunica\xE7\xE3o").slice(0, 100);
      const entry = summary.failures.find((item) => item.gateway === gateway && item.reason === reason);
      if (entry) entry.count++;
      else if (summary.failures.length < 8) summary.failures.push({ gateway, reason, count: 1 });
      console.error("[payment/reconcile]", order2.gateway, order2.id, error?.message || error);
      if (/HTTP 429\b/.test(reason)) {
        summary.rateLimited = true;
        break;
      }
    }
  }
  return summary;
}
async function reconcileReshippingFees(env, limit = 3) {
  const rows = await db(env, "gokoco_orders", `?select=id,tracking,updated_at&tracking->reshipping->>status=in.(pending,receipt_sent)&order=updated_at.asc&limit=${Math.max(1, Math.min(10, Number(limit) || 3))}`);
  const summary = { checked: 0, paid: 0 };
  for (const order of rows) {
    const fee = order.tracking?.reshipping;
    if (!fee?.transaction_id) continue;
    try {
      const verified = await queryPixGatewayStatus(env, fee.transaction_id, fee.gateway).catch(() => ({}));
      summary.checked++;
      if (!verified?.isPaid) continue;
      const tracking = { ...order.tracking || {}, reshipping: { ...fee, status: "paid", confirmed_at: verified.paidAt || (/* @__PURE__ */ new Date()).toISOString() } };
      const saved = await db(env, "gokoco_orders", `?id=eq.${encodeURIComponent(order.id)}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, "PATCH", { tracking, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      if (saved.length) {
        summary.paid++;
        await deliverReshippingFee(env, db, order.id).catch((e) => console.error("[reshipping/utmify]", order.id, e?.message || e));
      }
    } catch (error) {
      console.error("[reshipping/reconcile]", order.id, error?.message || error);
    }
  }
  return summary;
}
async function reconcilePaymentsRoute(request2, env) {
  const cron = Boolean(env.CRON_SECRET && request2.headers.get("x-cron-secret") === env.CRON_SECRET);
  if (!cron) {
    const denied = await requireAdmin(request2, env);
    if (denied) return denied;
  }
  if (request2.method !== "POST") return json3({ error: "M\xE9todo inv\xE1lido." }, 405);
  const payments = await reconcilePendingPayments(env, 3, true, !cron);
  payments.reshipping = await reconcileReshippingFees(env, payments.rateLimited ? 0 : 3);
  return json3(payments);
}
async function fulfillConfirmedPayment(env) {
  const rows = await db(env, "gokoco_orders", "?status=eq.paid&gateway=neq.manual_tracking&tracking->shipping->>code=is.null&select=id,tracking,updated_at&order=updated_at.desc&limit=1");
  if (!rows.length) return;
  const order = rows[0], paidAt = order.tracking?._payment?.paid_at || order.updated_at;
  await registerOrderTracking(env, order.id, paidAt);
  await deliverPaidPurchase(env, db, order.id, paidAt);
  await deliverPaidEmail(env, db, order.id, paidAt);
}
async function retryPaidPurchases(env, limit = 3) {
  const destination = purchaseDestination(env);
  if (!destination) return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const path = `tracking->_purchase->${destination}->>state`;
  const rows = await db(env, "gokoco_orders", `?status=eq.paid&gateway=neq.manual_tracking&updated_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.asc&limit=${limit}`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidPurchase(env, db, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === "fulfilled" && r.value.state === "sent").length, failed: results.filter((r) => r.status === "rejected" || r.value?.state === "failed").length };
}
async function retryPendingPurchases(env) {
  if (purchaseDestination(env) !== "utmify") return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const path = "tracking->_purchase->utmify_pending->>state";
  const rows = await db(env, "gokoco_orders", `?status=eq.pending&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.desc&limit=1`);
  if (rows[0]) await deliverPendingPurchase(env, db, rows[0].id);
  return { configured: true, processed: rows.length };
}
var index_default = {
  async fetch(request2, env, ctx) {
    const url = new URL(request2.url);
    try {
      const path = url.pathname;
      if (["/tl/admin", "/tl/admin.html", "/video/admin", "/video/admin.html"].includes(path)) return Response.redirect(new URL("/admin.html", env.SITE_URL || request2.url), 302);
      if (path.startsWith("/video/api/")) {
        const response = await bellaRoute(path.slice("/video".length), request2, env, ctx);
        return response || json3({ error: "Rota inv\xE1lida." }, 404);
      }
      if (path === "/api/admin/login") return await onRequest({ request: request2, env });
      if (path === "/api/admin/verify") return json3({ valid: (await verifyAdminToken(request2, env)).valid });
      if (path === "/api/admin/gateways") return await adminGateways(request2, env);
      if (path === "/api/admin/orders") return await adminOrders(request2, env);
      if (path === "/api/admin/bella-orders") return await adminBellaOrders(request2, env);
      if (path === "/api/admin/bella-card") return await adminBellaCard(request2, env);
      if (path === "/api/admin/bella-tracking-email") return await adminBellaTrackingEmail(request2, env);
      if (path === "/api/admin/reconcile-payments") return await reconcilePaymentsRoute(request2, env);
      if (path === "/api/admin/send-order-email") return await adminSendOrderEmail(request2, env);
      if (path === "/api/admin/order-tracking") return await adminUpdateOrderTracking(request2, env);
      if (path === "/api/admin/manual-payment") return await adminManualPayment(request2, env);
      if (path === "/api/admin/generate-tracking") return await adminGenerateTracking(request2, env);
      if (path === "/api/admin/external-tracking") return await adminCreateExternalTracking(request2, env);
      if (path === "/api/public/order-tracking" && request2.method === "GET") return await publicOrderTracking(request2, env);
      if (path.startsWith("/api/public/reshipping-fee/") || path === "/api/admin/reshipping-receipt" || path === "/api/admin/reshipping-fee/paid") {
        const handled = await handleReshippingRoute(path, request2, env, {
          db,
          json: json3,
          listGateways: listGateways2,
          requireAdmin,
          queryPixGatewayStatus,
          deliverReshippingFee,
          providers: { ironpay: createPixIronpay, masterfy: createPixMasterfy, umbrellapag: createPixUmbrellapag, venuspay_pix: createPixVenuspay, flevopay: createPixFlevopay }
        });
        if (handled) return handled;
      }
      if (path === "/api/process-purchase-queue" && request2.method === "POST") {
        const secret = String(env.CRON_SECRET || "");
        if (!secret || request2.headers.get("x-cron-secret") !== secret) return json3({ error: "N\xE3o autorizado." }, 401);
        const phase = url.searchParams.get("phase");
        if (phase === "recovery") return json3({ recovery: await processRecoveryQueue(env, db, queryPixGatewayStatus) });
        const payments = phase === "fulfillment" ? null : await reconcilePendingPayments(env, 2, true);
        await fulfillConfirmedPayment(env);
        const purchases = await retryPaidPurchases(env, 1);
        const pendingPurchases = await retryPendingPurchases(env);
        const emails = await retryPaidEmails(env, db);
        const recovery = phase === "fulfillment" ? null : await processRecoveryQueue(env, db, queryPixGatewayStatus, 1);
        return json3({ payments, purchases, pendingPurchases, emails, recovery });
      }
      if (path === "/api/market/pix/create" && request2.method === "POST") return await createMarketPix(request2, env, ctx);
      if (path === "/api/public/pix/create" && request2.method === "POST") return await createPix(request2, env, ctx);
      if (path === "/api/public/pix/status" && request2.method === "GET") return await statusPix(request2, env);
      if (path === "/api/pix/webhook" && request2.method === "POST") return await webhook(request2, env);
      if (path.startsWith("/api/")) return json3({ error: "Rota n\xE3o encontrada." }, 404);
      return siteAsset(request2, env);
    } catch (error) {
      console.error("[gokoco]", error?.message || error);
      return json3({ message: error?.message || "Erro interno do servidor." }, 500);
    }
  }
};
export {
  index_default as default
};
