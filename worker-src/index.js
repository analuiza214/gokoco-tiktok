import { onRequest as adminLogin } from './admin-login.js';
import { verifyAdminToken } from './admin-auth.js';
import { createPixIronpay } from './providers/ironpay.js';
import { createPixMasterfy } from './providers/masterfy.js';
import { createPixUmbrellapag } from './providers/umbrellapag.js';
import { createPixVenuspay } from './providers/venuspay.js';
import { queryPixGatewayStatus } from './pix-gateway-status.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const gateways = [
  { id: 'ironpay', name: 'IronPay' },
  { id: 'masterfy', name: 'MasterFy' },
  { id: 'umbrellapag', name: 'UmbrellaPag' },
  { id: 'venuspay_pix', name: 'Venus Pay PIX' },
];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const digits = (value) => String(value || '').replace(/\D/g, '');
const BUMPS = { taiff: 39.84, wella: 45.70, siage: 32.63, escovas: 23.58, necessaire: 19.47 };
const COLORS = { Preta: 69.90, Branca: 69.90, Rosa: 69.90, 'Azul céu': 69.90, Verde: 69.90, Lilás: 69.90, Dourada: 69.90 };
const SHIPPING = { 'Frete Grátis': 0, JADLOG: 18.47, 'SEDEX 12': 33.40 };
function normalizeBuyerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email.slice(0, at).replace(/\.+$/, '')}@${email.slice(at + 1)}` : email;
}
function cartTotal(cart) {
  if (!cart || !Number.isInteger(cart.qty) || cart.qty < 1 || cart.qty > 10) return null;
  let base = 69.90 * cart.qty;
  if (Array.isArray(cart.colors) && cart.colors.length) {
    if (cart.colors.length > 7 || cart.colors.some((c) => !Object.hasOwn(COLORS, c.label) || !Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 10)) return null;
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

async function createPix(request, env) {
  const body = await request.json().catch(() => null);
  if (body?.client) body.client.email = normalizeBuyerEmail(body.client.email);
  const invalid = validateBuyer(body);
  if (invalid) return json({ message: invalid, code: 'invalid_document' }, 400);
  const checkoutId = String(body.checkoutId || '');
  if (!/^[a-f0-9-]{20,50}$/i.test(checkoutId)) return json({ message: 'Identificador de checkout inválido.' }, 400);
  const previous = await db(env, 'gokoco_orders', `?checkout_id=eq.${encodeURIComponent(checkoutId)}&select=*&limit=1`);
  if (previous[0]?.pix_code) {
    const old = previous[0];
    return json({ copyPaste: old.pix_code, qrCode: old.qr_code, transactionId: old.transaction_id, gatewayTransactionId: old.transaction_id, orderId: old.id });
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
  const shipping = body.shipping || {};
  const order = {
    checkout_id: checkoutId,
    name: String(body.client.name).trim().slice(0, 150),
    email: normalizeBuyerEmail(body.client.email),
    phone: digits(body.client.phone),
    document: digits(body.client.document),
    amount: Number(body.amount),
    products: Array.isArray(body.products) ? body.products.slice(0, 10) : [],
    shipping,
    tracking: body.tracking && typeof body.tracking === 'object' ? body.tracking : {},
    gateway: active[0].id,
    client_ip_hash: ipHash,
    status: 'creating',
  };
  const saved = previous[0]
    ? await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(previous[0].id)}&status=eq.failed&select=id`, 'PATCH', { ...order, updated_at: new Date().toISOString() })
    : await db(env, 'gokoco_orders', '?select=id', 'POST', order);
  const id = saved?.[0]?.id;
  if (!id) return json({ message: 'A cobrança já está em processamento. Aguarde um momento.' }, 409);
  const payload = {
    amount: order.amount, name: order.name, email: order.email, phone: order.phone,
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
  if (env.PIX_RATELIMIT) {
    const count = Number(await env.PIX_RATELIMIT.get(ipKey) || 0);
    await env.PIX_RATELIMIT.put(ipKey, String(count + 1), { expirationTtl: 3600 });
  }
  return json({ copyPaste: payment.pixCode, qrCode: qr, transactionId: payment.transactionId, gatewayTransactionId: payment.transactionId, orderId: id });
}

async function statusPix(request, env) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || id.length > 150) return json({ error: 'Transação inválida.' }, 400);
  const ids = id.split(',').slice(0, 2);
  let order = null;
  for (const candidate of ids) {
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(candidate)}&select=id,transaction_id,gateway,status&limit=1`);
    if (rows[0]) { order = rows[0]; break; }
  }
  if (!order) return json({ status: 'unknown' }, 404);
  if (order.status === 'paid') return json({ status: 'paid', isPaid: true });
  const result = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
  const status = result.isPaid ? 'paid' : result.isRefunded ? 'refunded' : result.isExpired ? 'expired' : 'pending';
  if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  return json({ status, isPaid: result.isPaid, isExpired: result.isExpired });
}

async function webhook(request, env) {
  const notification = await request.json().catch(() => null);
  if (!notification) return json({ received: true });
  const ids = [notification.objectId, notification.data?.transaction_id, notification.data?.id, notification.transaction_hash, notification.transactionId, notification.transaction_id, notification.id].filter(Boolean);
  for (const id of ids) {
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(String(id))}&select=id,transaction_id,gateway,status&limit=1`);
    const order = rows[0];
    if (!order) continue;
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : order.status;
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    break;
  }
  return json({ received: true });
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
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const pending = await db(env, 'gokoco_orders', `?select=id,transaction_id,gateway,status&status=eq.pending&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=50`);
  await Promise.allSettled(pending.filter((order) => order.transaction_id).map(async (order) => {
    const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
    const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : 'pending';
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  }));
  const rows = await db(env, 'gokoco_orders', '?select=id,created_at,name,email,phone,amount,products,gateway,status,transaction_id,shipping&order=created_at.desc&limit=200');
  return json({ orders: rows });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const path = url.pathname;
      if (path === '/api/admin/login') return await adminLogin({ request, env });
      if (path === '/api/admin/verify') return json({ valid: (await verifyAdminToken(request, env)).valid });
      if (path === '/api/admin/gateways') return await adminGateways(request, env);
      if (path === '/api/admin/orders') return await adminOrders(request, env);
      if (path === '/api/public/pix/create' && request.method === 'POST') return await createPix(request, env);
      if (path === '/api/public/pix/status' && request.method === 'GET') return await statusPix(request, env);
      if (path === '/api/pix/webhook' && request.method === 'POST') return await webhook(request, env);
      if (path.startsWith('/api/')) return json({ error: 'Rota não encontrada.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('[gokoco]', error?.message || error);
      return json({ message: error?.message || 'Erro interno do servidor.' }, 500);
    }
  },
};
