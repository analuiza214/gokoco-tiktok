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
    data.point_of_interaction?.transaction_data?.qr_code,
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && c.length > 20) return c;
  }
  return null;
}

/**
 * Imagem PNG do QR Code em base64 ou URL pronta.
 */
function extractQrImage(data) {
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
    data.point_of_interaction?.transaction_data?.qr_code_base64,
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
  const cpfFinal = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio();

  // ── Telefone formatado ──────────────────────────────────────────────────────
  const phoneDigits = phone ? String(phone).replace(/\D/g, "") : "11999999999";
  const phoneFinal = phoneDigits.length >= 10 ? phoneDigits : "11999999999";

  const customer = {
    name: String(name),
    email: email ? String(email) : "cliente@email.com",
    document: cpfFinal,
    phone: phoneFinal,
  };

  const productPayload = env.VENUS_PAY_PRODUCT_ID
    ? { id: env.VENUS_PAY_PRODUCT_ID, name: productName || "Pedido Bella Mix" }
    : { name: productName || "Pedido Bella Mix" };

  // ── Payload híbrido: envia campos tanto estruturados (customer/product)
  // quanto soltos na raiz para garantir total compatibilidade com a VenusPay ──
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
    ...(env.VENUS_PAY_PRODUCT_ID ? { product_id: env.VENUS_PAY_PRODUCT_ID } : {}),
    ...(address?.zipCode ? {
      address: {
        zip_code:     String(address.zipCode).replace(/\D/g, ""),
        street:       String(address.street  || ""),
        number:       String(address.number  || "S/N"),
        complement:   address.complement ? String(address.complement) : "",
        neighborhood: String(address.neighborhood || "Centro"),
        city:         String(address.city  || ""),
        state:        String(address.state || "").toUpperCase().slice(0, 2),
        country:      "BR",
      },
    } : {}),
    metadata: {
      source: "bellamix",
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
        Authorization: `Bearer ${secretKey}`,
        "x-api-key": secretKey,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      console.error("[VENUSPAY_PIX] Resposta não-JSON recebida:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Erro de comunicação com o gateway Venus Pay." }),
        { status: 502, headers: corsHeaders }
      );
    }

    console.log(JSON.stringify({
      event: "VENUSPAY_PIX_RESPONSE",
      httpStatus: res.status,
      success: data.success,
      status: data.status,
      gateway: data.gateway || null,
      errors: data.error || data.message || null,
    }));

    if (!res.ok || data.success === false) {
      const errorMsg =
        data.error ||
        data.message ||
        (Array.isArray(data.errors) ? data.errors.join(", ") : typeof data.errors === "string" ? data.errors : null) ||
        "Erro ao gerar PIX na Venus Pay. Tente novamente.";
      return new Response(
        JSON.stringify({
          error: errorMsg,
          details: data,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const transactionId =
      data.transaction_id ||
      data.id ||
      data.data?.transaction_id ||
      data.data?.id ||
      data.data?.payment?.transaction_id ||
      data.data?.payment?.id ||
      null;

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

    const qrCodeBase64 = extractQrImage(data);
    const qrCodeImage =
      data.qr_code_url ||
      data.pix?.qr_code_url ||
      data.data?.qr_code_url ||
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;

    return new Response(
      JSON.stringify({
        transactionId: String(transactionId),
        gateway: "venuspay_pix",
        status: String(data.status || data.data?.status || "pending").toLowerCase(),
        pixCode,
        qrCodeBase64: qrCodeBase64 || null,
        qrCodeImage,
        expiresAt: data.expiration_date || data.expires_at || data.pix?.expiration_date || null,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[VENUSPAY_PIX] Exceção na requisição:", err?.message);
    return new Response(
      JSON.stringify({ error: "Erro de comunicação com o gateway." }),
      { status: 502, headers: corsHeaders }
    );
  }
}

/**
 * Consulta o status da transação.
 * Endpoint público da VenusPay.
 * Statuses: pending | approved | failed | expired | refunded | chargeback
 */
export async function statusPixVenuspay(context, corsHeaders, transactionId) {
  const { env } = context;
  const secretKey = env?.VENUS_PAY_SECRET_KEY || "";
  try {
    const headers = {
      Accept: "application/json",
      ...(secretKey ? { Authorization: `Bearer ${secretKey}`, "x-api-key": secretKey } : {}),
    };
    const res = await fetch(
      `${STATUS_URL}?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: "GET", headers }
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

    const rawStatus = String(data.status || data.data?.status || "pending").toLowerCase();
    const isPaid =
      rawStatus === "approved" ||
      rawStatus === "paid" ||
      (data.success === true && (data.paid === true || rawStatus === "approved"));
    const isExpired =
      rawStatus === "expired" ||
      rawStatus === "failed" ||
      rawStatus === "refunded" ||
      rawStatus === "chargeback" ||
      rawStatus === "canceled" ||
      rawStatus === "cancelled";

    return new Response(
      JSON.stringify({
        transactionId,
        gateway: "venuspay_pix",
        status: isPaid ? "approved" : rawStatus,
        isPaid,
        isExpired,
        payedAt: isPaid ? data.paid_at || data.data?.paid_at || data.created_at || null : null,
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
