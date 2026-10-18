// Cloudflare Pages Function — /api/utmify-order
import { sendUtmifyOrder } from "../_lib/utmify.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400, headers: corsHeaders }); }

  const {
    orderId,
    status,
    customerName,
    customerEmail,
    customerPhone,
    customerDocument,
    productName,
    valueInCents,
    tracking,
    paymentMethod,
  } = body;

  try {
    const result = await sendUtmifyOrder(env, {
      orderId, status, customerName, customerEmail, customerPhone,
      customerDocument, productName, valueInCents, tracking, paymentMethod,
    });
    return new Response(JSON.stringify({ ok: true, utmifyStatus: result.status }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[utmify-order]", err?.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
