import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldCloakRequest } from '../worker-src/server-cloaker.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('oferta limpa após a barra nunca ativa cloaking para bots ou desktop', () => {
  const fakeMetaReq = { headers: new Headers({ 'User-Agent': 'facebookexternalhit/1.1' }) };
  const fakeDesktopReq = { headers: new Headers({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }) };

  // Caminho /oferta e /pagamento-oferta no mesmo domínio (após a barra): sem cloaking
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://bellamix-oficial.shop/oferta')), false);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://bellamix-oficial.shop/oferta')), false);
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://bellamix-oficial.shop/pagamento-oferta')), false);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://bellamix-oficial.shop/pagamento-oferta')), false);

  // Domínio original na raiz /: cloaking ativo como antes para comparar no teste A/B
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://bellamix-oficial.shop/')), true);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://bellamix-oficial.shop/')), true);
});

test('arquivos gerados da oferta não contêm referências a TikTok ou Lovable', () => {
  const oferta = fs.readFileSync(path.join(root, 'oferta.html'), 'utf8');
  const pagOferta = fs.readFileSync(path.join(root, 'pagamento-oferta.html'), 'utf8');

  assert.doesNotMatch(oferta, /tiktok|tik tok|lovable/i);
  assert.doesNotMatch(pagOferta, /tiktok|tik tok|lovable/i);
  assert.match(oferta, /Bella Mix/);
  assert.match(pagOferta, /Bella Mix/);
});
