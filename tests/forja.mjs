import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../_worker.js';

const kit = 'soarfly-kit-ferramentas-4-em-1-48vf';
const input = () => ({
  checkoutId: crypto.randomUUID(), amount: 67.90,
  cart: { sku: kit, qty: 1, colors: [], shipping: 'Frete Grátis', bumps: [], discount: 1, bonus: 0 },
  client: { name: 'Maria Silva', email: 'maria@example.com', phone: '85999999999', document: '52998224725' },
  shipping: { cep: '60000000', logradouro: 'Rua Teste', numero: '10', bairro: 'Centro', cidade: 'Fortaleza', uf: 'CE' },
  products: [{ name: 'Nome adulterado pelo navegador', quantity: 999 }],
});
const create = (body, route = '/forja/api/public/pix/create') => new Request('https://loja.example' + route, { method: 'POST', body: JSON.stringify(body) });

test('Forja herda gateway global, preserva preço e isola checkout entre produtos e lojas', async () => {
  const original = globalThis.fetch;
  let active = 'flevopay';
  let priceRows = [];
  const orders = [], payments = [];
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test', FLEVOPAY_API_KEY: 'test', MASTERFY_API_KEY: 'test', SITE_URL: 'https://loja.example' };
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw);
    if (url.hostname === 'db.example') {
      if (url.pathname.endsWith('/gokoco_product_prices')) return Response.json(priceRows);
      if (url.pathname.endsWith('/gokoco_gateways')) return Response.json([{ id: active, enabled: true }]);
      assert.equal(url.pathname, '/rest/v1/gokoco_orders');
      if (options.method === 'POST') {
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...JSON.parse(options.body) };
        orders.push(row); return Response.json([row]);
      }
      let rows = orders.filter(row => ['id', 'checkout_id', 'transaction_id', 'status'].every(key => !url.searchParams.has(key) || url.searchParams.get(key) === 'eq.' + row[key]));
      if (url.searchParams.has('email') || url.searchParams.has('client_ip_hash') || url.searchParams.has('amount')) rows = [];
      if (options.method === 'PATCH') rows.forEach(row => Object.assign(row, JSON.parse(options.body)));
      return Response.json(rows);
    }
    if (url.hostname === 'app.flevopag.com' && url.pathname.endsWith('/query')) return Response.json({ status: 'paid', paid_at: new Date().toISOString() });
    const payload = JSON.parse(options.body);
    payments.push({ host: url.hostname, payload });
    if (url.hostname === 'app.flevopag.com') return Response.json({ transaction_id: 'flevo-' + payments.length, qr_code: 'pix-forja' });
    if (url.hostname === 'api.masterfypagamentos.com') return Response.json({ id: 'master-' + payments.length, data: { copypaste: 'pix-master' } });
    throw Error('Chamada inesperada: ' + url);
  };
  try {
    const first = input();
    let response = await worker.fetch(create(first), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).amount, 67.90);
    assert.equal(orders[0].tracking.store_id, 'forja');
    assert.equal(orders[0].tracking.product_id, kit);
    assert.equal(orders[0].products[0].quantity, 1);
    assert.match(orders[0].products[0].name, /Kit Ferramentas 4 em 1/);
    assert.equal(payments[0].payload.amount, 6790);
    assert.equal(payments[0].payload.postback_url, 'https://loja.example/api/pix/webhook');
    response = await worker.fetch(create(first), env);
    assert.equal(response.status, 200); assert.equal(payments.length, 1);

    active = 'masterfy';
    response = await worker.fetch(create(input()), env);
    assert.equal(response.status, 200); assert.equal(orders[1].gateway, 'masterfy');
    assert.equal(orders[0].gateway, 'flevopay');
    assert.equal(payments[1].payload.notificationUrl, 'https://loja.example/api/pix/webhook');

    const tampered = input(); tampered.amount = 1;
    assert.equal((await worker.fetch(create(tampered), env)).status, 400);
    tampered.amount = 67.90; tampered.cart.sku = 'escova';
    assert.equal((await worker.fetch(create(tampered), env)).status, 400);
    const other = input(); other.checkoutId = first.checkoutId; other.amount = 339.99; other.cart.sku = 'k-soarfly-800ml-1200ml-pistola-de-pintura-48v-com-2-baterias-p';
    assert.equal((await worker.fetch(create(other), env)).status, 409);
    const brush = input(); brush.checkoutId = first.checkoutId; brush.amount = 37.90; delete brush.cart.sku;
    assert.equal((await worker.fetch(create(brush, '/api/public/pix/create'), env)).status, 409);
    assert.equal(payments.length, 2);
    const webhook = new Request('https://loja.example/api/pix/webhook', { method: 'POST', body: JSON.stringify({ transaction_id: orders[0].transaction_id }) });
    assert.equal((await worker.fetch(webhook, env)).status, 200);
    assert.equal(orders[0].status, 'paid');
    assert.equal(orders[0].gateway, 'flevopay');
    assert.equal(orders[0].tracking.store_id, 'forja');
    assert.match(orders[0].tracking.shipping.code, /^GK/);
    priceRows = [{ id: 'forja:' + kit, original_price: 200, sale_price: 100, pix_discount_percent: 10, recovery_discount_percent: 25, version: crypto.randomUUID() }];
    const reuse = await worker.fetch(create(first), env);
    assert.equal((await reuse.json()).amount, 67.9);
    const stale = await worker.fetch(create(input()), env);
    assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'price_changed');
    const next = input(); next.amount = 90;
    const repriced = await worker.fetch(create(next), env);
    assert.equal(repriced.status, 200); assert.equal((await repriced.json()).amount, 90);
    assert.equal(orders.at(-1).tracking.pricing.salePrice, 100);
    const recovery = input(); recovery.cart.discount = 0.75; recovery.amount = 67.5;
    const recovered = await worker.fetch(create(recovery), env);
    assert.equal(recovered.status, 200); assert.equal((await recovered.json()).amount, 67.5);

  } finally { globalThis.fetch = original; }
});

test('Forja publica páginas próprias e mantém admin e configurações protegidos', async () => {
  const env = { SITE_URL: 'https://loja.example', ASSETS: { fetch: request => new Response(new URL(request.url).pathname) } };
  for (const [route, asset] of [['/forja/', '/forja/index.txt'], ['/forja/pagamento', '/forja/pagamento.txt'], ['/forja/loja.html', '/forja/loja.txt'], ['/forja/rastreio', '/forja/rastreio.txt'], ['/forja/uploads/images/test.png', '/forja/uploads/images/test.png']]) {
    const response = await worker.fetch(new Request('https://loja.example' + route), env);
    assert.equal(await response.text(), asset);
  }
  const redirect = await worker.fetch(new Request('https://loja.example/forja/admin'), env);
  assert.equal(redirect.headers.get('location'), 'https://loja.example/admin.html');
  assert.equal((await worker.fetch(new Request('https://loja.example/api/admin/products'), env)).status, 401);
  assert.equal((await worker.fetch(new Request('https://loja.example/forja/api/admin/products'), env)).status, 404);
});

test('páginas Forja compilam scripts e não compartilham armazenamento do carrinho', () => {
  for (const name of ['index', 'pagamento', 'loja', 'rastreio']) {
    const html = fs.readFileSync(new URL(`../dist/forja/${name}.txt`, import.meta.url), 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/application\/ld\+json|type=["']module/.test(match[1])) continue;
      new vm.Script(match[2], { filename: name });
    }
    for (const match of html.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(["']([^"']+)/g)) assert.ok(match[1].startsWith('forja_'), match[1]);
    assert.doesNotMatch(html, /(?:src|href)=["']\/(?:uploads|assets|css|images|js|videos)\//);
  }
  const checkout = fs.readFileSync(new URL('../dist/forja/pagamento.txt', import.meta.url), 'utf8');
  assert.match(checkout, /fetch\('\/forja\/api\/public\/pix\/create'/);
  assert.doesNotMatch(checkout, /["']\/upsell1["']/);
});

test('seletor do painel filtra produto, status e taxas sem misturar lojas', () => {
  const source = fs.readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
  const functions = source.slice(source.indexOf('function matchingOrders('), source.indexOf('function renderStats('));
  const orders = [
    { id: 'kit', siteVariant: 'forja', productId: kit, status: 'paid', created_at: new Date().toISOString() },
    { id: 'other', siteVariant: 'forja', productId: 'other', status: 'pending', created_at: new Date().toISOString() },
    { id: 'brush', siteVariant: 'gokoco', status: 'paid', created_at: new Date().toISOString() },
    { id: 'video', siteVariant: 'video', status: 'paid', created_at: new Date().toISOString() },
  ];
  const context = vm.createContext({ orders, selectedProduct: 'forja', selectedSite: 'todas', selectedPeriod: 'todos', selectedStatus: 'todos', selectedFee: 'todas', selectedSort: 'recentes', $: () => ({ value: '' }) });
  vm.runInContext(functions, context);
  assert.equal(vm.runInContext('matchingOrders().length', context), 2);
  context.selectedStatus = 'paid';
  assert.equal(vm.runInContext('filteredOrders()[0].id', context), 'kit');
  context.selectedStatus = 'todos'; context.selectedProduct = 'forja:' + kit;
  assert.equal(vm.runInContext('matchingOrders()[0].id', context), 'kit');
  assert.equal(vm.runInContext('matchingOrders().length', context), 1);
  context.selectedProduct = 'gokoco';
  assert.equal(vm.runInContext('matchingOrders().length', context), 2);
});
