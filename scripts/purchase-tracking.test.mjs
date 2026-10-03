import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../worker-src/purchase-tracking.js', import.meta.url), 'utf8');
const { capturePurchaseTracking, deliverPaidPurchase, purchaseDestination } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const copy = (value) => JSON.parse(JSON.stringify(value));
function fixture() {
  let order = { id: 'order-123', transaction_id: 'tx-123', status: 'paid', created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:30:00Z', name: 'Cliente Teste', email: 'teste@example.com', phone: '85999999999', document: '52998224725', amount: 75.80, products: [{ name: 'Escova', quantity: 2, price: 37.90 }], tracking: { utm_source: 'FB', utm_campaign: 'Campanha A', _browser: { source_url: 'https://example.com/pagamento', fbp: 'fb.1.123.456', ip: '192.0.2.1', user_agent: 'Test Browser' } } };
  const db = async (_env, _table, query, method, body) => {
    const params = new URLSearchParams(query.slice(1));
    if (params.get('status') === 'eq.paid' && order.status !== 'paid') return [];
    if (method !== 'PATCH') return [copy(order)];
    const expected = JSON.parse(params.get('tracking').slice(3));
    if (JSON.stringify(expected) !== JSON.stringify(order.tracking)) return [];
    order = { ...order, ...copy(body) };
    return [copy(order)];
  };
  return { db, get order() { return order; }, set order(value) { order = value; } };
}

test('seleciona uma única rota de compra e nunca aceita estado de envio do cliente', () => {
  assert.equal(purchaseDestination({ UTMIFY_API_TOKEN: 'u', FB_ACCESS_TOKEN: 'f' }), 'utmify');
  assert.equal(purchaseDestination({ FB_ACCESS_TOKEN: 'f' }), 'meta');
  assert.equal(purchaseDestination({}), null);
  const tracking = capturePurchaseTracking(new Request('https://example.com/api/public/pix/create'), { tracking: { utm_source: 'FB', _purchase: { utmify: { state: 'sent' } }, event_source_url: 'https://evil.example/' } });
  assert.equal(tracking._purchase, undefined);
  assert.equal(tracking.utm_source, 'FB');
  assert.equal(tracking._browser.source_url, 'https://example.com/pagamento');
});

test('pagamento pendente não gera compra', async () => {
  const f = fixture(); f.order.status = 'pending';
  assert.equal((await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)).state, 'not_paid');
});

test('webhook/admin/status simultâneos enviam um pedido com centavos e UTMs corretos', async () => {
  const f = fixture(), sent = []; const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => { sent.push({ url, payload: JSON.parse(options.body) }); return new Response('{}', { status: 200 }); };
  try {
    await Promise.all(Array.from({ length: 5 }, () => deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)));
    assert.equal(sent.length, 1);
    const p = sent[0].payload;
    assert.equal(p.orderId, 'tx-123'); assert.equal(p.status, 'paid');
    assert.equal(p.approvedDate, '2026-10-02 12:30:00');
    assert.equal(p.commission.totalPriceInCents, 7580);
    assert.equal(p.products[0].quantity, 2); assert.equal(p.products[0].priceInCents, 3790);
    assert.equal(p.trackingParameters.utm_campaign, 'Campanha A');
    assert.equal(f.order.tracking._purchase.utmify.state, 'sent');
    await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id);
    assert.equal(sent.length, 1);
  } finally { globalThis.fetch = original; }
});

test('falha não marca enviado e uma nova tentativa preserva identificação e data', async () => {
  const f = fixture(), sent = []; const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return new Response('{}', { status: sent.length === 1 ? 503 : 200 }); };
  try {
    assert.equal((await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)).state, 'failed');
    assert.equal((await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)).state, 'retry_pending');
    assert.equal(sent.length, 1);
    f.order.tracking._purchase.utmify.retry_at = '2000-01-01T00:00:00Z';
    assert.equal((await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)).state, 'sent');
    assert.equal(sent[0].orderId, sent[1].orderId);
    assert.equal(sent[0].approvedDate, sent[1].approvedDate);
  } finally { globalThis.fetch = original; }
});

test('processo interrompido pode recuperar reserva de envio vencida', async () => {
  const f = fixture(), original = globalThis.fetch; let calls = 0;
  f.order.tracking._purchase = { paid_at: f.order.updated_at, utmify: { state: 'sending', lease_until: '2000-01-01T00:00:00Z' } };
  globalThis.fetch = async () => { calls++; return new Response('{}'); };
  try { assert.equal((await deliverPaidPurchase({ UTMIFY_API_TOKEN: 'test' }, f.db, f.order.id)).state, 'sent'); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test('Meta recebe hashes, valor do banco e eventID compartilhado com o navegador', async () => {
  const f = fixture(), original = globalThis.fetch; let payload;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://graph.facebook.com/v25.0/1542362403143695/events');
    payload = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    return new Response(JSON.stringify({ events_received: 1 }));
  };
  try {
    assert.equal((await deliverPaidPurchase({ FB_ACCESS_TOKEN: 'private-token' }, f.db, f.order.id)).state, 'sent');
    const e = payload.data[0]; assert.equal(e.event_id, 'pix_order-123'); assert.equal(e.custom_data.value, 75.8);
    assert.match(e.user_data.em[0], /^[a-f0-9]{64}$/); assert.equal(e.event_time, Date.parse(f.order.updated_at) / 1000);
  } finally { globalThis.fetch = original; }
});

test('Meta rejeitado não produz falso sucesso', async () => {
  const f = fixture(), original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 });
  try { assert.equal((await deliverPaidPurchase({ FB_ACCESS_TOKEN: 'test' }, f.db, f.order.id)).state, 'failed'); }
  finally { globalThis.fetch = original; }
});

test('UTMs persistem da página de produto até o checkout e os cookies são capturados', () => {
  const script = fs.readFileSync(new URL('../js/purchase-attribution.js', import.meta.url), 'utf8');
  const storage = new Map(); const localStorage = { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) };
  const run = (search) => {
    const c = { window: {}, location: { search, href: `https://example.com/pagamento${search}` }, document: { cookie: '_fbp=fb.1.123.456' }, localStorage, URLSearchParams };
    vm.runInNewContext(script, c); return c.window;
  };
  run('?utm_source=FB&utm_campaign=Oferta&fbclid=click');
  const checkout = run(''); assert.equal(checkout.getUTMs().utm_campaign, 'Oferta');
  assert.equal(checkout.getFbData().fbp, 'fb.1.123.456'); assert.match(checkout.getFbData().fbc, /click$/);
  assert.equal(run('?utm_source=Google').getUTMs().utm_campaign, undefined);
});
