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

export async function createPixUmbrellapag(context, corsHeaders, body) {
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
  const taxId = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio();
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
    metadata: JSON.stringify({ source: "loja-bella-mix", product: productName || "Pedido" }),
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

export async function statusPixUmbrellapag(context, corsHeaders, transactionId) {
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
