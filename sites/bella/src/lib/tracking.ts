declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export function saveTrackingParams(): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  const params = new URLSearchParams(window.location.search);
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "src",
    "sck",
    "gclid",
    "fbclid",
    "ttclid",
  ];
  const now = Date.now();
  keys.forEach((key) => {
    const value = params.get(key);
    if (value) {
      localStorage.setItem(key, value);
      localStorage.setItem(`${key}_saved_at`, String(now));
    }
  });
}

export function getTrackingParams(): Record<string, string | null> {
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  const read = (key: string): string | null => {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const savedAt = Number(localStorage.getItem(`${key}_saved_at`) || 0);
    if (savedAt && Date.now() - savedAt > maxAge) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_saved_at`);
      return null;
    }
    return value;
  };
  const cookie = (name: string) => document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;
  const fbclid = read("fbclid");
  return {
    utm_source: read("utm_source"),
    utm_medium: read("utm_medium"),
    utm_campaign: read("utm_campaign"),
    utm_content: read("utm_content"),
    utm_term: read("utm_term"),
    src: read("src"),
    sck: read("sck"),
    gclid: read("gclid"),
    fbclid,
    ttclid: read("ttclid"),
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc") || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
  };
}

export function getGaClientId(): string | null {
  const match = document.cookie.match(/_ga=GA1\.1\.(\d+\.\d+)/);
  if (match && match[1]) return match[1];
  return null;
}

export function pushEcommerceEvent(
  eventName: string,
  ecommerceData: Record<string, unknown>,
  extraData: Record<string, unknown> = {}
): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: eventName,
    ...extraData,
    ecommerce: ecommerceData,
  });

  const metaEventNames: Record<string, string> = {
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    purchase: "Purchase",
  };
  const metaEventName = metaEventNames[eventName];
  const fbq = (window as unknown as Record<string, unknown>).fbq as ((...args: unknown[]) => void) | undefined;
  if (metaEventName && typeof fbq === "function") {
    const items = Array.isArray(ecommerceData.items) ? ecommerceData.items as Record<string, unknown>[] : [];
    const eventId = typeof extraData.event_id === "string" ? extraData.event_id : undefined;
    fbq("track", metaEventName, {
      value: ecommerceData.value,
      currency: ecommerceData.currency || "BRL",
      content_type: "product",
      content_ids: items.map((item) => item.item_id).filter(Boolean),
      contents: items.map((item) => ({ id: item.item_id, quantity: item.quantity || 1, item_price: item.price })),
    }, eventId ? { eventID: eventId } : undefined);
  }
}
