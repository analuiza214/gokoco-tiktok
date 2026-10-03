// Adaptado do envio de pedidos pagos da loja Top Mix.
// O estado de envio usa o JSON tracking existente; não exige migração do banco.
const ATTRIBUTION_KEYS = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
const text = (value, limit = 500) => typeof value === 'string' ? value.slice(0, limit) : '';
const utc = (value) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

export function capturePurchaseTracking(request, body) {
  const tracking = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, text(body.tracking?.[key]) || null]));
  const fb = body.fb || {};
  const fbp = text(fb.fbp, 200);
  const fbc = text(fb.fbc, 300);
  const origin = new URL(request.url).origin;
  let sourceUrl = `${origin}/pagamento`;
  try { const url = new URL(body.tracking?.event_source_url); if (url.origin === origin) sourceUrl = url.href.slice(0, 2000); } catch {}
  tracking._browser = {
    fbp: /^fb\.\d+\.\d+\./.test(fbp) ? fbp : null,
    fbc: /^fb\.\d+\.\d+\./.test(fbc) ? fbc : (tracking.fbclid ? `fb.1.${Date.now()}.${tracking.fbclid}` : null),
    ip: request.headers.get('CF-Connecting-IP') || null,
    user_agent: request.headers.get('User-Agent') || null,
    source_url: sourceUrl,
  };
  return tracking;
}

export function purchaseDestination(env) {
  const mode = String(env.PURCHASE_DELIVERY_MODE || 'auto').trim().toLowerCase();
  if (mode === 'utmify') return 'utmify';
  if (mode === 'meta') return 'meta';
  if (mode !== 'auto') return null;
  if (String(env.UTMIFY_API_TOKEN || '').trim()) return 'utmify';
  if (String(env.FB_ACCESS_TOKEN || '').trim()) return 'meta';
  return null;
}

export function purchaseSummary(env, order) {
  const destination = purchaseDestination(env);
  const state = destination ? order.tracking?._purchase?.[destination] : null;
  return {
    destination,
    state: destination ? state?.state || 'pending' : 'not_configured',
    sent_at: state?.sent_at || null,
    error: state?.error || null,
    event_id: `pix_${order.id}`,
  };
}

function products(order) {
  const rows = (Array.isArray(order.products) ? order.products : []).map((p, i) => ({
    id: `gokoco_${i}`, name: text(p.name, 255) || 'Escova Modeladora GOKOCO',
    planId: null, planName: null,
    quantity: Math.max(1, Math.round(Number(p.quantity) || 1)),
    priceInCents: Math.max(0, Math.round(Number(p.price) * 100) || 0),
  }));
  if (rows.length && rows.reduce((sum, p) => sum + p.priceInCents * p.quantity, 0) === Math.round(Number(order.amount) * 100)) return rows;
  return [{ id: 'gokoco_escova', name: 'Escova Modeladora GOKOCO', planId: null, planName: null, quantity: 1, priceInCents: Math.round(Number(order.amount) * 100) }];
}

async function sendUtmify(env, order, paidAt) {
  const token = String(env.UTMIFY_API_TOKEN || '').trim();
  if (!token) throw new Error('UTMIFY_API_TOKEN não configurado.');
  const cents = Math.round(Number(order.amount) * 100);
  const payload = {
    orderId: String(order.transaction_id || order.id), platform: 'BellaMix', paymentMethod: 'pix', status: 'paid',
    createdAt: utc(order.created_at), approvedDate: utc(paidAt), refundedAt: null,
    customer: { name: order.name, email: order.email, phone: order.phone || null, document: order.document || null, country: 'BR', ...(order.tracking?._browser?.ip ? { ip: order.tracking._browser.ip } : {}) },
    products: products(order),
    trackingParameters: Object.fromEntries(ATTRIBUTION_KEYS.slice(0, 7).map((key) => [key, order.tracking?.[key] || null])),
    commission: { totalPriceInCents: cents, gatewayFeeInCents: 0, userCommissionInCents: cents, currency: 'BRL' },
    isTest: false,
  };
  const response = await fetch('https://api.utmify.com.br/api-credentials/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-token': token },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`UTMify respondeu HTTP ${response.status}. Confira a credencial e os dados do pedido.`);
  return { http_status: response.status };
}

async function hash(value) {
  if (!value) return undefined;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendMeta(env, order, paidAt) {
  const token = String(env.FB_ACCESS_TOKEN || '').trim();
  const pixel = String(env.FB_PIXEL_ID || '1542362403143695').trim();
  if (!token) throw new Error('FB_ACCESS_TOKEN não configurado.');
  if (!/^\d+$/.test(pixel)) throw new Error('FB_PIXEL_ID inválido.');
  const version = String(env.FB_API_VERSION || 'v25.0').trim();
  if (!/^v\d+\.0$/.test(version)) throw new Error('FB_API_VERSION inválida.');
  const phone = String(order.phone || '').replace(/\D/g, '');
  const names = String(order.name || '').trim().split(/\s+/);
  const browser = order.tracking?._browser || {};
  const payload = {
    data: [{
      event_name: 'Purchase', event_id: `pix_${order.id}`, event_time: Math.floor(new Date(paidAt).getTime() / 1000),
      action_source: 'website', event_source_url: browser.source_url || `${String(env.SITE_URL || '').replace(/\/+$/, '')}/pagamento`,
      user_data: {
        em: [await hash(order.email)], ph: phone ? [await hash(phone.length <= 11 ? `55${phone}` : phone)] : undefined,
        fn: names[0] ? [await hash(names[0])] : undefined,
        ln: names.length > 1 ? [await hash(names.slice(1).join(' '))] : undefined,
        external_id: [await hash(order.id)], country: [await hash('br')],
        fbc: browser.fbc || undefined, fbp: browser.fbp || undefined,
        client_ip_address: browser.ip || undefined, client_user_agent: browser.user_agent || undefined,
      },
      custom_data: { value: Number(order.amount), currency: 'BRL', order_id: order.id, content_type: 'product', content_name: products(order).map((p) => p.name).join(' + '), num_items: products(order).reduce((sum, p) => sum + p.quantity, 0) },
    }],
    ...(env.FB_TEST_EVENT_CODE ? { test_event_code: env.FB_TEST_EVENT_CODE } : {}),
  };
  const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error || Number(result.events_received) < 1 || result.events_received === undefined) throw new Error(`Meta não confirmou o evento (HTTP ${response.status}${result.error?.code ? `, código ${result.error.code}` : ''}). Confira o token e o pixel.`);
  return { http_status: response.status, events_received: result.events_received };
}

// Compare-and-swap no JSON impede dois webhooks/admin/status de enviar ao mesmo tempo.
async function swapTracking(db, env, order, tracking) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db(env, 'gokoco_orders', query, 'PATCH', { tracking });
  return rows?.[0] || null;
}

export async function deliverPaidPurchase(env, db, orderId, paidAt) {
  const destination = purchaseDestination(env);
  if (!destination) return { state: 'not_configured' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`);
    const order = rows?.[0];
    if (!order) return { state: 'not_paid' };
    const metadata = order.tracking?._purchase || {};
    const prior = metadata[destination] || {};
    if (prior.state === 'sent') return purchaseSummary(env, order);
    if (prior.state === 'sending' && Date.parse(prior.lease_until) > Date.now()) return { state: 'sending' };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: 'retry_pending' };
    const date = metadata.paid_at || paidAt || order.updated_at || order.created_at;
    if (!Number.isFinite(Date.parse(date))) throw new Error('Data de pagamento inválida.');
    const claim = crypto.randomUUID();
    const tracking = { ...order.tracking, _purchase: { ...metadata, paid_at: date, [destination]: { state: 'sending', claim, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 120000).toISOString() } } };
    const claimed = await swapTracking(db, env, order, tracking);
    if (!claimed) continue;
    let result;
    try {
      const receipt = destination === 'utmify' ? await sendUtmify(env, claimed, date) : await sendMeta(env, claimed, date);
      result = { state: 'sent', claim, attempts: tracking._purchase[destination].attempts, sent_at: new Date().toISOString(), ...receipt };
    } catch (error) {
      // Não registrar respostas do fornecedor: podem conter dados pessoais ou tokens.
      result = { state: 'failed', claim, attempts: tracking._purchase[destination].attempts, retry_at: new Date(Date.now() + 60000).toISOString(), error: error.name === 'TimeoutError' ? 'Tempo limite ao enviar a compra. Uma nova tentativa será feita.' : text(error.message, 250) };
      console.error('[purchase]', destination, order.id, result.error);
    }
    const completed = await swapTracking(db, env, claimed, { ...tracking, _purchase: { ...tracking._purchase, [destination]: result } });
    if (!completed) throw new Error('Não foi possível registrar o resultado do envio.');
    return purchaseSummary(env, completed);
  }
  return { state: 'busy' };
}
