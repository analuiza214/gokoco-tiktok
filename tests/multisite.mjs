import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';
import { safeCardSummary } from '../sites/bella/functions/_lib/card-summary.js';

assert.equal(safeCardSummary('Visa ••••1234'), 'Visa ••••1234');
assert.equal(safeCardSummary('4111111111111234'), null);
assert.equal(safeCardSummary('encrypted-card-data'), null);

const env = {
  SITE_URL: 'https://gokoco.example',
  ASSETS: { fetch: (request) => new Response(new URL(request.url).pathname) },
};
const path = async (url) => (await worker.fetch(new Request(url), env)).text();

assert.equal(await path('https://gokoco.example/loja.html'), '/loja.html');
assert.equal(await path('https://gokoco.example/tl'), '/tl/__entry.txt');
assert.equal(await path('https://gokoco.example/tl/cep'), '/tl/__entry.txt');
assert.equal(await path('https://gokoco.example/tl/assets/store.js'), '/tl/assets/store.js');
assert.equal(await path('https://gokoco.example/video/checkout'), '/video/__entry.txt');
assert.equal(await path('https://gokoco.example/video/checkout/'), '/video/__entry.txt');
assert.equal(await path('https://gokoco.example/video/images/logo.png'), '/video/images/logo.png');
assert.equal(await path('https://gokoco.example/assets/store.js'), '/assets/store.js');

const tlHtml = readFileSync(new URL('../dist/tl/index.html', import.meta.url), 'utf8');
const videoHtml = readFileSync(new URL('../dist/video/index.html', import.meta.url), 'utf8');
assert.match(tlHtml, /src="\/tl\/assets\//);
assert.doesNotMatch(tlHtml, /\/video\/assets\//);
assert.match(videoHtml, /src="\/video\/assets\//);
assert.doesNotMatch(videoHtml, /\/tl\/assets\//);

const redirect = await worker.fetch(new Request('https://gokoco.example/video/admin'), env);
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), 'https://gokoco.example/admin.html');
const marketRedirect = await worker.fetch(new Request('https://gokoco.example/tl/admin.html'), env);
assert.equal(marketRedirect.headers.get('location'), 'https://gokoco.example/admin.html');

const privateOrders = await worker.fetch(new Request('https://gokoco.example/api/admin/bella-orders'), env);
assert.equal(privateOrders.status, 401);

const bellaHealth = await worker.fetch(new Request('https://gokoco.example/video/api/checkout-health'), {
  ...env,
  SUPABASE_URL: 'https://gokoco.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'gokoco-only',
  VENUS_PAY_SECRET_KEY: 'gokoco-only',
});
const health = await bellaHealth.json();
assert.equal(health.requiredServerConfig.supabaseUrl, false);
assert.equal(health.requiredServerConfig.supabaseServiceRole, false);
assert.equal(health.activePixGateway, null);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (request) => {
    assert.match(String(request), /gokoco\.supabase\.co\/rest\/v1\/payment_gateways/);
    return new Response(JSON.stringify([{ id: 'venuspay_pix', name: 'Venus Pay', method: 'pix', enabled: true }]), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const sharedGatewayHealth = await worker.fetch(new Request('https://gokoco.example/video/api/checkout-health'), {
    ...env,
    BELLA_SUPABASE_URL: 'https://gokoco.supabase.co',
    BELLA_SUPABASE_SERVICE_ROLE_KEY: 'bella-database-only',
    VENUS_PAY_SECRET_KEY: 'shared-payment-key',
  });
  assert.equal(sharedGatewayHealth.status, 200);
  const sharedGateway = await sharedGatewayHealth.json();
  assert.equal(sharedGateway.activePixGateway, 'venuspay_pix');
  assert.equal(sharedGateway.databaseProject, 'gokoco');
} finally {
  globalThis.fetch = originalFetch;
}

const invalidPix = await worker.fetch(new Request('https://gokoco.example/api/market/pix/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1, quantity: 0 }),
}), env);
assert.equal(invalidPix.status, 400);
assert.match((await invalidPix.json()).error, /Quantidade/);

const wrongPrice = await worker.fetch(new Request('https://gokoco.example/api/market/pix/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 1, quantity: 1, checkoutId: crypto.randomUUID(),
    name: 'Cliente Exemplo', email: 'cliente@example.com', phone: '11999999999', document: '12345678901',
    address: { zipCode: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua Exemplo', neighborhood: 'Centro', number: '1' },
  }),
}), env);
assert.equal(wrongPrice.status, 400);
assert.match((await wrongPrice.json()).error, /Valor do pedido/);

const invalidBellaCart = await worker.fetch(new Request('https://gokoco.example/video/api/orders/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Cliente Exemplo', email: 'cliente@example.com', items: [{ id: 'produto-inexistente', quantity: 1 }] }),
}), env);
assert.equal(invalidBellaCart.status, 400);
assert.match((await invalidBellaCart.json()).error, /carrinho|produto/i);

console.log('Rotas multi-site e validação PIX verificadas.');
