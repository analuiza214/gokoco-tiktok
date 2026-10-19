import { onRequest as adminLogin } from './admin-login.js';
import { verifyAdminToken } from './admin-auth.js';
import { createPixIronpay } from './providers/ironpay.js';
import { createPixMasterfy } from './providers/masterfy.js';
import { createPixUmbrellapag } from './providers/umbrellapag.js';
import { createPixVenuspay } from './providers/venuspay.js';
import { queryPixGatewayStatus } from './pix-gateway-status.js';
import { capturePurchaseTracking, recoverCustomerAttribution, purchaseDestination, purchaseSummary, deliverPaidPurchase, deliverPendingPurchase } from './purchase-tracking.js';
import { deliverPaidEmail, retryPaidEmails, sendManualOrderEmail } from './order-email.js';
import { processRecoveryQueue } from './recovery-email.js';
import { handleReshippingRoute, publicReshipping } from './reshipping-fee.js';
import { onRequest as bellaOrdersCreate } from '../sites/bella/functions/api/orders/create.js';
import { onRequest as bellaPixCreate } from '../sites/bella/functions/api/pix/create.js';
import { onRequest as bellaPixStatus } from '../sites/bella/functions/api/pix/status.js';
import { onRequest as bellaPixWebhook } from '../sites/bella/functions/api/pix/webhook.js';
import { onRequest as bellaCardCreate } from '../sites/bella/functions/api/card/create.js';
import { onRequest as bellaCardStatus } from '../sites/bella/functions/api/card/status.js';
import { onRequest as bellaTracking } from '../sites/bella/functions/api/tracking.js';
import { onRequest as bellaMarketingConfig } from '../sites/bella/functions/api/marketing-config.js';
import { onRequest as bellaCheckoutHealth } from '../sites/bella/functions/api/checkout-health.js';
import { onRequest as bellaSendTrackingEmail } from '../sites/bella/functions/api/send-tracking-email.js';
import { onRequest as bellaSendRecoveryEmail } from '../sites/bella/functions/api/send-recovery-email.js';
import { onRequest as bellaProcessRecoveryQueue } from '../sites/bella/functions/api/process-recovery-queue.js';
import { onRequest as bellaReconcilePayments } from '../sites/bella/functions/api/reconcile-payments.js';
import { onRequest as bellaFbPurchase } from '../sites/bella/functions/api/fb-purchase.js';
import { onRequest as bellaUtmifyOrder } from '../sites/bella/functions/api/utmify-order.js';
import { listGateways as listBellaGateways, setGatewayEnabled as setBellaGatewayEnabled } from '../sites/bella/functions/_lib/gateway-config.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const gateways = [
  { id: 'ironpay', name: 'IronPay' },
  { id: 'masterfy', name: 'MasterFy' },
  { id: 'umbrellapag', name: 'UmbrellaPag' },
  { id: 'venuspay_pix', name: 'Venus Pay PIX' },
];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const digits = (value) => String(value || '').replace(/\D/g, '');
const BUMPS = { necessaire: 19.47, siage: 32.63, wella: 45.70 };
const COLORS = { Preta: 37.90, Branca: 37.90, Rosa: 37.90 };
const SHIPPING = { 'Frete Grátis': 0, JADLOG: 18.47, 'SEDEX 12': 33.40 };
function normalizeBuyerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email.slice(0, at).replace(/\.+$/, '')}@${email.slice(at + 1)}` : email;
}
function cartTotal(cart) {
  if (!cart || !Number.isInteger(cart.qty) || cart.qty < 1 || cart.qty > 10) return null;
  let base = 37.90 * cart.qty;
  if (Array.isArray(cart.colors) && cart.colors.length) {
    if (cart.colors.length > 3 || cart.colors.some((c) => !Object.hasOwn(COLORS, c.label) || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 10)) return null;
    if (cart.colors.reduce((sum, c) => sum + c.quantity, 0) !== cart.qty) return null;
    base = cart.colors.reduce((sum, c) => sum + COLORS[c.label] * c.quantity, 0);
  }
  if (!Object.hasOwn(SHIPPING, cart.shipping)) return null;
  if (!Array.isArray(cart.bumps) || cart.bumps.length > 5 || new Set(cart.bumps).size !== cart.bumps.length || cart.bumps.some((id) => !Object.hasOwn(BUMPS, id))) return null;
  if (![1, 0.5].includes(cart.discount) || ![0, 5].includes(cart.bonus)) return null;
  const d = cart.discount;
  const round = (n) => Math.round(n * 100);
  const sum = round(base * d) + round(SHIPPING[cart.shipping] * d)
    + cart.bumps.reduce((acc, id) => acc + round(BUMPS[id] * d), 0) - cart.bonus * 100;
  return Math.max(1, sum) / 100;
}

async function nextPixAmount(env, baseAmount) {
  const baseCents = Math.round(baseAmount * 100);
  const recent = await db(env, 'gokoco_orders', `?amount=gte.${((baseCents + 1) / 100).toFixed(2)}&amount=lte.${((baseCents + 5) / 100).toFixed(2)}&status=neq.failed&select=amount&order=created_at.desc&limit=1`);
  const last = recent.find((row) => {
    const difference = Math.round(Number(row.amount) * 100) - baseCents;
    return difference >= 1 && difference <= 5;
  });
  const lastOffset = last ? Math.round(Number(last.amount) * 100) - baseCents : 0;
  return (baseCents + (lastOffset % 5) + 1) / 100;
}

async function db(env, table, query = '', method = 'GET', body) {
  const base = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!base || !key) throw new Error('Supabase não configurado no servidor.');
  const response = await fetch(`${base}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: query.includes('on_conflict=') ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Banco respondeu ${response.status}: ${value?.message || value?.error || 'erro desconhecido'}`);
  return value;
}

function configured(env, id) {
  if (id === 'ironpay') return !!(env.IRONPAY_API_TOKEN && env.IRONPAY_OFFER_HASH && env.IRONPAY_PRODUCT_HASH);
  if (id === 'masterfy') return !!env.MASTERFY_API_KEY;
  if (id === 'umbrellapag') return !!env.UMBRELLAPAG_API_KEY;
  if (id === 'venuspay_pix') return !!env.VENUS_PAY_SECRET_KEY;
  return false;
}

async function listGateways(env) {
  const rows = await db(env, 'gokoco_gateways', '?select=id,enabled,updated_at');
  return gateways.map((g) => {
    const saved = rows.find((row) => row.id === g.id);
    return { ...g, enabled: !!saved?.enabled, configured: configured(env, g.id), updated_at: saved?.updated_at || null };
  });
}

async function requireAdmin(request, env) {
  const auth = await verifyAdminToken(request, env);
  return auth.valid ? null : json({ error: auth.error || 'Não autorizado.' }, 401);
}

function validateBuyer(body) {
  const buyer = body?.client || {};
  const amount = Number(body?.amount);
  const expected = cartTotal(body?.cart);
  if (!Number.isFinite(amount) || expected === null || Math.abs(Math.round(amount * 100) - Math.round(expected * 100)) > 1) return 'Valor do pedido inválido. Atualize a página e tente novamente.';
  if (String(buyer.name || '').trim().length < 3) return 'Informe seu nome completo.';
  if (!isValidBuyerEmail(normalizeBuyerEmail(buyer.email))) return 'E-mail inválido. Confira o endereço informado e tente novamente.';
  if (![11, 14].includes(digits(buyer.document).length)) return 'CPF/CNPJ inválido.';
  if (digits(buyer.phone).length < 10) return 'Telefone inválido.';
  return null;
}

function isValidBuyerEmail(value) {
  const email = String(value || '').trim();
  if (email.length > 254 || /\.\./.test(email)) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/i.test(email);
}

function validateShipping(shipping) {
  const address = shipping && typeof shipping === 'object' ? shipping : {};
  if (digits(address.cep).length !== 8) return 'Informe um CEP válido para a entrega.';
  for (const [field, label] of [['logradouro', 'endereço'], ['numero', 'número'], ['bairro', 'bairro'], ['cidade', 'cidade']]) {
    if (!String(address[field] || '').trim()) return `Informe ${label} para a entrega.`;
  }
  if (!/^[A-Za-z]{2}$/.test(String(address.uf || '').trim())) return 'Informe a UF com duas letras.';
  return null;
}

// The gateway only receives placeholder contact data; the real e-mail/phone stay in gokoco_orders for the admin.
// A unique alias per order avoids antifraud flags caused by many charges sharing one e-mail.
// Set GATEWAY_MASK_CUSTOMER=false to send the real data again.
function maskedGatewayContact(env, orderId, order) {
  if (String(env.GATEWAY_MASK_CUSTOMER || '').toLowerCase() === 'false') return { email: order.email, phone: order.phone };
  let domain = String(env.GATEWAY_MASK_EMAIL_DOMAIN || '').trim().replace(/^@/, '');
  if (!domain) {
    try { domain = new URL(env.SITE_URL).hostname; } catch { domain = 'gokoco-tiktok.pages.dev'; }
  }
  const ref = String(orderId).replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase() || 'cliente';
  const phone = digits(env.GATEWAY_MASK_PHONE) || '11999999999';
  return { email: `pedido-${ref}@${domain}`, phone };
}

async function createPix(request, env, ctx, siteVariant = 'gokoco') {
  const body = await request.json().catch(() => null);
  if (body?.client) body.client.email = normalizeBuyerEmail(body.client.email);
  const invalid = validateBuyer(body);
  if (invalid) return json({ message: invalid, code: 'invalid_document' }, 400);
  const invalidShipping = validateShipping(body.shipping);
  if (invalidShipping) return json({ message: invalidShipping, code: 'invalid_address' }, 400);
  const checkoutId = String(body.checkoutId || '');
  if (!/^[a-f0-9-]{20,50}$/i.test(checkoutId)) return json({ message: 'Identificador de checkout inválido.' }, 400);
  const previous = await db(env, 'gokoco_orders', `?checkout_id=eq.${encodeURIComponent(checkoutId)}&select=*&limit=1`);
  if (previous[0]?.pix_code) {
    const old = previous[0];
    if (old.status === 'pending' && purchaseDestination(env) === 'utmify') {
      const send = deliverPendingPurchase(env, db, old.id).catch((error) => console.error('[purchase/pending]', old.id, error?.message || error));
      if (ctx?.waitUntil) ctx.waitUntil(send); else await send;
    }
    return json({ copyPaste: old.pix_code, qrCode: old.qr_code, transactionId: old.transaction_id, gatewayTransactionId: old.transaction_id, orderId: old.id, amount: Number(old.amount) });
  }
  if (previous[0] && previous[0].status !== 'failed') return json({ message: 'A cobrança anterior está em processamento. Aguarde um momento.' }, 409);
  const active = (await listGateways(env)).filter((g) => g.enabled);
  if (active.length !== 1) return json({ message: 'Selecione um gateway PIX no painel admin.' }, 503);
  if (!active[0].configured) return json({ message: 'O gateway PIX selecionado precisa de uma chave de API.' }, 503);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = `pix:${ip}`;
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.ADMIN_SESSION_SECRET || ''}:${ip}`));
  const ipHash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, '0')).join('');
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    if (count >= 5) return json({ message: 'Muitas cobranças PIX. Tente novamente em uma hora.' }, 429);
  } else {
    const since = new Date(Date.now() - 3600000).toISOString();
    const recent = await db(env, 'gokoco_orders', `?client_ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&status=eq.pending&select=id&limit=5`);
    if (recent.length >= 5) return json({ message: 'Muitas cobranças PIX. Tente novamente em uma hora.' }, 429);
  }
  const shipping = body.shipping;
  const order = {
    checkout_id: checkoutId,
    name: String(body.client.name).trim().slice(0, 150),
    email: normalizeBuyerEmail(body.client.email),
    phone: digits(body.client.phone),
    document: digits(body.client.document),
    amount: siteVariant === 'mercado_livre' ? cartTotal(body.cart) : await nextPixAmount(env, cartTotal(body.cart)),
    products: Array.isArray(body.products) ? body.products.slice(0, 10) : [],
    shipping,
    tracking: { ...await recoverCustomerAttribution(env, db, capturePurchaseTracking(request, body), body.client), site_variant: siteVariant },
    gateway: active[0].id,
    client_ip_hash: ipHash,
    status: 'creating',
  };
  const saved = previous[0]
    ? await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(previous[0].id)}&status=eq.failed&select=id`, 'PATCH', { ...order, updated_at: new Date().toISOString() })
    : await db(env, 'gokoco_orders', '?select=id', 'POST', order);
  const id = saved?.[0]?.id;
  if (!id) return json({ message: 'A cobrança já está em processamento. Aguarde um momento.' }, 409);
  const gatewayContact = maskedGatewayContact(env, id, order);
  const payload = {
    amount: order.amount, name: order.name, email: gatewayContact.email, phone: gatewayContact.phone,
    document: order.document,
    productName: order.products.map((p) => p.name).filter(Boolean).join(' + ').slice(0, 255) || 'Escova Modeladora GOKOCO',
    address: {
      street: shipping.logradouro, number: shipping.numero, complement: shipping.complemento,
      neighborhood: shipping.bairro, city: shipping.cidade, state: shipping.uf, zipCode: shipping.cep,
    },
  };
  const context = { request, env };
  const headers = { 'Content-Type': 'application/json' };
  const provider = active[0].id;
  const result = provider === 'masterfy' ? await createPixMasterfy(context, headers, payload)
    : provider === 'umbrellapag' ? await createPixUmbrellapag(context, headers, payload)
    : provider === 'venuspay_pix' ? await createPixVenuspay(context, headers, payload)
    : await createPixIronpay(context, headers, payload);
  const payment = await result.json().catch(() => ({}));
  if (!result.ok || !payment.pixCode || !payment.transactionId) {
    await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'failed' });
    const providerMessage = Array.isArray(payment.error?.message)
      ? payment.error.message.join(', ')
      : typeof payment.error === 'string' ? payment.error
      : Array.isArray(payment.message) ? payment.message.join(', ')
      : typeof payment.message === 'string' ? payment.message
      : 'Não foi possível gerar o PIX. Confira seus dados e tente novamente.';
    return json({ message: providerMessage }, result.status || 502);
  }
  const qr = payment.qrCodeBase64 || payment.qrCodeImage || null;
  await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}`, 'PATCH', {
    status: 'pending', transaction_id: String(payment.transactionId), pix_code: payment.pixCode, qr_code: qr,
    updated_at: new Date().toISOString(),
  });
  if (purchaseDestination(env) === 'utmify') {
    const send = deliverPendingPurchase(env, db, id).catch((error) => console.error('[purchase/pending]', id, error?.message || error));
    if (ctx?.waitUntil) ctx.waitUntil(send); else await send;
  }
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    await env.PIX_RATELIMIT.put(ipKey, String(count + 1), { expirationTtl: 3600 });
  }
  return json({ copyPaste: payment.pixCode, qrCode: qr, transactionId: payment.transactionId, gatewayTransactionId: payment.transactionId, orderId: id, amount: order.amount });
}

async function createMarketPix(request, env, ctx) {
  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);
  if (!body || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json({ error: 'Quantidade inválida.' }, 400);
  const adapted = {
    amount: body.amount,
    checkoutId: body.checkoutId,
    client: { name: body.name, email: body.email, phone: body.phone, document: body.document },
    cart: { qty: quantity, shipping: 'Frete Grátis', bumps: [], discount: 1, bonus: 0 },
    shipping: {
      cep: body.address?.zipCode, uf: body.address?.state, cidade: body.address?.city,
      logradouro: body.address?.street, bairro: body.address?.neighborhood,
      numero: body.address?.number, complemento: body.address?.complement || '',
    },
    products: [{ name: 'Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt', quantity, color: String(body.color || '').slice(0, 40), price: 37.90 }],
    tracking: body.tracking || {},
  };
  const internal = new Request(request, { body: JSON.stringify(adapted) });
  const result = await createPix(internal, env, ctx, 'mercado_livre');
  const data = await result.json();
  if (!result.ok) return json({ error: data.message || data.error || 'Não foi possível gerar o PIX.' }, result.status);
  const qr = String(data.qrCode || '');
  const externalImage = /^(data:|https?:\/\/)/i.test(qr);
  return json({ transactionId: data.transactionId, pixCode: data.copyPaste, qrCodeBase64: externalImage ? null : qr, qrCodeImage: externalImage ? qr : null, orderId: data.orderId, amount: data.amount });
}

function marketSiteRequest(url, env) {
  const hostname = String(env.MARKET_HOSTNAME || '').trim().toLowerCase();
  return (hostname && url.hostname.toLowerCase() === hostname) || url.pathname === '/tl' || url.pathname.startsWith('/tl/');
}

function bellaSiteRequest(url, env) {
  const hostname = String(env.BELLA_HOSTNAME || '').trim().toLowerCase();
  return (hostname && url.hostname.toLowerCase() === hostname) || url.pathname === '/video' || url.pathname.startsWith('/video/');
}

function bellaEnvironment(env) {
  const scoped = ['IRONPAY_API_TOKEN', 'IRONPAY_OFFER_HASH', 'IRONPAY_PRODUCT_HASH', 'MASTERFY_API_KEY', 'UMBRELLAPAG_API_KEY', 'VENUS_PAY_SECRET_KEY', 'VENUS_PAY_PRODUCT_ID', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'UTMIFY_API_TOKEN', 'FB_PIXEL_ID', 'FB_ACCESS_TOKEN', 'VITE_GTM_ID', 'VITE_GA_ID', 'VITE_UTMIFY_PIXEL_ID'];
  const paymentKeys = new Set(['IRONPAY_API_TOKEN', 'IRONPAY_OFFER_HASH', 'IRONPAY_PRODUCT_HASH', 'MASTERFY_API_KEY', 'UMBRELLAPAG_API_KEY', 'VENUS_PAY_PRODUCT_ID']);
  return {
    ...env,
    ...Object.fromEntries(scoped.map((key) => [key, env[`BELLA_${key}`] || (paymentKeys.has(key) ? undefined : env[key])])),
    SUPABASE_URL: env.BELLA_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.BELLA_SUPABASE_SERVICE_ROLE_KEY,
    SITE_VARIANT: 'video',
    SITE_URL: env.BELLA_SITE_URL || `${String(env.SITE_URL || 'https://gokoco-tiktok.pages.dev').replace(/\/+$/, '')}/video`,
  };
}

const bellaRoutes = {
  '/api/orders/create': bellaOrdersCreate,
  '/api/pix/create': bellaPixCreate,
  '/api/pix/status': bellaPixStatus,
  '/api/pix/webhook': bellaPixWebhook,
  '/api/card/create': bellaCardCreate,
  '/api/card/status': bellaCardStatus,
  '/api/tracking': bellaTracking,
  '/api/marketing-config': bellaMarketingConfig,
  '/api/checkout-health': bellaCheckoutHealth,
  '/api/send-tracking-email': bellaSendTrackingEmail,
  '/api/send-recovery-email': bellaSendRecoveryEmail,
  '/api/process-recovery-queue': bellaProcessRecoveryQueue,
  '/api/reconcile-payments': bellaReconcilePayments,
  '/api/fb-purchase': bellaFbPurchase,
  '/api/utmify-order': bellaUtmifyOrder,
};

async function bellaRoute(path, request, env, ctx) {
  const handler = bellaRoutes[path];
  if (!handler) return null;
  const url = new URL(request.url);
  url.pathname = path;
  return handler({ request: new Request(url, request), env: bellaEnvironment(env), waitUntil: ctx?.waitUntil?.bind(ctx) });
}

async function adminBellaOrders(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const bella = bellaEnvironment(env);
  const base = String(bella.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(bella.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) return json({ error: 'Banco Bella Mix não configurado.' }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (request.method === 'GET') {
    const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return json({ error: 'Página inválida.' }, 400);
    const rows = await fetch(`${base}/rest/v1/leads?select=id,created_at,nome,email,telefone,produtos,valor,metodo_pagamento,status,transaction_id,codigo_rastreio,gateway,cidade,estado,cep,rua,numero,bairro,tracking&order=created_at.desc&limit=500&offset=${offset}`, { headers });
    if (!rows.ok) return json({ error: 'Não foi possível listar os pedidos Bella Mix.' }, 502);
    return json({ orders: (await rows.json()).map((order) => ({ ...order, siteVariant: order.tracking?.site_variant === 'video' ? 'video' : 'bella_legacy' })) });
  }
  if (request.method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(body.id || ''))) return json({ error: 'Pedido inválido.' }, 400);
    const code = String(body.codigo_rastreio || '').trim().toUpperCase().replace(/[-\s]/g, '');
    if (!/^BM[A-Z0-9]{6,10}$/.test(code)) return json({ error: 'Código Bella Mix inválido. Use BM seguido de 6 a 10 letras ou números.' }, 400);
    const origin = await fetch(`${base}/rest/v1/rastreio_origem?on_conflict=codigo`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ codigo: code, origem_at: new Date().toISOString(), nome_cliente: null }) });
    if (!origin.ok) return json({ error: 'Não foi possível registrar a origem do rastreio.' }, 502);
    const changed = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(body.id)}&select=id,codigo_rastreio`, { method: 'PATCH', headers, body: JSON.stringify({ codigo_rastreio: code, updated_at: new Date().toISOString() }) });
    if (!changed.ok) return json({ error: 'Não foi possível salvar o rastreio.' }, 502);
    return json({ ok: true, order: (await changed.json())[0] || null });
  }
  return json({ error: 'Método inválido.' }, 405);
}

async function adminBellaGateways(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  const bella = bellaEnvironment(env);
  if (request.method === 'GET') return json({ gateways: await listBellaGateways(bella) });
  if (request.method !== 'PATCH') return json({ error: 'Método inválido.' }, 405);
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== 'boolean' || !['ironpay', 'masterfy', 'umbrellapag', 'venuspay', 'venuspay_pix'].includes(body.id)) return json({ error: 'Gateway inválido.' }, 400);
  return json({ gateways: await setBellaGatewayEnabled(bella, body.id, body.enabled) });
}

async function adminBellaTrackingEmail(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const { id } = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return json({ error: 'Pedido inválido.' }, 400);
  const bella = bellaEnvironment(env);
  const base = String(bella.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(bella.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) return json({ error: 'Banco Bella Mix não configurado.' }, 503);
  const found = await fetch(`${base}/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=id,nome,email,codigo_rastreio&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!found.ok) return json({ error: 'Não foi possível consultar o pedido.' }, 502);
  const order = (await found.json())[0];
  if (!order?.email || !/^BM[A-Z0-9]{6,10}$/.test(String(order.codigo_rastreio || ''))) return json({ error: 'Salve um código de rastreio válido antes de enviar o e-mail.' }, 400);
  const mail = new Request(request, { body: JSON.stringify({ emailCliente: order.email, nomeCliente: order.nome, codigoRastreio: order.codigo_rastreio, numeroPedido: order.id }) });
  return bellaSendTrackingEmail({ request: mail, env: bella });
}

async function siteAsset(request, env) {
  const url = new URL(request.url);
  const site = marketSiteRequest(url, env) ? 'tl' : bellaSiteRequest(url, env) ? 'video' : null;
  if (!site) return env.ASSETS.fetch(request);
  let pathname = url.pathname.replace(new RegExp(`^/${site}(?=/|$)`), '') || '/';
  const spaRoute = !/\.[a-z0-9]+$/i.test(pathname) || pathname === '/index.html';
  if (spaRoute) pathname = '/__entry.txt';
  url.pathname = `/${site}${pathname}`;
  const asset = await env.ASSETS.fetch(new Request(url, request));
  if (!spaRoute) return asset;
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(asset.body, { status: asset.status, headers });
}

async function statusPix(request, env) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 150) return json({ error: 'Transação inválida.' }, 400);
  const ids = id.split(',').slice(0, 2);
  let order = null;
  for (const candidate of ids) {
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(candidate)}&select=*&limit=1`);
    if (rows[0]) { order = rows[0]; break; }
  }
  if (!order) return json({ status: 'unknown' }, 404);
  if (order.status === 'paid') {
    const shippingTracking = await registerOrderTracking(env, order.id, order.updated_at || order.created_at).catch((error) => { console.error('[tracking/status]', error.message); return null; });
    await deliverPaidPurchase(env, db, order.id).catch((error) => console.error('[purchase/status]', error.message));
    await deliverPaidEmail(env, db, order.id).catch((error) => console.error('[email/status]', error.message));
    return json({ status: 'paid', isPaid: true, amount: Number(order.amount), trackingCode: shippingTracking?.code || null, eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
  }
  const result = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
  const status = result.isPaid ? 'paid' : result.isRefunded ? 'refunded' : result.isExpired ? 'expired' : 'pending';
  // Uma consulta antiga não pode desfazer um pagamento confirmado em paralelo.
  if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.${encodeURIComponent(order.status)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  let shippingTracking = null;
  if (status === 'paid') {
    shippingTracking = await registerOrderTracking(env, order.id, result.paidAt || new Date().toISOString()).catch((error) => { console.error('[tracking/status]', error.message); return null; });
    await deliverPaidPurchase(env, db, order.id, result.paidAt || new Date().toISOString()).catch((error) => console.error('[purchase/status]', error.message));
    await deliverPaidEmail(env, db, order.id, result.paidAt || new Date().toISOString()).catch((error) => console.error('[email/status]', error.message));
  }
  return json({ status, isPaid: status === 'paid', isExpired: result.isExpired, amount: Number(order.amount), trackingCode: shippingTracking?.code || null, eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
}

function createTrackingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `GK${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

async function registerOrderTracking(env, orderId, paidAt) {
  const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&select=id,status,tracking&limit=1`);
  const order = rows[0];
  if (!order) return null;
  if (order.tracking?.shipping?.code) return order.tracking.shipping;
  const code = createTrackingCode();
  const tracking = { ...(order.tracking || {}), shipping: { code, created_at: order.tracking?._payment?.paid_at || paidAt || new Date().toISOString(), status: 'confirmed', events: [] } };
  const saved = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, 'PATCH', { status: 'paid', tracking });
  if (saved.length) return tracking.shipping;
  const current = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&select=tracking&limit=1`);
  return current[0]?.tracking?.shipping || null;
}

async function webhook(request, env) {
  const notification = await request.json().catch(() => null);
  if (!notification) return json({ received: true });
  const ids = [
    notification.objectId, notification.transactionId, notification.transaction_id, notification.transactionHash, notification.transaction_hash, notification.id,
    notification.object?.id, notification.object?.transaction_id, notification.object?.transactionId, notification.object?.hash,
    notification.transaction?.id, notification.transaction?.transaction_id, notification.transaction?.hash,
    notification.payment?.id, notification.payment?.transaction_id, notification.payment?.transactionId,
    notification.data?.objectId, notification.data?.transaction_id, notification.data?.transactionId, notification.data?.transactionHash,
    notification.data?.transaction_hash, notification.data?.id, notification.data?.transaction?.id, notification.data?.transaction?.transaction_id,
    notification.data?.object?.id, notification.data?.payment?.id,
  ].filter((value) => typeof value === 'string' || typeof value === 'number').map(String).filter(Boolean);
  const seenIds = new Set();
  let matchedOrder = false;
  for (const id of ids) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(String(id))}&select=id,transaction_id,gateway,status&limit=1`);
    const order = rows[0];
    if (!order) continue;
    matchedOrder = true;
    const manualRows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&select=tracking&limit=1`);
    if (manualRows[0]?.tracking?.manualPayment) continue;
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isRefunded ? 'refunded' : verified.isPaid ? 'paid' : order.status === 'paid' ? 'paid' : verified.isExpired ? 'expired' : order.status;
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.${encodeURIComponent(order.status)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (status === 'paid') {
      await registerOrderTracking(env, order.id, verified.paidAt || (order.status === 'paid' ? undefined : new Date().toISOString()));
      const delivery = await deliverPaidPurchase(env, db, order.id, verified.paidAt || (order.status === 'paid' ? undefined : new Date().toISOString()));
      await deliverPaidEmail(env, db, order.id, verified.paidAt).catch((error) => console.error('[email/webhook]', error.message));
      if (delivery.state === 'failed' || delivery.state === 'retry_pending' || delivery.state === 'busy') return json({ received: true, retryRequired: true }, 503);
    }
    break;
  }
  if (!seenIds.size) console.warn('[payment/webhook] notificação sem identificador de transação reconhecido', { fields: Object.keys(notification).slice(0, 12) });
  else if (!matchedOrder) console.warn('[payment/webhook] transação recebida sem pedido correspondente', { candidates: ids.length, fields: Object.keys(notification).slice(0, 12) });
  return json({ received: true });
}

function publicTrackingProducts(products) {
  const brushImages = {
    preta: '/images/f2/cores/preta.webp',
    branca: '/images/f2/cores/branca.webp',
    rosa: '/images/f2/cores/rosa.webp',
  };
  const accessoryImages = [
    ['wella', '/images/bump-wella.webp'], ['taiff', '/images/bump-taiff.webp'],
    ['siage', '/images/bump-siage.webp'], ['necessaire', '/images/bump-necessaire.webp'],
    ['escovas', '/images/bump-escovas.webp'],
  ];
  const result = [];
  for (const product of Array.isArray(products) ? products.slice(0, 10) : []) {
    const name = String(product?.name || '').slice(0, 150);
    if (!name || /frete|envio/i.test(name)) continue;
    const quantity = Math.max(1, Math.min(20, Number.parseInt(product.quantity, 10) || 1));
    if (/escova\s+modeladora\s+gokoco/i.test(name)) {
      const variants = [...name.matchAll(/\b(preta|branca|rosa)\s*x\s*(\d{1,2})\b/gi)];
      const voltage = name.match(/·\s*(bivolt|110\s*v|220\s*v)\b/i)?.[1] || '';
      if (variants.length) {
        for (const variant of variants) {
          const color = variant[1].toLowerCase();
          result.push({ name: `Escova Modeladora GOKOCO - ${color[0].toUpperCase()}${color.slice(1)}${voltage ? ` · ${voltage}` : ''}`, quantity: Math.max(1, Number(variant[2])), image: brushImages[color] });
        }
      } else {
        const color = name.match(/\b(preta|branca|rosa)\b/i)?.[1]?.toLowerCase();
        result.push({ name, quantity, image: color ? brushImages[color] : null });
      }
      continue;
    }
    const image = accessoryImages.find(([key]) => name.toLowerCase().includes(key))?.[1] || null;
    result.push({ name, quantity, image });
  }
  return result;
}

async function publicOrderTracking(request, env) {
  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase() || '';
  if (!/^GK[A-HJ-NP-Z2-9]{10}$/.test(code)) return json({ error: 'Código inválido ou não encontrado.' }, 404);
  const rows = await db(env, 'gokoco_orders', `?tracking->shipping->>code=eq.${encodeURIComponent(code)}&select=id,name,status,created_at,updated_at,products,shipping,tracking&limit=1`);
  const order = rows[0];
  if (!order || (order.status !== 'paid' && !(order.status === 'tracking_only' && order.tracking?.manualExternal))) return json({ error: 'Código inválido ou não encontrado.' }, 404);
  if (order.tracking?.manualExternal) return json({ code, manual: true, createdAt: order.tracking.shipping.created_at || order.created_at, shipping: order.tracking.shipping, reshipping: publicReshipping(env, order) });
  return json({
    code,
      buyerName: String(order.name || '').trim().slice(0, 100),
    createdAt: order.tracking.shipping.created_at || order.created_at,
    products: publicTrackingProducts(order.products),
    destination: { city: String(order.shipping?.cidade || '').slice(0, 80), state: String(order.shipping?.uf || '').slice(0, 2) },
    shipping: order.tracking.shipping,
    reshipping: publicReshipping(env, order),
  });
}

async function adminUpdateOrderTracking(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'PATCH') return json({ error: 'Método inválido.' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const code = String(body.code || '').trim().toUpperCase();
  const status = String(body.status || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^GK[A-HJ-NP-Z2-9]{10}$/.test(code)) return json({ error: 'Código de rastreio inválido.' }, 400);
  const stages = {
    confirmed: { label: 'Pedido confirmado', detail: 'Pagamento aprovado e pedido confirmado.' },
    preparing: { label: 'Preparando pedido', detail: 'Seu pedido está sendo separado e preparado.' },
    shipped: { label: 'Pedido enviado', detail: 'Seu pedido foi despachado para entrega.' },
    out_for_delivery: { label: 'Saiu para entrega', detail: 'Seu pedido está a caminho do endereço informado.' },
    delivered: { label: 'Pedido entregue', detail: 'A entrega foi concluída.' },
  };
  if (!Object.hasOwn(stages, status)) return json({ error: 'Etapa de entrega inválida.' }, 400);
  const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&status=eq.paid&select=id,tracking&limit=1`);
  const order = rows[0];
  if (!order) return json({ error: 'Pedido pago não encontrado.' }, 404);
  const previous = order.tracking?.shipping || {};
  const previousStageIndex = ['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'].indexOf(previous.status || 'confirmed');
  const requestedStageIndex = ['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'].indexOf(status);
  if (status !== 'confirmed' && requestedStageIndex < previousStageIndex) return json({ error: 'A etapa só pode avançar. Escolha a etapa atual ou uma etapa posterior.' }, 409);
  if (status === 'confirmed' && previous.status && previous.status !== 'confirmed') return json({ error: 'O rastreio já avançou e não pode voltar à confirmação.' }, 409);
  const tracking = {
    ...(order.tracking || {}),
    shipping: {
      ...previous,
      code: previous.code || code,
      created_at: previous.created_at || new Date().toISOString(),
      status,
      events: status === 'confirmed' ? [] : [...(Array.isArray(previous.events) ? previous.events.filter((event) => event.status !== 'confirmed') : []), { status, label: stages[status].label, detail: stages[status].detail, at: new Date().toISOString() }],
    },
  };
  const saved = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, 'PATCH', { tracking, updated_at: new Date().toISOString() });
  if (!saved.length) return json({ error: 'O pedido mudou durante a atualização. Atualize a lista e tente novamente.' }, 409);
  return json({ ok: true, shipping: tracking.shipping });
}

async function adminManualPayment(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&select=id,status,tracking&limit=1`);
  const order = rows[0];
  if (!order) return json({ error: 'Pedido não encontrado.' }, 404);
  if (!['pending', 'expired', 'failed', 'paid'].includes(order.status)) return json({ error: 'Este pedido não pode ser marcado como pago.' }, 409);
  if (order.status !== 'paid') {
    const paidAt = new Date().toISOString();
    const tracking = { ...(order.tracking || {}), manualPayment: { paidAt, source: 'admin', method: 'external' } };
    const saved = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&status=eq.${order.status}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, 'PATCH', { status: 'paid', tracking, updated_at: paidAt });
    if (!saved.length) return json({ error: 'O pedido mudou. Atualize a lista e tente novamente.' }, 409);
  }
  const shipping = await registerOrderTracking(env, id);
  if (!shipping?.code) return json({ error: 'Pagamento salvo. Tente gerar o rastreio novamente.' }, 409);
  await deliverPaidPurchase(env, db, id);
  await deliverPaidEmail(env, db, id).catch((error) => console.error('[email/admin]', error.message));
  return json({ ok: true, shipping });
}

async function adminGenerateTracking(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&status=eq.paid&select=id&limit=1`);
  if (!rows.length) return json({ error: 'Marque o pagamento como recebido antes de gerar o rastreio.' }, 409);
  const shipping = await registerOrderTracking(env, id);
  if (!shipping?.code) return json({ error: 'Não foi possível gerar o rastreio. Tente novamente.' }, 409);
  await deliverPaidEmail(env, db, id).catch((error) => console.error('[email/tracking]', error.message));
  return json({ ok: true, shipping });
}

async function adminCreateExternalTracking(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method === 'GET') {
    const rows = await db(env, 'gokoco_orders', '?gateway=eq.manual_tracking&select=id,created_at,tracking&order=created_at.desc&limit=30');
    return json({ codes: rows.map((row) => ({ id: row.id, code: row.tracking?.shipping?.code, createdAt: row.created_at })).filter((row) => row.code) });
  }
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const now = new Date().toISOString();
  const code = createTrackingCode();
  const order = {
    checkout_id: `external-tracking-${crypto.randomUUID()}`,
    name: 'Rastreio manual', email: '', phone: '', document: '',
    amount: 0.01, products: [], shipping: {},
    tracking: { manualExternal: true, shipping: { code, created_at: now, status: 'confirmed', events: [] } },
    gateway: 'manual_tracking', status: 'tracking_only', created_at: now, updated_at: now,
  };
  const saved = await db(env, 'gokoco_orders', '?select=id', 'POST', order);
  if (!saved.length) return json({ error: 'Não foi possível salvar o rastreio.' }, 500);
  return json({ ok: true, code, id: saved[0].id }, 201);
}

async function adminGateways(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method === 'GET') return json({ gateways: await listGateways(env) });
  if (request.method !== 'PATCH') return json({ error: 'Método inválido.' }, 405);
  const { id, enabled } = await request.json().catch(() => ({}));
  if (!gateways.some((g) => g.id === id) || typeof enabled !== 'boolean') return json({ error: 'Gateway inválido.' }, 400);
  if (enabled && !configured(env, id)) return json({ error: 'Configure a chave deste gateway no Cloudflare antes de ativá-lo.' }, 400);
  if (enabled) await db(env, 'gokoco_gateways', '?enabled=eq.true', 'PATCH', { enabled: false, updated_at: new Date().toISOString() });
  await db(env, 'gokoco_gateways', '?on_conflict=id', 'POST', { id, enabled, updated_at: new Date().toISOString() });
  return json({ gateways: await listGateways(env) });
}

async function adminOrders(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'GET') return json({ error: 'Método inválido.' }, 405);
  const params = new URL(request.url).searchParams;
  const offset = Number(params.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 200 !== 0) return json({ error: 'Página de pedidos inválida.' }, 400);
  const before = params.get('before');
  if (before && !Number.isFinite(Date.parse(before))) return json({ error: 'Data de consulta inválida.' }, 400);
  if (offset === 0) {
    const missingTracking = encodeURIComponent('tracking->shipping->>code');
    const paidOrders = await db(env, 'gokoco_orders', `?status=eq.paid&${missingTracking}=is.null&select=id,tracking,updated_at,created_at&order=created_at.desc&limit=3`);
    await Promise.allSettled(paidOrders.map((order) =>
      registerOrderTracking(env, order.id, order.updated_at || order.created_at),
    ));
    await retryPaidPurchases(env);
  }
  const rows = await db(env, 'gokoco_orders', `?gateway=neq.manual_tracking${before ? `&created_at=lte.${encodeURIComponent(before)}` : ''}&select=id,created_at,name,email,phone,amount,products,gateway,status,transaction_id,shipping,tracking&order=created_at.desc,id.desc&limit=200&offset=${offset}`);
  return json({ orders: rows.map(({ tracking, ...order }) => ({ ...order, siteVariant: tracking?.site_variant === 'mercado_livre' ? 'tl' : 'gokoco', shippingTracking: tracking?.shipping || null, manualPayment: tracking?.manualPayment || null, recovery: tracking?._recovery || null, reshipping: tracking?.reshipping ? { status: tracking.reshipping.status, amount: tracking.reshipping.amount, confirmed_at: tracking.reshipping.confirmed_at || null, hasReceipt: !!tracking.reshipping.receipt?.path } : null, purchase: purchaseSummary(env, { ...order, tracking }) })) });
}

async function adminSendOrderEmail(request, env) {
  const denied = await requireAdmin(request, env); if (denied) return denied;
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !subject || subject.length > 150 || !message || message.length > 5000) return json({ error: 'Confira o pedido, assunto e mensagem.' }, 400);
  const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&gateway=neq.manual_tracking&select=id,name,email,status,tracking&limit=1`);
  if (!rows.length) return json({ error: 'Pedido não encontrado.' }, 404);
  const result = await sendManualOrderEmail(env, rows[0], subject, message);
  if (result.state === 'not_configured') return json({ error: 'Configure o Resend no servidor para enviar e-mails.' }, 503);
  if (result.state === 'invalid_input') return json({ error: 'O e-mail do cliente, assunto ou mensagem é inválido.' }, 400);
  if (result.state !== 'sent') return json({ error: 'O Resend não confirmou o envio. Tente novamente.' }, 502);
  return json({ ok: true, email_id: result.email_id });
}

async function reconcilePendingPayments(env, limit = 2, deferFulfillment = false, newestFirst = false) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const cooldownMs = newestFirst ? 20000 : deferFulfillment ? 60000 : 0;
  const cooldown = cooldownMs ? `&updated_at=lte.${encodeURIComponent(new Date(Date.now() - cooldownMs).toISOString())}` : '';
  const order = newestFirst ? 'created_at.desc' : 'updated_at.asc,created_at.asc';
  const pending = await db(env, 'gokoco_orders', `?select=id,transaction_id,gateway,status,updated_at,tracking&status=in.(pending,expired,failed)&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}${cooldown}&order=${order}&limit=${Math.max(1, Math.min(10, Number(limit) || 2))}`);
  const summary = { checked: 0, paid: 0, expired: 0, failed: 0, rateLimited: false, failures: [] };
  for (const order of pending.filter((item) => item.transaction_id)) {
    let claimedAt;
    try {
      const previousUpdatedAt = Date.parse(order.updated_at || '') || 0;
      claimedAt = new Date(Math.max(Date.now(), previousUpdatedAt + 1)).toISOString();
      const updateFilter = order.updated_at
        ? `updated_at=eq.${encodeURIComponent(order.updated_at)}`
        : 'updated_at=is.null';
      const claimed = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.${order.status}&${updateFilter}&select=id`, 'PATCH', { updated_at: claimedAt });
      if (!claimed.length) continue;
      summary.checked++;

      const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
      const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : 'pending';
      if (status === 'pending') continue;

      const updated = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.${order.status}&updated_at=eq.${encodeURIComponent(claimedAt)}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, 'PATCH', {
        status, updated_at: new Date().toISOString(),
        ...(status === 'paid' ? { tracking: { ...(order.tracking || {}), _payment: { paid_at: verified.paidAt || new Date().toISOString() } } } : {}),
      });
      if (!updated.length) continue;
      if (status === 'paid') {
        summary.paid++;
        if (deferFulfillment) continue;
        const paidAt = verified.paidAt || new Date().toISOString();
        await registerOrderTracking(env, order.id, paidAt);
        await deliverPaidPurchase(env, db, order.id, paidAt);
        await deliverPaidEmail(env, db, order.id, paidAt);
      } else {
        summary.expired++;
      }
    } catch (error) {
      summary.failed++;
      const gateway = String(order.gateway || 'desconhecido').slice(0, 32);
      const reason = String(error?.message || 'Falha de comunicação').slice(0, 100);
      const entry = summary.failures.find((item) => item.gateway === gateway && item.reason === reason);
      if (entry) entry.count++;
      else if (summary.failures.length < 8) summary.failures.push({ gateway, reason, count: 1 });
      console.error('[payment/reconcile]', order.gateway, order.id, error?.message || error);
      if (/HTTP 429\b/.test(reason)) { summary.rateLimited = true; break; }
    }
  }
  return summary;
}

async function reconcilePaymentsRoute(request, env) {
  const cron = Boolean(env.CRON_SECRET && request.headers.get('x-cron-secret') === env.CRON_SECRET);
  if (!cron) { const denied = await requireAdmin(request, env); if (denied) return denied; }
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  // Lote pequeno e sequencial evita o limite de consultas dos gateways.
  // Rastreio, pixel e e-mail seguem nas filas com proteção contra duplicação.
  // No admin, confira primeiro os pedidos recentes; a rotina agendada percorre os mais antigos.
  return json(await reconcilePendingPayments(env, 3, true, !cron));
}

async function fulfillConfirmedPayment(env) {
  const rows = await db(env, 'gokoco_orders', '?status=eq.paid&gateway=neq.manual_tracking&tracking->shipping->>code=is.null&select=id,tracking,updated_at&order=updated_at.desc&limit=1');
  if (!rows.length) return;
  const order = rows[0], paidAt = order.tracking?._payment?.paid_at || order.updated_at;
  await registerOrderTracking(env, order.id, paidAt);
  await deliverPaidPurchase(env, db, order.id, paidAt);
  await deliverPaidEmail(env, db, order.id, paidAt);
}

async function retryPaidPurchases(env, limit = 3) {
  const destination = purchaseDestination(env);
  if (!destination) return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const path = `tracking->_purchase->${destination}->>state`;
  const rows = await db(env, 'gokoco_orders', `?status=eq.paid&gateway=neq.manual_tracking&updated_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.asc&limit=${limit}`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidPurchase(env, db, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === 'fulfilled' && r.value.state === 'sent').length, failed: results.filter((r) => r.status === 'rejected' || r.value?.state === 'failed').length };
}

async function retryPendingPurchases(env) {
  if (purchaseDestination(env) !== 'utmify') return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const path = 'tracking->_purchase->utmify_pending->>state';
  const rows = await db(env, 'gokoco_orders', `?status=eq.pending&transaction_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.desc&limit=1`);
  if (rows[0]) await deliverPendingPurchase(env, db, rows[0].id);
  return { configured: true, processed: rows.length };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      const path = url.pathname;
      if (['/tl/admin', '/tl/admin.html', '/video/admin', '/video/admin.html'].includes(path)) return Response.redirect(new URL('/admin.html', env.SITE_URL || request.url), 302);
      if (path.startsWith('/video/api/')) {
        const response = await bellaRoute(path.slice('/video'.length), request, env, ctx);
        return response || json({ error: 'Rota inválida.' }, 404);
      }
      if (path === '/api/admin/login') return await adminLogin({ request, env });
      if (path === '/api/admin/verify') return json({ valid: (await verifyAdminToken(request, env)).valid });
      if (path === '/api/admin/gateways') return await adminGateways(request, env);
      if (path === '/api/admin/orders') return await adminOrders(request, env);
      if (path === '/api/admin/bella-orders') return await adminBellaOrders(request, env);
      if (path === '/api/admin/bella-gateways') return await adminBellaGateways(request, env);
      if (path === '/api/admin/bella-tracking-email') return await adminBellaTrackingEmail(request, env);
      if (path === '/api/admin/reconcile-payments') return await reconcilePaymentsRoute(request, env);
      if (path === '/api/admin/send-order-email') return await adminSendOrderEmail(request, env);
      if (path === '/api/admin/order-tracking') return await adminUpdateOrderTracking(request, env);
      if (path === '/api/admin/manual-payment') return await adminManualPayment(request, env);
      if (path === '/api/admin/generate-tracking') return await adminGenerateTracking(request, env);
      if (path === '/api/admin/external-tracking') return await adminCreateExternalTracking(request, env);
      if (path === '/api/public/order-tracking' && request.method === 'GET') return await publicOrderTracking(request, env);
      if (path.startsWith('/api/public/reshipping-fee/') || path === '/api/admin/reshipping-receipt') {
        const handled = await handleReshippingRoute(path, request, env, {
          db, json, listGateways, requireAdmin, queryPixGatewayStatus,
          providers: { ironpay: createPixIronpay, masterfy: createPixMasterfy, umbrellapag: createPixUmbrellapag, venuspay_pix: createPixVenuspay },
        });
        if (handled) return handled;
      }
      if (path === '/api/process-purchase-queue' && request.method === 'POST') {
        const secret = String(env.CRON_SECRET || '');
        if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Não autorizado.' }, 401);
        const phase = url.searchParams.get('phase');
        if (phase === 'recovery') return json({ recovery: await processRecoveryQueue(env, db, queryPixGatewayStatus) });
        const payments = phase === 'fulfillment' ? null : await reconcilePendingPayments(env, 2, true);
        await fulfillConfirmedPayment(env);
        const purchases = await retryPaidPurchases(env, 1);
        const pendingPurchases = await retryPendingPurchases(env);
        const emails = await retryPaidEmails(env, db);
        const recovery = phase === 'fulfillment' ? null : await processRecoveryQueue(env, db, queryPixGatewayStatus, 1);
        return json({ payments, purchases, pendingPurchases, emails, recovery });
      }
      if (path === '/api/market/pix/create' && request.method === 'POST') return await createMarketPix(request, env, ctx);
      if (path === '/api/public/pix/create' && request.method === 'POST') return await createPix(request, env, ctx);
      if (path === '/api/public/pix/status' && request.method === 'GET') return await statusPix(request, env);
      if (path === '/api/pix/webhook' && request.method === 'POST') return await webhook(request, env);
      if (path.startsWith('/api/')) return json({ error: 'Rota não encontrada.' }, 404);
      return siteAsset(request, env);
    } catch (error) {
      console.error('[gokoco]', error?.message || error);
      return json({ message: error?.message || 'Erro interno do servidor.' }, 500);
    }
  },
};
