// Cloudflare Pages Function — /api/card/create
// Gateway: Venus Pay — Pagamento com Cartão de Crédito
// Autenticação: Bearer token (VENUS_PAY_SECRET_KEY)
// Endpoint: https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment

import { listGateways } from "../../_lib/gateway-config.js";
import { fulfillPaidLead, getLeadById, updateLeadById } from "../../_lib/leads-store.js";
import { cardAmount } from "../../_lib/catalog.js";

function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let sum = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((sum * 10) % 11) % 10);
  sum = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((sum * 10) % 11) % 10);
  return d.join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const gateways = await listGateways(env);
  const venuspay = gateways.find((g) => g.id === "venuspay");
  const useMasterfy = gateways.find((g) => g.id === "masterfy_card")?.enabled === true;

  if (!useMasterfy && venuspay && !venuspay.enabled) {
    return new Response(
      JSON.stringify({ error: "Pagamento por cartão temporariamente indisponível." }),
      { status: 503, headers: corsHeaders }
    );
  }

  if (useMasterfy && !env.MASTERFY_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento não configurado." }),
      { status: 500, headers: corsHeaders }
    );
  }

  // ── Credenciais Venus Pay ────────────────────────────────────────────────────
  const secretKey = env.VENUS_PAY_SECRET_KEY;
  const productId = env.VENUS_PAY_PRODUCT_ID || null;

  if (!useMasterfy && !secretKey) {
    return new Response(
      JSON.stringify({ error: "Gateway de pagamento não configurado." }),
      { status: 500, headers: corsHeaders }
    );
  }

  // ── Parse do body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido." }), {
      status: 400,
      headers: corsHeaders,
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
    orderId,
  } = body;

  if (!name || !orderId || (useMasterfy ? !body.cardToken : !card?.number)) {
    return new Response(
      JSON.stringify({ error: "Campos obrigatórios: amount, name, card e orderId." }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── CPF ──────────────────────────────────────────────────────────────────────
  const cpfRaw   = card.cpf || (document ? String(document).replace(/\D/g, "") : "");
  const cpfFinal = cpfRaw.length === 11 ? cpfRaw : gerarCpfAleatorio();

  // ── Telefone ─────────────────────────────────────────────────────────────────
  const phoneFinal = phone ? String(phone).replace(/\D/g, "") : "11999999999";

  // ── Parcelas ─────────────────────────────────────────────────────────────────
  const numParcelas = Math.max(1, Math.min(12, parseInt(String(installments || 1), 10)));

  let order;
  try {
    order = await getLeadById(env, orderId);
  } catch {
    return new Response(JSON.stringify({ error: "Não foi possível validar o pedido." }), { status: 502, headers: corsHeaders });
  }
  if (!order || order.metodo_pagamento !== "card" || order.status !== "checkout_iniciado") {
    return new Response(JSON.stringify({ error: "Pedido inválido ou já processado." }), { status: 409, headers: corsHeaders });
  }

  if (useMasterfy) {
    const clientIp = request.headers.get("cf-connecting-ip") || "";
    return processCardMasterfy(env, corsHeaders, order, body, { cpfFinal, phoneFinal, numParcelas, clientIp });
  }

  // ── Validade do cartão ───────────────────────────────────────────────────────
  const expMonthRaw = String(card.expiryMonth || "").padStart(2, "0");
  const expYearRaw  = String(card.expiryYear || "");
  const expYear     = expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw;

  // ── Número do cartão — remove espaços ────────────────────────────────────────
  const cardNumber = String(card.number || "").replace(/\s/g, "");

  // ── Valor em BRL decimal (Venus Pay NÃO usa centavos) ────────────────────────
  const amountDecimal = cardAmount(order.valor, numParcelas);

  // ── Payload Venus Pay ────────────────────────────────────────────────────────
  const productPayload = productId
    ? { id: productId, name: order.produtos || productName || "Pedido Bella Mix" }
    : { name: order.produtos || productName || "Pedido Bella Mix" };

  const payload = {
    amount: amountDecimal,
    payment_method: "credit_card",
    product: productPayload,
    customer: {
      name:     String(name),
      email:    email ? String(email) : "cliente@email.com",
      document: cpfFinal,
      phone:    phoneFinal,
    },
    card_data: {
      number:           cardNumber,
      holder_name:      String(card.holderName || name),
      expiration_month: parseInt(expMonthRaw, 10),
      expiration_year:  parseInt(expYear, 10),
      cvv:              String(card.cvv || ""),
      installments:     numParcelas,
    },
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
      source:        "bellamix",
      customer_name: String(name),
      city:          address?.city  || "",
      state:         address?.state || "",
    },
  };

  // ── Chamada à API Venus Pay ──────────────────────────────────────────────────
  const VENUS_PAY_URL =
    "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment";

  try {
    const res = await fetch(VENUS_PAY_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log(JSON.stringify({
      event:      "VENUS_PAY_CARD_RESPONSE",
      httpStatus: res.status,
      success:    data.success,
      status:     data.status,
      errors:     data.error || null,
    }));

    if (!res.ok && !data.status) {
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        card_erro: String(data.error || "Erro ao processar cartão.").slice(0, 500),
      });
      return new Response(
        JSON.stringify({
          status: "error",
          error:  data.error || "Erro ao processar cartão. Tente novamente.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const transactionId = data.transaction_id || data.id || null;

    // ── Lógica de status Venus Pay (extraída do bundle oficial) ───────────────
    //
    //   success: true  → transação processada pelo banco → approved
    //   success: false → recusada/erro:
    //       status "declined"/"refused"/"failed" → declined
    //       qualquer outro → error
    //
    // NÃO usamos data.status como critério principal porque Venus Pay retorna
    // "processing" mesmo quando success=true e o pagamento já foi confirmado.

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
      const errMsg = data.error || "Cartão recusado pelo emissor.";
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        ...(transactionId ? { transaction_id: transactionId } : {}),
        card_erro: String(errMsg).slice(0, 500),
      });
      console.log(JSON.stringify({
        event:         "VENUS_PAY_CARD_DECLINED",
        transactionId: transactionId || null,
        rawStatus,
        reason:        errMsg,
      }));
      return new Response(
        JSON.stringify({
          status: "declined",
          error:  errMsg,
          ...(transactionId ? { transactionId } : {}),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (internalStatus === "error" || !transactionId) {
      const errMsg = data.error || "Erro ao processar pagamento. Tente novamente.";
      await updateLeadById(env, orderId, {
        status: "cartao_recusado",
        gateway: "venuspay",
        card_erro: String(errMsg).slice(0, 500),
      });
      console.log(JSON.stringify({
        event:  "VENUS_PAY_CARD_ERROR",
        rawStatus,
        reason: errMsg,
      }));
      return new Response(
        JSON.stringify({ status: "error", error: errMsg }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(JSON.stringify({
      event:         "VENUS_PAY_CARD_TRANSACTION",
      transactionId,
      rawStatus,
      internalStatus,
      amount:        amountDecimal,
      installments:  numParcelas,
    }));

    let fulfillmentPending = false;
    try {
      const linked = await updateLeadById(env, orderId, {
        status: "cartao_processando",
        transaction_id: transactionId,
        gateway: "venuspay",
        cpf: cpfFinal,
        valor: amountDecimal,
      });
      if (linked) {
        await fulfillPaidLead(env, transactionId, new Date().toISOString(), "credit_card");
      } else {
        fulfillmentPending = true;
        console.error("[card/create] Cartão aprovado, mas o pedido interno não foi encontrado:", orderId);
      }
    } catch (fulfillmentError) {
      fulfillmentPending = true;
      console.error("[card/create] Cartão aprovado; finalização pendente:", fulfillmentError?.message);
    }

    return new Response(
      JSON.stringify({
        transactionId,
        status:       internalStatus,
        rawStatus,
        amount:       amountDecimal,
        installments: numParcelas,
        fulfillmentPending,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    if (body?.orderId) {
      try {
        await updateLeadById(env, body.orderId, {
          status: "cartao_recusado",
          gateway: "venuspay",
          card_erro: "Erro de comunicação com o gateway.",
        });
      } catch { /* preserva a resposta original */ }
    }
    return new Response(
      JSON.stringify({ status: "error", error: "Erro de comunicação com o gateway." }),
      { status: 200, headers: corsHeaders }
    );
  }
}


// -- MasterFy Cartao -----------------------------------------------------------
// Recebe o cardToken gerado no frontend pelo script oficial MasterFy.
// POST https://api.masterfypagamentos.com/v1/payment (method=CREDIT_CARD).
async function processCardMasterfy(env, corsHeaders, order, body, { cpfFinal, phoneFinal, numParcelas, clientIp }) {
  const gw = 'masterfy_card';
  const amountDecimal = cardAmount(order.valor, numParcelas);
  const amountInCents = Math.round(amountDecimal * 100);
  const hasAddress = body.address && body.address.street && body.address.city;
  const siteUrl = (env.BELLA_SITE_URL || env.SITE_URL || '').trim();

  const payload = {
    amount: amountInCents,
    currency: 'BRL',
    method: 'CREDIT_CARD',
    description: String(order.produtos || body.productName || 'Pedido').slice(0, 255),
    externalRef: order.id || body.orderId || undefined,
    ...(siteUrl ? { notificationUrl: siteUrl.replace(/\/$/, '') + '/api/pix/webhook' } : {}),
    ...(clientIp ? { ip: clientIp.slice(0, 45) } : {}),
    payer: {
      name: String(body.name),
      taxId: cpfFinal,
      email: body.email ? String(body.email) : 'cliente@email.com',
      phone: phoneFinal || '11999999999',
    },
    card: { token: String(body.cardToken), installments: numParcelas, chargeInterest: false },
    items: [{ name: String(order.produtos || 'Pedido').slice(0, 256), quantity: 1, price: amountInCents, type: hasAddress ? 'PHYSICAL' : 'DIGITAL' }],
    ...(hasAddress ? { delivery: { fee: 0, address: {
      street: String(body.address.street), number: String(body.address.number || 'S/N'),
      complement: String(body.address.complement || ''), district: String(body.address.neighborhood || ''),
      city: String(body.address.city), state: String(body.address.state || '').toUpperCase().slice(0, 2),
      zipCode: String(body.address.zipCode || '').replace(/\D/g, ''), country: 'BR',
    } } } : {}),
  };

  try {
    const res = await fetch('https://api.masterfypagamentos.com/v1/payment', {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.MASTERFY_API_KEY },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      console.error('[masterfy_card]', res.status, JSON.stringify(data).slice(0, 500));
      await updateLeadById(env, body.orderId, { status: 'cartao_recusado', gateway: gw, card_erro: 'Erro ao processar cartao no gateway.' });
      return new Response(JSON.stringify({ status: 'error', error: 'Erro ao processar cartao. Tente novamente.' }), { status: 200, headers: corsHeaders });
    }

    const transactionId = data.id || null;
    const rawStatus = String(data.status || '').toUpperCase();
    const isPaid = rawStatus === 'PAID';
    const isRefused = ['REFUSED', 'CHARGEDBACK', 'MED', 'REFUNDED'].includes(rawStatus);

    console.log(JSON.stringify({ event: 'MASTERFY_CARD_RESPONSE', httpStatus: res.status, transactionId, rawStatus, amount: amountDecimal, installments: numParcelas }));

    if (!transactionId) {
      await updateLeadById(env, body.orderId, { status: 'cartao_recusado', gateway: gw, card_erro: 'Resposta invalida do gateway.' });
      return new Response(JSON.stringify({ status: 'error', error: 'Erro ao processar cartao. Tente novamente.' }), { status: 200, headers: corsHeaders });
    }

    if (isRefused) {
      await updateLeadById(env, body.orderId, { status: 'cartao_recusado', gateway: gw, transaction_id: transactionId, card_erro: 'Cartao recusado (' + rawStatus + ').' });
      return new Response(JSON.stringify({ status: 'declined', transactionId, error: 'Pagamento recusado pelo emissor.' }), { status: 200, headers: corsHeaders });
    }

    if (isPaid) {
      try {
        const linked = await updateLeadById(env, body.orderId, { status: 'cartao_processando', gateway: gw, transaction_id: transactionId, cpf: cpfFinal, valor: amountDecimal });
        if (linked) await fulfillPaidLead(env, transactionId, new Date().toISOString(), 'credit_card');
      } catch (e) { console.error('[masterfy_card] fulfillment:', e?.message); }
      return new Response(JSON.stringify({ transactionId, status: 'approved', rawStatus: rawStatus.toLowerCase(), amount: amountDecimal, installments: numParcelas }), { status: 200, headers: corsHeaders });
    }

    await updateLeadById(env, body.orderId, { status: 'cartao_processando', gateway: gw, transaction_id: transactionId, cpf: cpfFinal, valor: amountDecimal });
    return new Response(JSON.stringify({ transactionId, status: 'pending', rawStatus: rawStatus.toLowerCase(), amount: amountDecimal, installments: numParcelas }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[masterfy_card]', err?.message || err);
    await updateLeadById(env, body.orderId, { status: 'cartao_recusado', gateway: gw, card_erro: 'Erro de comunicacao com o gateway.' }).catch(() => {});
    return new Response(JSON.stringify({ status: 'error', error: 'Erro de comunicacao com o gateway.' }), { status: 200, headers: corsHeaders });
  }
}
