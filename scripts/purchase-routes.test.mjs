import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
const code = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const copy = (v) => JSON.parse(JSON.stringify(v));
function setup() {
  const state = { order: { id: '11111111-2222-4333-8444-555555555555', transaction_id: 'tx-id', gateway: 'ironpay', status: 'pending', name: 'Maria Silva', email: 'cliente@example.com', phone: '85999999999', document: '52998224725', amount: 37.90, products: [{ name: 'Escova Modeladora GOKOCO - Preta x1 + Rosa x1 · Bivolt', quantity: 1 }], shipping: { cidade: 'Campina Grande', uf: 'PB', cep: '58400000' }, tracking: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, gatewayPaid: true, sent: [] };
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test', IRONPAY_API_TOKEN: 'test', UTMIFY_API_TOKEN: 'test', ADMIN_SESSION_SECRET: 'test-admin' };
  const fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'api.ironpayapp.com.br') return Response.json({ payment_status: state.gatewayPaid ? 'PAID' : 'PENDING', paid_at: new Date().toISOString() });
    if (url.hostname === 'api.utmify.com.br') { state.sent.push(JSON.parse(options.body)); return Response.json({ ok: true }); }
    assert.equal(url.hostname, 'db.example');
    const params = url.searchParams;
    if (params.has('transaction_id') && params.get('transaction_id') !== 'eq.' + state.order.transaction_id) return Response.json([]);
    if (params.has('status') && params.get('status') !== 'eq.' + state.order.status) return Response.json([]);
    if (params.has('status') && params.get('status') === 'eq.paid' && state.order.status !== 'paid') return Response.json([]);
    if (params.has('tracking->shipping->>code')) {
      const filter = params.get('tracking->shipping->>code');
      if (filter === 'is.null' ? !!state.order.tracking?.shipping?.code : filter.slice(3) !== state.order.tracking?.shipping?.code) return Response.json([]);
      const selected = String(params.get('select') || '').split(',');
      return Response.json([Object.fromEntries(selected.map((field) => [field, state.order[field]]))]);
    }
    if (url.pathname.endsWith('/api/public/order-tracking') && url.searchParams.has('code') && options.method !== 'PATCH') {
      const code = url.searchParams.get('code');
      if (state.order.status !== 'paid' || state.order.tracking?.shipping?.code !== code) return Response.json([]);
    }
    if (params.has('id') && params.get('id') !== 'eq.' + state.order.id) return Response.json([]);
    if (params.has('or') && state.order.tracking._purchase?.utmify?.state === 'sent') return Response.json([]);
    if (options.method === 'PATCH') {
      if (params.has('tracking') && JSON.stringify(JSON.parse(params.get('tracking').slice(3))) !== JSON.stringify(state.order.tracking)) return Response.json([]);
      Object.assign(state.order, JSON.parse(options.body));
      if (params.has('select') && state.order.tracking.shipping?.code) return Response.json([copy(state.order)]);
    }
    return Response.json([copy(state.order)]);
  };
  const call = (path, options) => worker.fetch(new Request('https://store.example' + path, options), env);
  return { state, env, fetch, call };
}
async function using(f, fn) { const original = globalThis.fetch; globalThis.fetch = f.fetch; try { await fn(); } finally { globalThis.fetch = original; } }

test('consulta de status confirma no gateway e envia sem depender do cliente', async () => {
  const f = setup();
  await using(f, async () => {
    const data = await (await f.call('/api/public/pix/status?id=tx-id')).json();
    assert.equal(data.status, 'paid'); assert.equal(data.amount, 37.9); assert.equal(data.eventId, 'pix_' + f.state.order.id);
    assert.equal(data.purchaseDestination, 'utmify'); assert.equal(f.state.sent.length, 1);
    assert.equal(data.email, undefined); assert.equal(data.tracking, undefined);
    assert.match(f.state.order.tracking.shipping.code, /^GK[A-HJ-NP-Z2-9]{10}$/);
    assert.equal(data.trackingCode, f.state.order.tracking.shipping.code);
    assert.equal(f.state.order.tracking.shipping.status, 'confirmed');
    const trackingCode = f.state.order.tracking.shipping.code;
    await f.call('/api/public/pix/status?id=tx-id');
    assert.equal(f.state.order.tracking.shipping.code, trackingCode);
    await f.call('/api/public/pix/status?id=tx-id'); assert.equal(f.state.sent.length, 1);
  });
});

test('rastreio público usa código secreto, oculta endereço e avança etapa pelo admin', async () => {
  const f = setup(); f.state.order.status = 'paid';
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })).toString('base64');
  const token = payload + '.' + createHmac('sha256', f.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  await using(f, async () => {
    f.state.order.tracking.shipping = { code: 'GKABCDEFGHJK', created_at: f.state.order.created_at, status: 'confirmed', events: [] };
    const publicResponse = await f.call('/api/public/order-tracking?code=GKABCDEFGHJK');
    assert.equal(publicResponse.status, 200);
    const publicData = await publicResponse.json();
    assert.equal(publicData.buyerName, 'Maria Silva');
    assert.equal(publicData.products.length, 2);
    assert.equal(publicData.products[0].image, '/images/f2/cores/preta.webp');
    assert.equal(publicData.products[1].image, '/images/f2/cores/rosa.webp');
    assert.equal(publicData.products[0].quantity, 1);
    assert.equal(publicData.destination.city, 'Campina Grande');
    assert.equal(publicData.destination.cep, undefined);
    assert.equal(publicData.email, undefined);

    const updated = await f.call('/api/admin/order-tracking', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ id: f.state.order.id, code: 'GKABCDEFGHJK', status: 'shipped' }) });
    assert.equal(updated.status, 200);
    assert.equal(f.state.order.tracking.shipping.status, 'shipped');
    assert.equal(f.state.order.tracking.shipping.events.at(-1).label, 'Pedido enviado');

    const invalidCode = await f.call('/api/public/order-tracking?code=GKAAAAAAAAAA');
    assert.equal(invalidCode.status, 404);
  });
});

test('rastreio mostra a quantidade comprada da mesma cor com sua imagem', async () => {
  const f = setup(); f.state.order.status = 'paid';
  f.state.order.products = [{ name: 'Escova Modeladora GOKOCO - Preta x2 · Bivolt', quantity: 1 }];
  f.state.order.tracking.shipping = { code: 'GKABCDEFGHJK', created_at: f.state.order.created_at, status: 'confirmed', events: [] };
  await using(f, async () => {
    const response = await f.call('/api/public/order-tracking?code=GKABCDEFGHJK');
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.products.length, 1);
    assert.equal(data.products[0].quantity, 2);
    assert.equal(data.products[0].image, '/images/f2/cores/preta.webp');
  });
});

test('admin cria e exibe automaticamente código para pedidos já pagos sem rastreio', async () => {
  const f = setup(); f.state.order.status = 'paid';
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })).toString('base64');
  const token = payload + '.' + createHmac('sha256', f.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  await using(f, async () => {
    const response = await f.call('/api/admin/orders', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.match(data.orders[0].shippingTracking.code, /^GK[A-HJ-NP-Z2-9]{10}$/);
    assert.equal(data.orders[0].tracking, undefined);
    assert.equal(f.state.order.tracking.shipping.status, 'confirmed');
  });
});

test('webhook público alegando pagamento não prevalece sobre o gateway', async () => {
  const f = setup(); f.state.gatewayPaid = false;
  await using(f, async () => {
    await f.call('/api/pix/webhook', { method: 'POST', body: JSON.stringify({ transactionId: 'tx-id', status: 'paid' }) });
    assert.equal(f.state.order.status, 'pending'); assert.equal(f.state.sent.length, 0);
  });
});

test('webhook confirmado envia compra uma vez mesmo quando repetido', async () => {
  const f = setup();
  await using(f, async () => {
    for (let i = 0; i < 3; i++) assert.equal((await f.call('/api/pix/webhook', { method: 'POST', body: JSON.stringify({ transactionId: 'tx-id' }) })).status, 200);
    assert.equal(f.state.order.status, 'paid'); assert.equal(f.state.sent.length, 1);
  });
});

test('admin recupera pedido pago ainda não enviado e informa resultado', async () => {
  const f = setup(); f.state.order.status = 'paid';
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })).toString('base64');
  const token = payload + '.' + createHmac('sha256', f.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  await using(f, async () => {
    assert.equal((await f.call('/api/admin/orders')).status, 401);
    const response = await f.call('/api/admin/orders', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.orders[0].purchase.state, 'sent');
    assert.equal(data.orders[0].tracking, undefined); assert.equal(f.state.sent.length, 1);
  });
});

test('fila exige segredo e modo sem credencial não quebra confirmação paga', async () => {
  const f = setup(); delete f.env.UTMIFY_API_TOKEN;
  await using(f, async () => {
    assert.equal((await f.call('/api/process-purchase-queue', { method: 'POST' })).status, 401);
    const data = await (await f.call('/api/public/pix/status?id=tx-id')).json();
    assert.equal(data.status, 'paid'); assert.equal(data.purchaseDestination, null); assert.equal(f.state.sent.length, 0);
  });
});

test('InitiateCheckout permanece apenas após dados preenchidos e transição à entrega', () => {
  const html = fs.readFileSync(new URL('../pagamento.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((s) => new vm.Script(s));
  const script = scripts.find((s) => s.includes('function trackDeliveryEntry'));
  let handler; const events = [], fields = {};
  for (const placeholder of ['Nome e Sobrenome', 'email@email.com', '123.456.789-12', '(99) 99999-9999']) fields['input[placeholder="' + placeholder + '"]'] = { value: '' };
  const elements = { 'lv-step-1': { style: {} }, 'lv-step-2': { style: { display: 'none' } }, 'lv-step-3': { style: { display: 'none' } }, 'lv-pix-total': { innerText: 'R$ 37,90' } };
  const button = { innerText: 'IR PARA A ENTREGA', dataset: {}, addEventListener: (_, fn) => { handler = fn; } };
  const context = { document: { querySelectorAll: () => [button], querySelector: (s) => fields[s], getElementById: (id) => elements[id], body: {} }, window: { scrollTo() {} }, localStorage: { getItem: () => null, setItem() {} }, MutationObserver: function () { this.observe = () => {}; }, fbq: (...args) => events.push(args), alert() {} };
  vm.runInNewContext(script, context); assert.equal(events.length, 0);
  handler({ preventDefault() {} }); assert.equal(events.length, 0);
  Object.values(fields).forEach((field, i) => { field.value = ['Cliente', 'cliente@example.com', '52998224725', '85999999999'][i]; });
  handler({ preventDefault() {} }); handler({ preventDefault() {} }); assert.equal(events.length, 1);
  assert.equal(elements['lv-step-2'].style.display, ''); assert.equal(events[0][1], 'InitiateCheckout');
  assert.equal((html.match(/fbq\('track','InitiateCheckout'/g) || []).length, 1);
  assert.ok(!fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes('InitiateCheckout'));
  const paidPage = fs.readFileSync(new URL('../pagamento.html', import.meta.url), 'utf8');
  assert.ok(paidPage.includes('j.trackingCode'));
  assert.ok(paidPage.includes('Acompanhar meu pedido'));
  const trackingPage = fs.readFileSync(new URL('../rastreio.html', import.meta.url), 'utf8');
  assert.ok(trackingPage.includes('tracking-stage'));
  assert.ok(trackingPage.includes('data.buyerName'));
  assert.ok(trackingPage.includes('tracking-order-heading'));
  assert.ok(trackingPage.includes('@media(max-width:360px)'));
  assert.ok(trackingPage.includes('tracking-stage'));
  assert.ok(trackingPage.includes('product-image'));
  [...trackingPage.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].forEach((match) => new vm.Script(match[1]));
});

test('rastreio avança a simulação no minuto previsto sem chamá-la de confirmação real', async () => {
  const html = fs.readFileSync(new URL('../rastreio.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1])[0];
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, innerHTML: '', value: '', handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; }, querySelector() { return { disabled: false }; } });
    return elements.get(id);
  };
  let fixedNow = Date.parse('2026-10-06T12:45:00Z');
  let refreshTimeline;
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } }
  vm.runInNewContext(script, {
    document: { getElementById: element },
    location: { search: '?codigo=GKABCDEFGHJK' },
    history: { replaceState() {} },
    fetch: async () => new Response(JSON.stringify({ code: 'GKABCDEFGHJK', buyerName: 'Ana Paula & Silva', createdAt: '2026-10-06T12:00:00Z', products: [{ name: 'Escova GOKOCO', quantity: 1, image: '/images/escova.png' }], destination: { city: 'Presidente Prudente', state: 'SP' }, shipping: { status: 'confirmed', created_at: '2026-10-06T12:00:00Z', events: [] } })),
    URLSearchParams, Intl, Date: FixedDate, Response,
    setInterval: (handler) => { refreshTimeline = handler; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  const timeline = element('timeline').innerHTML;
  assert.ok(element('order').innerHTML.includes('PEDIDO'));
  assert.ok(element('order').innerHTML.includes('GKABCDEFGHJK'));
  assert.ok(element('order').innerHTML.includes('Ana Paula &amp; Silva'));
  assert.match(timeline, /<strong>Em embalagem<\/strong><span class="stage-badge">Previsão<\/span>/);
  assert.match(timeline, /<strong>Em embalagem<\/strong>/);
  assert.ok(timeline.includes('09:47'));
  fixedNow = Date.parse('2026-10-06T12:48:00Z');
  refreshTimeline();
  assert.match(element('timeline').innerHTML, /<strong>Em embalagem<\/strong><span class="stage-badge">Previsão<\/span>/);
  assert.match(element('timeline').innerHTML, /tracking-stage[^"<]*forecast simulated/);
});

test('rastreio avulso mostra só o código e etapas previstas, sem destinatário inventado', async () => {
  const html = fs.readFileSync(new URL('../rastreio.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1])[0];
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, innerHTML: '', value: '', addEventListener() {}, querySelector() { return { disabled: false }; } });
    return elements.get(id);
  };
  vm.runInNewContext(script, {
    document: { getElementById: element }, location: { search: '?codigo=GKABCDEFGHJK' },
    fetch: async () => Response.json({ code: 'GKABCDEFGHJK', manual: true, createdAt: '2026-10-06T12:00:00Z', shipping: { status: 'confirmed', created_at: '2026-10-06T12:00:00Z', events: [] } }),
    URLSearchParams, Intl, Date, Response, setInterval() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(element('order').innerHTML, /CÓDIGO DE RASTREIO/);
  assert.doesNotMatch(element('order').innerHTML, /Cliente|Escova|Destino/);
  assert.match(element('timeline').innerHTML, /Código gerado/);
  assert.match(element('timeline').innerHTML, /Previsão/);
  assert.doesNotMatch(element('timeline').innerHTML, /Guarulhos|Pagamento aprovado|endereço informado/);
});


test('bônus antigo de R$ 5 não reduz mais o preço da escova', () => {
  const source = fs.readFileSync(new URL('../worker-src/index.js', import.meta.url), 'utf8');
  const calculate = vm.runInNewContext(source.slice(source.indexOf('function cartTotal('), source.indexOf('async function db(')) + ';cartTotal', { COLORS: { Preta: 37.90 }, SHIPPING: { 'Frete Grátis': 0 }, BUMPS: {} });
  const cart = { qty: 1, colors: [{ label: 'Preta', quantity: 1 }], shipping: 'Frete Grátis', bumps: [], discount: 1, bonus: 0 };
  assert.equal(calculate(cart), 37.90);
  assert.equal(calculate({ ...cart, bonus: 5 }), 32.90);
  const html = fs.readFileSync(new URL('../pagamento.html', import.meta.url), 'utf8');
  const stored = new Map([['lv_bonus5', 'active']]);
  const bonus = vm.runInNewContext(html.slice(html.indexOf('  function bonus(){'), html.indexOf('  function compute(){')) + ';bonus', { sessionStorage: { removeItem: key => stored.delete(key), getItem: key => stored.get(key) } });
  assert.equal(bonus(), 0);
  assert.equal(stored.has('lv_bonus5'), false);
  stored.set('lv_exit_bonus5', 'active');
  assert.equal(bonus(), 5);
});


test('bônus aparece somente na saída e recusar permite voltar', () => {
  const source = fs.readFileSync(new URL('../js/exit-bonus.js', import.meta.url), 'utf8');
  function fixture() {
    const events = {}, values = new Map(), nodes = {};
    let buys = 0, backs = 0, pushes = 0;
    for (const id of ['lv-bonus-overlay', 'lv-bonus-claim', 'lv-bonus-decline']) nodes[id] = { style: {}, classList: { add() {}, remove() {}, contains() { return true; } }, focus() {}, addEventListener(type, handler) { events[id + type] = handler; } };
    vm.runInNewContext(source, { document: { getElementById: id => nodes[id], querySelector: selector => selector === '.lv-bonus-count' ? {} : { click() { buys++; } }, body: { style: {} }, addEventListener(type, handler) { events[type] = handler; } }, window: { matchMedia: () => ({ matches: true }), addEventListener(type, handler) { events[type] = handler; } }, history: { state: null, pushState() { pushes++; }, back() { backs++; } }, location: { href: 'https://example.com/' }, sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }, setInterval() { return 1; }, clearInterval() {} });
    return { events, values, nodes, totals: () => ({ buys, backs, pushes }) };
  }
  const desktop = fixture();
  assert.notEqual(desktop.nodes['lv-bonus-overlay'].style.display, 'flex');
  desktop.events.mouseout({ relatedTarget: null, clientY: 0 });
  assert.equal(desktop.nodes['lv-bonus-overlay'].style.display, 'flex');
  desktop.events['lv-bonus-claimclick']();
  assert.equal(desktop.values.get('lv_exit_bonus5'), 'active');
  assert.equal(desktop.totals().buys, 1);
  const mobile = fixture();
  mobile.events.pointerdown();
  assert.equal(mobile.totals().pushes, 1);
  mobile.events.popstate();
  assert.equal(mobile.nodes['lv-bonus-overlay'].style.display, 'flex');
  mobile.events['lv-bonus-declineclick']();
  assert.equal(mobile.totals().backs, 1);
  assert.equal(mobile.values.get('lv_exit_bonus5'), undefined);
});


test('somente admin pode confirmar pagamento externo e gerar rastreio sem duplicar compras', async () => {
  const f = setup(); f.state.gatewayPaid = false;
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })).toString('base64');
  const token = payload + '.' + createHmac('sha256', f.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  const options = { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.state.order.id }) };
  await using(f, async () => {
    assert.equal((await f.call('/api/admin/manual-payment', { ...options, headers: {} })).status, 401);
    assert.equal(f.state.order.status, 'pending');
    assert.equal((await f.call('/api/admin/generate-tracking', options)).status, 409);
    const response = await f.call('/api/admin/manual-payment', options);
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.equal(f.state.order.status, 'paid');
    assert.equal(f.state.order.tracking.manualPayment.method, 'external');
    assert.match(first.shipping.code, /^GK[A-HJ-NP-Z2-9]{10}$/);
    await f.call('/api/admin/manual-payment', options);
    const regenerated = await (await f.call('/api/admin/generate-tracking', options)).json();
    assert.equal(regenerated.shipping.code, first.shipping.code);
    assert.equal(f.state.sent.length, 1);
    await f.call('/api/pix/webhook', { method: 'POST', body: JSON.stringify({ transaction_id: 'tx-id' }) });
    assert.equal(f.state.order.status, 'paid');
  });
});

test('admin gera rastreio para venda fora do site sem enviar compra ao gateway', async () => {
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test', ADMIN_SESSION_SECRET: 'test-admin', UTMIFY_API_TOKEN: 'test' };
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60000 })).toString('base64');
  const token = payload + '.' + createHmac('sha256', env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  const body = '{}';
  let saved;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    assert.equal(new URL(input).hostname, 'db.example');
    if (options.method === 'POST') {
      saved = { id: '11111111-2222-4333-8444-555555555555', ...JSON.parse(options.body) };
      return Response.json([{ id: saved.id }]);
    }
    return Response.json(saved ? [saved] : []);
  };
  try {
    const call = (headers = {}) => worker.fetch(new Request('https://store.example/api/admin/external-tracking', { method: 'POST', headers, body }), env);
    assert.equal((await call()).status, 401);
    const response = await call({ Authorization: 'Bearer ' + token });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.match(data.code, /^GK[A-HJ-NP-Z2-9]{10}$/);
    assert.equal(saved.tracking.manualExternal, true);
    assert.equal(saved.tracking.shipping.code, data.code);
    assert.equal(saved.gateway, 'manual_tracking');
    assert.equal(saved.status, 'tracking_only');
    assert.equal(saved.name, 'Rastreio manual');
    assert.deepEqual(saved.products, []);
    assert.deepEqual(saved.shipping, {});
    const publicResponse = await worker.fetch(new Request('https://store.example/api/public/order-tracking?code=' + data.code), env);
    assert.equal(publicResponse.status, 200);
    const publicData = await publicResponse.json();
    assert.equal(publicData.manual, true);
    assert.equal(publicData.buyerName, undefined);
    assert.equal(publicData.destination, undefined);
    assert.equal(publicData.products, undefined);
  } finally { globalThis.fetch = original; }
});
