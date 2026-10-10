import { onRequest as adminLogin } from './admin-login.js';
import { verifyAdminToken } from './admin-auth.js';
import { createPixIronpay } from './providers/ironpay.js';
import { createPixMasterfy } from './providers/masterfy.js';
import { createPixUmbrellapag } from './providers/umbrellapag.js';
import { createPixVenuspay } from './providers/venuspay.js';
import { queryPixGatewayStatus } from './pix-gateway-status.js';
import { capturePurchaseTracking, purchaseDestination, purchaseSummary, deliverPaidPurchase } from './purchase-tracking.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const gateways = [
  { id: 'ironpay', name: 'IronPay' },
  { id: 'masterfy', name: 'MasterFy' },
  { id: 'umbrellapag', name: 'UmbrellaPag' },
  { id: 'venuspay_pix', name: 'Venus Pay PIX' },
];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const digits = (value) => String(value || '').replace(/\D/g, '');
const BUMPS = {};
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

async function createPix(request, env) {
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
  const shipping = body.shipping;
  const order = {
    checkout_id: checkoutId,
    name: String(body.client.name).trim().slice(0, 150),
    email: normalizeBuyerEmail(body.client.email),
    phone: digits(body.client.phone),
    document: digits(body.client.document),
    amount: Number(body.amount),
    products: Array.isArray(body.products) ? body.products.slice(0, 10) : [],
    shipping,
    tracking: capturePurchaseTracking(request, body),
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
    const rows = await db(env, 'gokoco_orders', `?transaction_id=eq.${encodeURIComponent(candidate)}&select=*&limit=1`);
    if (rows[0]) { order = rows[0]; break; }
  }
  if (!order) return json({ status: 'unknown' }, 404);
  if (order.status === 'paid') {
    const shippingTracking = await registerOrderTracking(env, order.id, order.updated_at || order.created_at).catch((error) => { console.error('[tracking/status]', error.message); return null; });
    await deliverPaidPurchase(env, db, order.id).catch((error) => console.error('[purchase/status]', error.message));
    return json({ status: 'paid', isPaid: true, amount: Number(order.amount), trackingCode: shippingTracking?.code || null, eventId: `pix_${order.id}`, purchaseDestination: purchaseDestination(env) });
  }
  const result = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
  const status = result.isPaid ? 'paid' : result.isRefunded ? 'refunded' : result.isExpired ? 'expired' : 'pending';
  if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  let shippingTracking = null;
  if (status === 'paid') {
    shippingTracking = await registerOrderTracking(env, order.id, result.paidAt || new Date().toISOString()).catch((error) => { console.error('[tracking/status]', error.message); return null; });
    await deliverPaidPurchase(env, db, order.id, result.paidAt || new Date().toISOString()).catch((error) => console.error('[purchase/status]', error.message));
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
  const tracking = { ...(order.tracking || {}), shipping: { code, created_at: paidAt || new Date().toISOString(), status: 'confirmed', events: [] } };
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
    const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : order.status;
    if (status !== order.status) await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (status === 'paid') {
      await registerOrderTracking(env, order.id, verified.paidAt || (order.status === 'paid' ? undefined : new Date().toISOString()));
      const delivery = await deliverPaidPurchase(env, db, order.id, verified.paidAt || (order.status === 'paid' ? undefined : new Date().toISOString()));
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
  if (order.tracking?.manualExternal) return json({ code, manual: true, createdAt: order.tracking.shipping.created_at || order.created_at, shipping: order.tracking.shipping });
  return json({
    code,
      buyerName: String(order.name || '').trim().slice(0, 100),
    createdAt: order.tracking.shipping.created_at || order.created_at,
    products: publicTrackingProducts(order.products),
    destination: { city: String(order.shipping?.cidade || '').slice(0, 80), state: String(order.shipping?.uf || '').slice(0, 2) },
    shipping: order.tracking.shipping,
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
  await reconcilePendingPayments(env, 2);
  const missingTracking = encodeURIComponent('tracking->shipping->>code');
  const paidOrders = await db(env, 'gokoco_orders', `?status=eq.paid&${missingTracking}=is.null&select=id,tracking,updated_at,created_at&order=created_at.desc&limit=3`);
  await Promise.allSettled(paidOrders.map((order) =>
    registerOrderTracking(env, order.id, order.updated_at || order.created_at),
  ));
  await retryPaidPurchases(env);
  const rows = await db(env, 'gokoco_orders', '?gateway=neq.manual_tracking&select=id,created_at,name,email,phone,amount,products,gateway,status,transaction_id,shipping,tracking&order=created_at.desc&limit=200');
  return json({ orders: rows.map(({ tracking, ...order }) => ({ ...order, shippingTracking: tracking?.shipping || null, manualPayment: tracking?.manualPayment || null, purchase: purchaseSummary(env, { ...order, tracking }) })) });
}

async function reconcilePendingPayments(env, limit = 2) {
  const pending = await db(env, 'gokoco_orders', `?select=id,transaction_id,gateway,status,updated_at&status=eq.pending&order=updated_at.asc,created_at.asc&limit=${Math.max(1, Math.min(10, Number(limit) || 2))}`);
  const summary = { checked: 0, paid: 0, expired: 0, failed: 0 };
  await Promise.all(pending.filter((order) => order.transaction_id).map(async (order) => {
    let claimedAt;
    try {
      const previousUpdatedAt = Date.parse(order.updated_at || '') || 0;
      claimedAt = new Date(Math.max(Date.now(), previousUpdatedAt + 1)).toISOString();
      const updateFilter = order.updated_at
        ? `updated_at=eq.${encodeURIComponent(order.updated_at)}`
        : 'updated_at=is.null';
      const claimed = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&${updateFilter}&select=id`, 'PATCH', { updated_at: claimedAt });
      if (!claimed.length) return;
      summary.checked++;

      const verified = await queryPixGatewayStatus(env, order.transaction_id, order.gateway);
      const status = verified.isPaid ? 'paid' : verified.isRefunded ? 'refunded' : verified.isExpired ? 'expired' : 'pending';
      if (status === 'pending') return;

      const updated = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&updated_at=eq.${encodeURIComponent(claimedAt)}&select=id`, 'PATCH', {
        status, updated_at: new Date().toISOString(),
      });
      if (!updated.length) return;
      if (status === 'paid') {
        summary.paid++;
        const paidAt = verified.paidAt || new Date().toISOString();
        await registerOrderTracking(env, order.id, paidAt);
        await deliverPaidPurchase(env, db, order.id, paidAt);
      } else {
        summary.expired++;
      }
    } catch (error) {
      summary.failed++;
      console.error('[payment/reconcile]', order.gateway, order.id, error?.message || error);
    }
  }));
  return summary;
}

async function retryPaidPurchases(env) {
  const destination = purchaseDestination(env);
  if (!destination) return { configured: false, processed: 0 };
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const path = `tracking->_purchase->${destination}->>state`;
  const rows = await db(env, 'gokoco_orders', `?status=eq.paid&gateway=neq.manual_tracking&updated_at=gte.${encodeURIComponent(since)}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.asc&limit=3`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidPurchase(env, db, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === 'fulfilled' && r.value.state === 'sent').length, failed: results.filter((r) => r.status === 'rejected' || r.value?.state === 'failed').length };
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
      if (path === '/api/admin/order-tracking') return await adminUpdateOrderTracking(request, env);
      if (path === '/api/admin/manual-payment') return await adminManualPayment(request, env);
      if (path === '/api/admin/generate-tracking') return await adminGenerateTracking(request, env);
      if (path === '/api/admin/external-tracking') return await adminCreateExternalTracking(request, env);
      if (path === '/api/public/order-tracking' && request.method === 'GET') return await publicOrderTracking(request, env);
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
