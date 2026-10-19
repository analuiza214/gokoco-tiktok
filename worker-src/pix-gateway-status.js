import { statusPixIronpay } from "./providers/ironpay.js";
import { statusPixMasterfy } from "./providers/masterfy.js";
import { statusPixUmbrellapag } from "./providers/umbrellapag.js";
import { statusPixVenuspay } from "./providers/venuspay.js";
import { statusPixFlevopay } from "./providers/flevopay.js";

const headers = { "Content-Type": "application/json" };

export async function queryPixGatewayStatus(env, transactionId, gateway) {
  let response;
  const context = { env };
  if (gateway === "masterfy") response = await statusPixMasterfy(context, headers, transactionId);
  else if (gateway === "umbrellapag") response = await statusPixUmbrellapag(context, headers, transactionId);
  else if (gateway === "venuspay_pix") response = await statusPixVenuspay(context, headers, transactionId);
  else if (gateway === "flevopay") response = await statusPixFlevopay(context, headers, transactionId);
  else response = await statusPixIronpay(context, headers, transactionId);
  const data = await response.json();
  if (!response.ok) throw new Error(`${data?.error || 'Falha na consulta ao gateway.'}${data?.upstreamStatus ? ` HTTP ${data.upstreamStatus}` : ''}`);
  const normalized = String(data.status || "").trim().toLowerCase();
  const isRefunded = Boolean(data.isRefunded) || ["refunded", "refund", "reembolsado", "reembolsada"].includes(normalized);
  return {
    ...data,
    status: normalized,
    isPaid: Boolean(data.isPaid) || ["paid", "approved", "pago"].includes(normalized),
    isRefunded,
    isExpired: !isRefunded && (Boolean(data.isExpired) || ["expired", "cancelled", "canceled"].includes(normalized)),
    paidAt: data.paidAt || data.payedAt || null,
  };
}
