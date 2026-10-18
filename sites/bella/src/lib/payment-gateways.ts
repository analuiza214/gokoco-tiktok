export type PaymentGatewayMethod = "pix" | "card";

export interface PaymentGateway {
  id: string;
  name: string;
  method: PaymentGatewayMethod;
  enabled: boolean;
  configured: boolean;
  updated_at?: string | null;
}

export const GATEWAY_METHOD_LABELS: Record<PaymentGatewayMethod, string> = {
  pix: "PIX",
  card: "Cartão",
};

/** Nome de exibição de cada gateway, usado nos pedidos do admin. */
export const GATEWAY_NAMES: Record<string, string> = {
  ironpay: "IronPay",
  masterfy: "MasterFy",
  umbrellapag: "UmbrellaPag",
  venuspay: "Venus Pay",
  venuspay_pix: "Venus Pay",
};

export function gatewayLabel(id?: string | null): string | null {
  if (!id) return null;
  return GATEWAY_NAMES[id] || id;
}
