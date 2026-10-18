// Cloudflare Pages Function — /api/pix/create
// Proteção por IP: máximo 5 tentativas por hora por IP usando Cloudflare KV
// Roteia para IronPay, MasterFy, UmbrellaPag ou Venus Pay conforme o gateway PIX
// ativo no painel admin.
//
// Fluxo:
//   1. Valida o pedido e escolhe um gateway configurado
//   2. Verifica o limite por IP (KV binding: PIX_RATELIMIT)
//   3. Delega para ironpay.js, masterfy.js, umbrellapag.js ou venuspay.js
//   4. Conta somente cobranças geradas com sucesso

import { getActivePixGateway } from "../../_lib/gateway-config.js";
import { createPixIronpay } from "../../_lib/pix-gateways/ironpay.js";
import { createPixMasterfy } from "../../_lib/pix-gateways/masterfy.js";
import { createPixUmbrellapag } from "../../_lib/pix-gateways/umbrellapag.js";
import { createPixVenuspay } from "../../_lib/pix-gateways/venuspay.js";
import { getLeadById, savePixLead } from "../../_lib/leads-store.js";
import { sendUtmifyOrder } from "../../_lib/utmify.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const LIMITE_TENTATIVAS = 5;      // máximo de PIX por IP
const JANELA_SEGUNDOS   = 3600;   // janela de 1 hora (em segundos)

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  // ── Parse do body (lido uma vez aqui e repassado ao provider) ──
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), { status: 400, headers: corsHeaders });
  }

  let order;
  try {
    order = await getLeadById(env, body.orderId);
  } catch {
    return new Response(JSON.stringify({ error: "Não foi possível validar o pedido." }), { status: 502, headers: corsHeaders });
  }
  if (!order || order.metodo_pagamento !== "pix" || order.status !== "checkout_iniciado") {
    return new Response(JSON.stringify({ error: "Pedido PIX inválido ou já processado." }), { status: 409, headers: corsHeaders });
  }
  const safeBody = {
    ...body,
    amount: Number(order.valor),
    productName: order.produtos,
  };

  // ── Roteamento de gateway PIX (configurado no painel /admin) ──
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

  const ip = request.headers.get("CF-Connecting-IP") ||
             request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
             "unknown";
  // v2 desconsidera contadores antigos que incluíam chamadas com falha.
  const kvKey = `ratelimit:pix:v2:${ip}`;
  let currentCount = 0;
  if (env.PIX_RATELIMIT) {
    try {
      const current = await env.PIX_RATELIMIT.get(kvKey);
      currentCount = current ? Number.parseInt(current, 10) || 0 : 0;
      if (currentCount >= LIMITE_TENTATIVAS) {
        return new Response(
          JSON.stringify({ error: "Muitas cobranças PIX geradas. Aguarde 1 hora antes de tentar novamente.", bloqueado: true }),
          { status: 429, headers: corsHeaders },
        );
      }
    } catch (kvError) {
      console.error("[RATE LIMIT] Erro ao consultar KV:", kvError);
    }
  }

  let response;
  if (activeGateway === "masterfy") response = await createPixMasterfy(context, corsHeaders, safeBody);
  else if (activeGateway === "umbrellapag") response = await createPixUmbrellapag(context, corsHeaders, safeBody);
  else if (activeGateway === "venuspay_pix") response = await createPixVenuspay(context, corsHeaders, safeBody);
  else response = await createPixIronpay(context, corsHeaders, safeBody);

  if (!response.ok) return response;
  try {
    const result = await response.clone().json();
    await savePixLead(env, safeBody, result, activeGateway);
    if (env.PIX_RATELIMIT) {
      try {
        await env.PIX_RATELIMIT.put(kvKey, String(currentCount + 1), { expirationTtl: JANELA_SEGUNDOS });
      } catch (kvError) {
        console.error("[RATE LIMIT] Erro ao registrar cobrança no KV:", kvError);
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
        tracking: safeBody.tracking,
      });
    } catch (trackingError) {
      console.error("[pix/create] Falha ao registrar PIX na UTMify:", trackingError?.message);
    }
  } catch (persistError) {
    console.error("[pix/create] PIX criado, mas não foi possível vinculá-lo ao pedido:", persistError?.message);
    return new Response(JSON.stringify({ error: "PIX gerado, mas o pedido não pôde ser registrado. Tente novamente." }), { status: 502, headers: corsHeaders });
  }
  return response;
}
