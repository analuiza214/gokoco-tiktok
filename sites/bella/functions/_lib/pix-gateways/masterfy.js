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

export async function createPixMasterfy(context, corsHeaders, body) {
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
  const taxId = cpfDigits.length === 11 ? cpfDigits : gerarCpfAleatorio();

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

export async function statusPixMasterfy(context, corsHeaders, transactionId) {
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
