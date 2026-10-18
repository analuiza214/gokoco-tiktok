function appendScript(src: string, attributes: Record<string, string> = {}) {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
  document.head.appendChild(script);
}

export function initializeMarketingScripts() {
  const gtmId = String(import.meta.env.VITE_GTM_ID || "").trim();
  const gaId = String(import.meta.env.VITE_GA_ID || "").trim();
  const utmifyPixelId = String(import.meta.env.VITE_UTMIFY_PIXEL_ID || "").trim();

  window.dataLayer = window.dataLayer || [];

  if (gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
  }

  if (gaId) {
    appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);
    const gtag = (...args: unknown[]) => window.dataLayer.push(args as unknown as Record<string, unknown>);
    gtag("js", new Date());
    gtag("config", gaId);
  }

  if (utmifyPixelId) {
    (window as unknown as { pixelId: string }).pixelId = utmifyPixelId;
    appendScript("https://cdn.utmify.com.br/scripts/pixel/pixel.js");
  }

  {
    const target = window as unknown as Record<string, unknown>;
    if (typeof target.fbq !== "function") {
      type FbqLoader = ((...args: unknown[]) => void) & {
        callMethod?: (...args: unknown[]) => void;
        queue: unknown[][];
        loaded: boolean;
        version: string;
      };
      const fbq = ((...args: unknown[]) => {
        if (typeof fbq.callMethod === "function") fbq.callMethod(...args);
        else fbq.queue.push(args);
      }) as FbqLoader;
      Object.assign(fbq, { queue: [], loaded: true, version: "2.0" });
      target.fbq = fbq;
      target._fbq = fbq;
      // Preserve events emitted while the public pixel ID loads from the server.
      void fetch(import.meta.env.BASE_URL + "api/marketing-config", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const config = await response.json();
          const pixelId = String(config.facebookPixelId || "");
          if (!/^\d+$/.test(pixelId)) return;
          fbq.queue.unshift(["init", pixelId], ["track", "PageView"]);
          appendScript("https://connect.facebook.net/en_US/fbevents.js");
        })
        .catch(() => { /* Marketing availability must not interrupt checkout. */ });
    }
  }
}
