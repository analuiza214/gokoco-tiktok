import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOfertaSubdomain, shouldCloakRequest } from '../worker-src/server-cloaker.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('validação de subdomínio e rotas da oferta limpa', () => {
  assert.equal(isOfertaSubdomain(new URL('https://oferta.bellamix-oficial.shop/')), true);
  assert.equal(isOfertaSubdomain(new URL('https://promo.bellamix-oficial.shop/')), true);
  assert.equal(isOfertaSubdomain(new URL('https://lp.bellamix-oficial.shop/')), true);
  assert.equal(isOfertaSubdomain(new URL('https://bellamix-oficial.shop/')), false);
  assert.equal(isOfertaSubdomain(new URL('https://bellamix-oficial.shop/oferta')), false);
  assert.equal(isOfertaSubdomain(new URL('https://custom.com/'), { OFERTA_HOSTNAME: 'custom.com' }), true);
});

test('oferta limpa nunca ativa cloaking para bots ou desktop', () => {
  const fakeMetaReq = { headers: new Headers({ 'User-Agent': 'facebookexternalhit/1.1' }) };
  const fakeDesktopReq = { headers: new Headers({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }) };

  // Subdomínio de oferta: sem cloaking
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://oferta.bellamix-oficial.shop/')), false);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://oferta.bellamix-oficial.shop/')), false);

  // Caminho /oferta no domínio principal: sem cloaking
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://bellamix-oficial.shop/oferta')), false);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://bellamix-oficial.shop/oferta')), false);

  // Domínio original raiz: cloaking ativo como antes
  assert.equal(shouldCloakRequest(fakeMetaReq, new URL('https://bellamix-oficial.shop/')), true);
  assert.equal(shouldCloakRequest(fakeDesktopReq, new URL('https://bellamix-oficial.shop/')), true);
});

test('arquivos gerados não contêm referências a TikTok ou Lovable', () => {
  const oferta = fs.readFileSync(path.join(root, 'oferta.html'), 'utf8');
  const pagOferta = fs.readFileSync(path.join(root, 'pagamento-oferta.html'), 'utf8');

  assert.doesNotMatch(oferta, /tiktok|tik tok|lovable/i);
  assert.doesNotMatch(pagOferta, /tiktok|tik tok|lovable/i);
  assert.match(oferta, /Bella Mix/);
  assert.match(pagOferta, /Bella Mix/);
});
