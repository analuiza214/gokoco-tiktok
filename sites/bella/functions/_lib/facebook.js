import { FACEBOOK_PIXEL_ID } from "./meta-config.js";

async function hash(value) {
  if (!value) return undefined;
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sendFacebookPurchase(env, payload) {
  const pixelId = FACEBOOK_PIXEL_ID;
  const accessToken = String(env.FB_ACCESS_TOKEN || "").trim();
  if (!pixelId || !accessToken) throw new Error("Pixel da Meta não configurado.");

  const { user_data: userData = {}, custom_data: customData = {}, event_id: eventId } = payload || {};
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || undefined,
      action_source: "website",
      event_source_url: String(env.SITE_URL || "").trim() || undefined,
      user_data: {
        em: userData.em?.[0] ? [await hash(userData.em[0])] : undefined,
        ph: userData.ph?.[0] ? [await hash(userData.ph[0])] : undefined,
        fn: userData.fn?.[0] ? [await hash(userData.fn[0])] : undefined,
        ln: userData.ln?.[0] ? [await hash(userData.ln[0])] : undefined,
        fbc: userData.fbc || undefined,
        fbp: userData.fbp || undefined,
      },
      custom_data: customData,
    }],
  };

  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Meta CAPI respondeu ${response.status}: ${responseText}`);
  return { status: response.status, body: responseText };
}
