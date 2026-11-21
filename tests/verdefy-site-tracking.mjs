import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {getWhitepageHtml} from '../worker-src/whitepage.js';

const attributionScript = readFileSync(new URL('../js/purchase-attribution.js', import.meta.url), 'utf8');
function visit(url, storage) {
  const scripts = [];
  const window = {};
  const document = {
    cookie: '',
    querySelector: () => null,
    createElement: () => ({setAttribute() {}}),
    head: {appendChild: element => scripts.push(element.src)},
  };
  runInNewContext(attributionScript, {
    window, document, location: new URL(url), URLSearchParams, Date,
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
  });
  return {scripts, tracking: window.getVerdefyTracking()};
}

test('domínios próprios carregam o rastreador e carregam o mesmo vínculo até o checkout', () => {
  for (const domain of ['https://bellamix-oficial.shop', 'https://gokoco-tiktok.online']) {
    const storage = new Map();
    const product = visit(domain + '/oferta?utm_id=12345', storage);
    const checkout = visit(domain + '/whitepage-checkout', storage);
    assert.equal(product.scripts.length, 1);
    const script = new URL(product.scripts[0]);
    assert.equal(script.origin, 'https://verdefy.loja-oficial.workers.dev');
    assert.equal(script.pathname, '/tracker.js');
    assert.match(script.searchParams.get('pixel'), /^[a-f0-9-]{36}$/);
    assert.equal(checkout.tracking.verdefy_pixel, script.searchParams.get('pixel'));
    assert.equal(checkout.tracking.utm_id, '12345');
  }
  const unknown = visit('https://other-shop.invalid/oferta', new Map());
  assert.equal(unknown.scripts.length, 0);
  assert.equal(unknown.tracking.verdefy_pixel, undefined);
});

test('a loja Bella Mix e seu checkout usam o script e preservam a atribuição no pedido', () => {
  const includesLoader = /<script src="\/js\/purchase-attribution\.js\?v=verdefy-4"><\/script>/;
  for (const page of ['whitepage.html', 'whitepage-produto.html', 'whitepage-checkout.html']) {
    assert.match(readFileSync(new URL('../' + page, import.meta.url), 'utf8'), includesLoader);
  }
  assert.match(getWhitepageHtml(), includesLoader);
  const checkout = readFileSync(new URL('../whitepage-checkout.html', import.meta.url), 'utf8');
  assert.match(checkout, /tracking: window\.getVerdefyTracking \? window\.getVerdefyTracking\(\)/);
});
