// Cloudflare Pages Function — /api/pix/webhook
// Convertido de netlify/functions/pix-webhook.js
// Recebe notificacoes da IronPay, MasterFy, UmbrellaPag e VenusPay e responde
// 200 para evitar reenvios.
//
// VenusPay: a URL deste webhook precisa ser cadastrada manualmente em
// Dashboard -> API -> Webhooks no painel da VenusPay (ela nao aceita
// postback_url na requisicao). Eventos: sale.approved, sale.declined,
// sale.refunded, sale.chargeback, pix.generated, checkout.started.
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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const notification = await request.json();
    const isIronpay = !!(notification.transaction_hash || notification.payment_status);
    const isUmbrellapag =
      !isIronpay &&
      (!!notification.objectId || notification.paymentMethod === "PIX" || notification.data?.paymentMethod === "PIX");
    // VenusPay envia { event: "sale.approved", timestamp, data: { transaction_id, ... } }
    const isVenuspay =
      !isIronpay &&
      !isUmbrellapag &&
      typeof notification.event === "string" &&
      !!notification.data?.transaction_id;
    const isMasterfy = !isIronpay && !isUmbrellapag && !isVenuspay && !!notification.id;
    const event = isUmbrellapag
      ? "UMBRELLAPAG_WEBHOOK_RECEIVED"
      : isVenuspay
        ? "VENUSPAY_WEBHOOK_RECEIVED"
        : isMasterfy
          ? "MASTERFY_WEBHOOK_RECEIVED"
          : "IRONPAY_WEBHOOK_RECEIVED";
    const paymentId =
      notification.objectId ||
      notification.data?.transaction_id ||
      notification.data?.id ||
      notification.transaction_hash ||
      notification.transactionId ||
      notification.transaction_id ||
      notification.id ||
      null;
    const gateway = isUmbrellapag ? "umbrellapag" : isVenuspay ? "venuspay_pix" : isMasterfy ? "masterfy" : "ironpay";

    if (paymentId) {
      try {
        // O conteúdo público do webhook não é aceito sozinho: o servidor
        // consulta o gateway usando a credencial privada antes de marcar pago.
        const verified = await queryPixGatewayStatus(context.env, String(paymentId), gateway);
        if (verified.isPaid) await fulfillPaidPixLead(context.env, String(paymentId), verified.paidAt);
        else if (verified.isExpired) await updatePixLeadStatus(context.env, String(paymentId), "expirado");
      } catch (error) {
        console.error("[pix/webhook] Falha ao validar pagamento no gateway:", error?.message);
      }
    }
    console.log(JSON.stringify({
      event,
      ...(isVenuspay ? { venuspay_event: notification.event } : {}),
      payment_id: paymentId,
      status: notification.status || notification.data?.status || notification.payment_status || null,
      amount: notification.amount || notification.data?.amount || null,
    }));
  } catch {
    // corpo invalido — responde 200 mesmo assim para nao gerar retentativas
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
}
