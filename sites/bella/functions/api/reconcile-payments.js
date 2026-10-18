import { verifyAdminToken } from "../_lib/admin-auth.js";
import { fulfillPaidPixLead, listPendingPixLeads, updateLeadById } from "../_lib/leads-store.js";
import { queryPixGatewayStatus } from "../_lib/pix-gateway-status.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const cronAuthorized = Boolean(env.CRON_SECRET && request.headers.get("x-cron-secret") === env.CRON_SECRET);
  const adminAuthorized = (await verifyAdminToken(request, env)).valid;
  if (!cronAuthorized && !adminAuthorized) return json({ error: "Não autorizado." }, 401);

  try {
    const leads = await listPendingPixLeads(env, 50);
    let paid = 0;
    let expired = 0;
    let pending = 0;
    let errors = 0;
    for (const lead of leads) {
      try {
        const result = await queryPixGatewayStatus(env, lead.transaction_id, lead.gateway || "ironpay");
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
    return json({ ok: true, checked: leads.length, paid, expired, pending, errors });
  } catch (error) {
    console.error("[reconcile-payments] Falha geral:", error?.message);
    return json({ error: "Não foi possível sincronizar os pagamentos." }, 502);
  }
}
