// Cloudflare Pages Function — /api/pix/status
// Consulta status no gateway PIX ativo (IronPay, MasterFy, UmbrellaPag ou Venus Pay).
//
// Parâmetros GET aceitos:
//   ?id=... ou ?transactionId=...  — ID da transação (obrigatório)
//   ?gateway=ironpay|masterfy|umbrellapag|venuspay_pix  — força um gateway (opcional;
//                                    usado pela tela de sucesso quando o PIX
//                                    foi gerado antes de trocar o gateway no admin)

import { getActivePixGateway } from "../../_lib/gateway-config.js";
import { fulfillPaidPixLead, updatePixLeadStatus } from "../../_lib/leads-store.js";
import { queryPixGatewayStatus } from "../../_lib/pix-gateway-status.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const url = new URL(request.url);
  // Suporte a ambos os parâmetros: transactionId e id
  const transactionId = url.searchParams.get("transactionId") || url.searchParams.get("id");

  if (!transactionId) {
    return new Response(JSON.stringify({ error: "transactionId obrigatorio" }), { status: 400, headers: corsHeaders });
  }

  // Se ?gateway= foi informado, usa esse; senão consulta o ativo no admin
  const gatewayParam = url.searchParams.get("gateway");
  const activeGateway = gatewayParam || await getActivePixGateway(context.env);

  if (!activeGateway) {
    return new Response(JSON.stringify({ error: "Nenhum gateway PIX ativo." }), { status: 503, headers: corsHeaders });
  }

  try {
    const verified = await queryPixGatewayStatus(context.env, transactionId, activeGateway);
    if (verified.isPaid) {
      const fulfillment = await fulfillPaidPixLead(context.env, transactionId, verified.paidAt);
      return new Response(JSON.stringify({ ...verified, status: "paid", ...fulfillment }), { status: 200, headers: corsHeaders });
    }
    if (verified.isExpired) {
      await updatePixLeadStatus(context.env, transactionId, "expirado");
      return new Response(JSON.stringify({ ...verified, status: "expired" }), { status: 200, headers: corsHeaders });
    }
    await updatePixLeadStatus(context.env, transactionId, "pix_gerado");
    return new Response(JSON.stringify({ ...verified, status: "pending" }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[pix/status] Falha ao consultar ou concluir pagamento:", error?.message);
    return new Response(JSON.stringify({ error: "Erro ao consultar status do pagamento." }), { status: 502, headers: corsHeaders });
  }
}
