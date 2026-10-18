// Cloudflare Pages Function — /api/fb-purchase
// Convertido de netlify/functions/fb-purchase.js
// Usa Web Crypto API (disponivel globalmente no Cloudflare Workers)
import { sendFacebookPurchase } from "../_lib/facebook.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });

  if (!env.FB_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "Pixel nao configurado" }), { status: 500, headers: corsHeaders });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders }); }

  try {
    const result = await sendFacebookPurchase(env, payload);
    console.log("FB CAPI response:", result.status, result.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
