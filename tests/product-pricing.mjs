import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { priceDefaults, priceFor, discountedPrice, publicPrice, validatePrice, renderPrices, loadPrices } from '../worker-src/product-pricing.js';
import { forjaCart } from '../worker-src/forja-catalog.js';
import { validateCartItems } from '../sites/bella/functions/_lib/catalog.js';
import worker from '../_worker.js';

const kit = 'forja:soarfly-kit-ferramentas-4-em-1-48vf';
const changed = (id = kit) => ({ ...priceFor(null, id), originalPrice: 200, salePrice: 100, pixDiscountPercent: 10, recoveryDiscountPercent: 25, version: 'version-test' });
const prices = id => priceDefaults.map(p => p.id === id ? changed(id) : p);

test('calcula desconto principal, Pix e recuperação, e rejeita preços inválidos', () => {
  assert.equal(publicPrice(changed()).discountPercent, 50);
  assert.equal(publicPrice(changed()).pixPrice, 90);
  for (const invalid of [{ salePrice: 201 }, { salePrice: 0 }, { pixDiscountPercent: 100 }, { recoveryDiscountPercent: -1 }, { salePrice: 1.234 }, { salePrice: '100' }]) assert.throws(() => validatePrice({ ...changed(), ...invalid }));
  assert.equal(validatePrice(changed()).salePrice, 100);
  const cart = { sku: kit.slice(6), qty: 2, shipping: 'Frete Grátis', colors: [], bumps: [], discount: 0.75, bonus: 0 };
  assert.equal(forjaCart(cart, changed()).amount, 135);
  assert.equal(forjaCart({ ...cart, discount: 0.5 }, changed()), null);
});

test('o mesmo preço da escova vale para todas as cores Bella, com preço de cartão separado do Pix', () => {
  const current = prices('escova');
  for (const id of ['bella-escova-branca', 'bella-escova-preta', 'bella-escova-rose']) {
    assert.equal(validateCartItems([{ id, quantity: 2 }], 'pix', current).amount, 180);
    assert.equal(validateCartItems([{ id, quantity: 2 }], 'card', current).amount, 200);
  }
});

test('páginas, checkout e scripts recebem os novos valores sem alterar SVG, estilos ou recomendações de outro produto', () => {
  const current = prices(kit);
  for (const [name, route, unit] of [['index', '/forja/', '100.00'], ['pagamento', '/forja/pagamento', '90.00']]) {
    const html = fs.readFileSync(new URL(`../dist/forja/${name}.txt`, import.meta.url), 'utf8');
    const result = renderPrices(html, route, current);
    assert.match(result, /window\.__PRODUCT_PRICING=/);
    assert.match(result, new RegExp(unit.replace('.', '\\.')));
    if (name === 'pagamento') {
      assert.match(result, /var UNIT = 90\.00/);
      assert.match(result, /\?\s*0\.75\s*:\s*1/);
    }
    const art = source => [...source.matchAll(/<(svg|style)\b[^>]*>[\s\S]*?<\/\1>/gi)].map(m => m[0]);
    assert.deepEqual(art(result), art(html));
    for (const match of result.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/application\/(ld\+)?json|type=["']module/.test(match[1])) continue;
      new vm.Script(match[2]);
    }
  }
  const other = '<a class="product" href="/forja/produtos/k-lavadora-portatil-de-alta-pressao-com-2-baterias-recarregave-3.html"><span>R$ 37,90</span></a>';
  const page = `<html><head></head><body>R$ 67,90 ${other}</body></html>`;
  assert.ok(renderPrices(page, '/forja/', current).includes(other));
});

test('leitura sem migração preserva os preços atuais, e falha de conexão não usa preço antigo silenciosamente', async () => {
  const original = globalThis.fetch;
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
  try {
    globalThis.fetch = async () => Response.json({ code: 'PGRST205' }, { status: 404 });
    assert.equal((await loadPrices(env)).ready, false);
    globalThis.fetch = async () => Response.json({ error: 'offline' }, { status: 503 });
    await assert.rejects(() => loadPrices(env));
  } finally { globalThis.fetch = original; }
});

test('somente admin salva, a alteração persiste e uma edição concorrente é rejeitada', async () => {
  const original = globalThis.fetch, rows = [];
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'secret', ADMIN_SESSION_SECRET: 'test-admin' };
  const payload = btoa(JSON.stringify({ exp: Date.now() + 60000 }));
  const token = payload + '.' + createHmac('sha256', env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
  const call = (method, body, authenticated = true) => worker.fetch(new Request('https://loja.example/api/admin/product-prices', { method, headers: authenticated ? { Authorization: 'Bearer ' + token } : {}, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw); assert.ok(url.pathname.endsWith('/gokoco_product_prices'));
    if (options.method === 'POST') { rows.push(JSON.parse(options.body)); return Response.json(rows); }
    if (options.method === 'PATCH') {
      if (url.searchParams.get('version') !== 'eq.' + rows[0].version) return Response.json([]);
      Object.assign(rows[0], JSON.parse(options.body)); return Response.json(rows);
    }
    return Response.json(rows);
  };
  try {
    assert.equal((await call('PATCH', changed(), false)).status, 401);
    const update = { ...changed(), version: null };
    assert.equal((await call('PATCH', update)).status, 200);
    const read = await (await call('GET')).json();
    const saved = read.products.find(p => p.id === kit);
    assert.equal(saved.salePrice, 100); assert.equal(saved.pixPrice, 90); assert.ok(saved.version);
    assert.equal((await call('PATCH', update)).status, 409);
    const publicData = await (await worker.fetch(new Request('https://loja.example/api/public/product-prices'), env)).json();
    assert.equal(JSON.stringify(publicData).includes('secret'), false);
  } finally { globalThis.fetch = original; }
});

test('produtos sem desconto inicial ganham preço de venda e original distintos sem alterar dimensões', () => {
  const id = 'forja:k-soarfly-800ml-1200ml-pistola-de-pintura-48v-com-2-baterias-p';
  const html = '<html><head></head><body><h1>Produto</h1><div class="price">R$ 339,99</div><div class="old">R$ 339,99</div><img width="130" src="/images/130.webp"><script>var UNIT = 339.99;</script></body></html>';
  const result = renderPrices(html, '/forja/produtos/' + id.slice(6), prices(id));
  assert.match(result, /class="price">R\$ 100,00/);
  assert.match(result, /class="old">R\$ 200,00/);
  assert.match(result, /var UNIT = 100.00/);
  assert.match(result, /width="130" src="\/images\/130.webp"/);
});

test('formulário do admin calcula o desconto e envia todos os campos com a versão atual', async () => {
  const source = fs.readFileSync(new URL('../js/admin-pricing.js', import.meta.url), 'utf8');
  const elements = new Map(), requests = [];
  const node = id => { if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; }, showModal() { this.open = true; }, close() { this.open = false; } }); return elements.get(id); };
  const fields = Object.fromEntries(['originalPrice', 'salePrice', 'pixDiscountPercent', 'recoveryDiscountPercent'].map(name => [name, node(name)]));
  node('pricing-form').elements = fields;
  node('product-select').value = 'forja';
  const env = vm.createContext({ token: 'admin-token', document: { getElementById: node, createElement: () => ({}) }, fetch: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer admin-token');
    if (options.method === 'GET') return { ok: true, json: async () => ({ ready: true, products: [changed()] }) };
    const body = JSON.parse(options.body); requests.push(body);
    return { ok: true, json: async () => ({ product: { ...body, version: 'new-version' } }) };
  } });
  vm.runInContext(source, env);
  await node('pricing-open').events.click();
  assert.equal(node('pricing-dialog').open, true);
  fields.originalPrice.value = '100'; fields.salePrice.value = '70';
  node('pricing-form').events.input();
  assert.match(node('pricing-preview').textContent, /30% de desconto/);
  await node('pricing-form').events.submit({ preventDefault() {} });
  assert.equal(requests[0].salePrice, 70); assert.equal(requests[0].originalPrice, 100);
  assert.equal(requests[0].version, 'version-test'); assert.equal(requests[0].pixDiscountPercent, 10);
  assert.match(node('pricing-message').textContent, /Preço salvo/);
});

test('checkout legado e servidor concordam em Pix, cartão, recuperação e complementos', () => {
  const current = priceDefaults.map(p => p.id === 'escova' ? changed('escova') : p.id === 'necessaire' ? { ...changed('necessaire'), salePrice: 20, recoveryDiscountPercent: 50 } : p);
  const source = fs.readFileSync(new URL('../worker-src/index.js', import.meta.url), 'utf8');
  const calculate = vm.runInNewContext(source.slice(source.indexOf('function cartTotal('), source.indexOf('async function db(')) + ';cartTotal', { priceFor, discountedPrice, PRODUCTS: { escova: 37.9 }, COLORS: { Preta: 37.9 }, SHIPPING: { 'Frete Grátis': 0 }, BUMPS: { necessaire: 19.47 } });
  const cart = { qty: 1, colors: [], shipping: 'Frete Grátis', bumps: ['necessaire'], discount: 0.75, bonus: 0 };
  assert.equal(calculate(cart, current, 'pix'), 76.5);
  assert.equal(calculate(cart, current, 'card'), 85);
  const html = renderPrices(fs.readFileSync(new URL('../pagamento.html', import.meta.url), 'utf8'), '/pagamento', current);
  const computeSource = html.slice(html.indexOf('  function compute(){'), html.indexOf("  var lastKey = '';", html.indexOf('  function compute(){')));
  const window = { __paymentMethod: 'pix', productPricing: {
    unit: (id, method) => { const p = priceFor(current, id || 'escova'); return method === 'card' ? p.salePrice : publicPrice(p).pixPrice; },
    recoveryFactor: (id, fallback) => fallback !== 1 ? 1 - priceFor(current, id).recoveryDiscountPercent / 100 : 1,
  } };
  const compute = vm.runInNewContext(computeSource + ';compute', { window, BASE_UNIT: 90, ORIGINAL_PRICE: 200, disc: () => 0.75, bonus: () => 0, readQty: () => 1, readShipping: () => ({ name: 'Frete Grátis', price: 0 }), readBumps: () => [{ id: 'necessaire', price: window.__paymentMethod === 'card' ? 20 : 18 }] });
  assert.equal(compute().total, 76.5);
  window.__paymentMethod = 'card';
  assert.equal(compute().total, 85);
});
