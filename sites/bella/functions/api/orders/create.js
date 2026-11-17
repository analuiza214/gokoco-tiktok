import { priceFor, publicPrice } from '../../../../../worker-src/product-pricing.js';
import {capturePurchaseTracking} from '../../../../../worker-src/purchase-tracking.js';
import { createCheckoutLead } from "../../_lib/leads-store.js";
import { validateCartItems } from "../../_lib/catalog.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const method = body?.paymentMethod === "card" ? "card" : "pix";
  if (!body?.name || !body?.email) {
    return json({ error: "Dados obrigatórios do pedido não informados." }, 400);
  }
  try {
    const cart = validateCartItems(body.items, method, env.PRODUCT_PRICES);
    if (body.amount !== undefined && Math.abs(Math.round(Number(body.amount) * 100) - Math.round(cart.amount * 100)) > 1) return json({ error: 'O preço mudou. Atualize a página para conferir o novo valor.', code: 'price_changed' }, 409);
    const pricing = cart.items.map(item => priceFor(env.PRODUCT_PRICES, item.id)).filter(p => p?.version).map(publicPrice);
    const lead = await createCheckoutLead(env, { ...body, ...cart, _serverPricing: pricing, _serverBrowser: capturePurchaseTracking(request,body)._browser }, method);
    return json({ ok: true, orderId: lead.id, tracking: lead.tracking }, 201);
  } catch (error) {
    console.error("[orders/create] Falha ao salvar pedido:", error?.message);
    const invalidCart = String(error?.message || "").includes("carrinho") || String(error?.message || "").includes("produto");
    return json({ error: invalidCart ? error.message : "Não foi possível registrar o pedido. Tente novamente." }, invalidCart ? 400 : 502);
  }
}
