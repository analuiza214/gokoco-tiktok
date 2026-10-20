// A captura de atribuição é feita por /js/purchase-attribution.js (mesmo script do
// site principal, mesma origem e mesma chave gokoco_attribution). Aqui ficam só os
// tipos e os helpers de envio de eventos/payload para o backend unificado.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    getUTMs?: () => Record<string, string>;
    getFbData?: () => { fbp: string; fbc: string };
    trackGoogleAdsPurchase?: (amount: number, transactionId: string) => void;
  }
}

export function fbqTrack(event: string, data: Record<string, unknown>, eventId?: string): void {
  if (typeof window.fbq !== "function") return;
  try {
    if (eventId) window.fbq("track", event, data, { eventID: eventId });
    else window.fbq("track", event, data);
  } catch { /* Tracking nunca pode quebrar o checkout. */ }
}

export function trackingPayload(): { tracking: Record<string, string>; fb: { fbp: string; fbc: string } } {
  return {
    tracking: window.getUTMs ? window.getUTMs() : {},
    fb: window.getFbData ? window.getFbData() : { fbp: "", fbc: "" },
  };
}

// Purchase no navegador com o mesmo event_id do CAPI (pix_<orderId>) — deduplicação.
// No modo UTMify o envio ao pixel é feito pelo script da UTMify, igual ao site principal.
export function trackBrowserPurchase(opts: {
  eventId?: string;
  transactionId?: string;
  purchaseDestination?: string | null;
  amount: number;
  numItems?: number;
}): void {
  const { eventId, transactionId, purchaseDestination, amount, numItems } = opts;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return;
  const id = eventId || (transactionId ? `pix_${transactionId}` : `pix_${Date.now()}`);
  if (purchaseDestination !== "utmify") {
    try {
      const sentKey = `gokoco_purchase_${id}`;
      if (!localStorage.getItem(sentKey)) {
        fbqTrack("Purchase", {
          value, currency: "BRL", content_type: "product",
          content_ids: ["gokoco_escova"], num_items: Math.max(1, Math.round(numItems || 1)),
        }, id);
        localStorage.setItem(sentKey, "1");
      }
    } catch { /* ignored */ }
  }
  try { window.trackGoogleAdsPurchase?.(value, id.replace(/^pix_/, "") || String(transactionId || id)); } catch { /* ignored */ }
}
