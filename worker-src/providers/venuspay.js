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

export async function createPixVenuspay(context, corsHeaders, body) {
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
          error: data.error || "Erro ao gerar PIX. Tente novamente.",
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
export async function statusPixVenuspay(context, corsHeaders, transactionId) {
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

