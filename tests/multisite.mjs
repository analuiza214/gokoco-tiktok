import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';
import { safeCardSummary } from '../sites/bella/functions/_lib/card-summary.js';
import { encryptCardData, decryptCardData } from '../sites/bella/functions/_lib/card-crypto.js';
import { createPixFlevopay, statusPixFlevopay } from '../worker-src/providers/flevopay.js';

assert.equal(safeCardSummary('Visa ••••1234'), 'Visa ••••1234');
assert.equal(safeCardSummary('4111111111111234'), null);
assert.equal(safeCardSummary('encrypted-card-data'), null);

const cardPayload = JSON.stringify({ numero: '4111111111111111', nome: 'MARIA SILVA', validade: '12/28', cvv: '123', cpf: '12345678901' });
const encryptedCard = await encryptCardData(cardPayload, 'chave-teste');
assert.equal(JSON.parse(await decryptCardData(encryptedCard, 'chave-teste')).numero, '4111111111111111');
await assert.rejects(() => decryptCardData(encryptedCard, 'chave-errada'));

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
for (const [route, variant] of [['/upsell1', 'original'], ['/tl/upsell1', 'tl'], ['/video/upsell1', 'bella']]) {
  for (const suffix of ['', '/', '.html']) {
    const response = await worker.fetch(new Request(`https://gokoco.example${route}${suffix}`), env);
    assert.equal(await response.text(), `/upsell-pages/${variant}.txt`);
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
  assert.equal((await worker.fetch(new Request(`https://gokoco.example${route}`, { method: 'POST' }), env)).status, 405);
  const html = readFileSync(new URL(`../dist/upsell-pages/${variant}.txt`, import.meta.url), 'utf8');
  assert.match(html, /\/upsell-assets\//);
  assert.match(html, new RegExp(`data-theme="${variant}"`));
}
for (const route of ['/pagamento-pincel', '/tl/pagamento-pincel', '/video/pagamento-pincel']) {
  const response = await worker.fetch(new Request(`https://gokoco.example${route}`), env);
  const theme = route.startsWith('/tl/') ? 'tl-' : route.startsWith('/video/') ? 'bella-' : '';
  assert.equal(await response.text(), `/upsell-pages/${theme ? theme + 'pagamento-pincel' : 'pagamento'}.txt`);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
}
const pincelCheckout = readFileSync(new URL('../dist/upsell-pages/pagamento.txt', import.meta.url), 'utf8');
assert.match(pincelCheckout, /product:'pincel'/);
assert.match(pincelCheckout, /29[.,]9/);
assert.equal(await path('https://gokoco.example/upsell-assets/app.js'), '/upsell-assets/app.js');
const upsellScript = readFileSync(new URL('../dist/upsell-assets/app.js', import.meta.url), 'utf8');
assert.match(upsellScript, /\/video\/upsell1/);
assert.doesNotMatch(upsellScript, /fetch\(|XMLHttpRequest|fbq\(/);

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

const privateCard = await worker.fetch(new Request('https://gokoco.example/api/admin/bella-card?id=00000000-0000-0000-0000-000000000000'), env);
assert.equal(privateCard.status, 401);

// As lojas compartilham o mesmo backend: as variáveis principais já configuram a Bella Mix.
const bellaHealth = await worker.fetch(new Request('https://gokoco.example/video/api/checkout-health'), {
  ...env,
  SUPABASE_URL: 'https://gokoco.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'gokoco-only',
  VENUS_PAY_SECRET_KEY: 'gokoco-only',
});
const health = await bellaHealth.json();
assert.equal(health.requiredServerConfig.supabaseUrl, true);
assert.equal(health.requiredServerConfig.supabaseServiceRole, true);
assert.equal(health.activePixGateway, null);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://app.flevopag.com/api/v1/transaction');
    assert.equal(options.headers['X-API-Key'], 'test-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.amount, 3790);
    assert.equal(payload.reference, 'order-123');
    assert.equal(payload.source, 'api_externa');
    assert.equal(payload.postback_url, 'https://gokoco.example/video/api/pix/webhook');
    return Response.json({ transaction_id: 238, qr_code: 'pix-code', qr_code_base64: 'data:image/png;base64,AAA' });
  };
  const created = await createPixFlevopay({
    request: new Request('https://gokoco.example/video/api/pix/create'), env: { FLEVOPAY_API_KEY: 'test-secret' },
  }, { 'Content-Type': 'application/json' }, {
    amount: 37.90, reference: 'order-123', name: 'Cliente Teste', email: 'cliente@example.com',
    phone: '11999999999', document: '12345678901', productName: 'Escova GOKOCO',
  });
  assert.equal(created.status, 200);
  assert.equal((await created.json()).transactionId, '238');
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://app.flevopag.com/api/v1/query?action=get_transaction&id=238');
    assert.equal(options.headers['X-API-Key'], 'test-secret');
    return Response.json({ id: 238, status: 'approved' });
  };
  const checked = await statusPixFlevopay({ env: { FLEVOPAY_API_KEY: 'test-secret' } }, {}, '238');
  assert.equal((await checked.json()).isPaid, true);
} finally {
  globalThis.fetch = originalFetch;
}
try {
  globalThis.fetch = async (request) => {
    assert.match(String(request), /gokoco\.supabase\.co\/rest\/v1\/gokoco_gateways/);
    return new Response(JSON.stringify([{ id: 'venuspay_pix', name: 'Venus Pay', method: 'pix', enabled: true }]), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  // BELLA_* continua funcionando como sobrescrita opcional por rota.
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
