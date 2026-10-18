import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';

const env = {
  SITE_URL: 'https://gokoco.example',
  ASSETS: { fetch: (request) => new Response(new URL(request.url).pathname) },
};
const path = async (url) => (await worker.fetch(new Request(url), env)).text();

assert.equal(await path('https://gokoco.example/loja.html'), '/loja.html');
assert.equal(await path('https://gokoco.example/tl'), '/tl/index.html');
assert.equal(await path('https://gokoco.example/tl/cep'), '/tl/index.html');
assert.equal(await path('https://gokoco.example/tl/assets/store.js'), '/tl/assets/store.js');
assert.equal(await path('https://gokoco.example/video/checkout'), '/video/index.html');
assert.equal(await path('https://gokoco.example/video/checkout/'), '/video/index.html');
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
