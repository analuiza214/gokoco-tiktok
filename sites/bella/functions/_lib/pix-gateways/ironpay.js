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

export async function createPixIronpay(context, corsHeaders, body) {
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
  const payerDocument = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio();

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

export async function statusPixIronpay(context, corsHeaders, transactionId) {
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
