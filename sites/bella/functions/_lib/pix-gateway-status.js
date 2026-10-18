import { statusPixIronpay } from "./pix-gateways/ironpay.js";
import { statusPixMasterfy } from "./pix-gateways/masterfy.js";
import { statusPixUmbrellapag } from "./pix-gateways/umbrellapag.js";
import { statusPixVenuspay } from "./pix-gateways/venuspay.js";

const headers = { "Content-Type": "application/json" };

export async function queryPixGatewayStatus(env, transactionId, gateway) {
  let response;
  const context = { env };
  if (gateway === "masterfy") response = await statusPixMasterfy(context, headers, transactionId);
  else if (gateway === "umbrellapag") response = await statusPixUmbrellapag(context, headers, transactionId);
  else if (gateway === "venuspay_pix") response = await statusPixVenuspay(context, headers, transactionId);
  else response = await statusPixIronpay(context, headers, transactionId);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Gateway respondeu ${response.status}.`);
  const normalized = String(data.status || "").trim().toLowerCase();
  return {
    ...data,
    status: normalized,
    isPaid: Boolean(data.isPaid) || ["paid", "approved", "pago"].includes(normalized),
    isExpired: Boolean(data.isExpired) || ["expired", "cancelled", "canceled", "refunded"].includes(normalized),
    paidAt: data.paidAt || data.payedAt || null,
  };
}
