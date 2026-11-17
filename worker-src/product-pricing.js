import { forjaProducts } from './forja-catalog.js';
import { upsellCatalog } from './upsell-catalog.js';

const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const product = (id, name, salePrice, originalPrice = salePrice, pixDiscountPercent = 0) => ({ id, name, salePrice, originalPrice, pixDiscountPercent, recoveryDiscountPercent: 50, version: null });
export const priceDefaults = [
  product('escova', 'Escova 3 em 1 · GOKOCO / Bella Mix / TL', 37.9, 167.9),
  product('bella-kit-7-em-1', 'Bella Mix · Kit 7 em 1 (todas as cores)', 69.9, 69.9, 10),
  product('pincel', 'Pincel', 11.96, 19.9),
  product('necessaire', 'Complemento · Nécessaire', 19.47),
  product('siage', 'Complemento · Siàge', 32.63),
  product('wella', 'Complemento · Wella', 45.7),
  ...upsellCatalog.map(p => product(p.id, p.name, p.price, Math.ceil(p.price * p.oldFactor) - 0.1)),
  ...[...forjaProducts.values()].map(p => product('forja:' + p.id, 'Forja · ' + p.title, p.price, Math.max(p.price, p.oldPrice))),
];
export const canonicalPriceId = id => String(id).startsWith('bella-escova-') ? 'escova' : String(id).startsWith('bella-kit-7-em-1-') ? 'bella-kit-7-em-1' : String(id).startsWith('bella-') && priceDefaults.some(p => p.id === String(id).slice(6)) ? String(id).slice(6) : String(id);
export function priceFor(prices, id) {
  const key = canonicalPriceId(id);
  return prices?.find(p => p.id === key) || priceDefaults.find(p => p.id === key);
}
export const discountedPrice = (price, percent = 0) => round(price * (1 - percent / 100));
export const saleDiscount = p => Math.round((1 - p.salePrice / p.originalPrice) * 100);
export function publicPrice(p) {
  return { ...p, discountPercent: saleDiscount(p), pixPrice: discountedPrice(p.salePrice, p.pixDiscountPercent) };
}

export async function loadPrices(env) {
  if (env.PRODUCT_PRICES) return { products: env.PRODUCT_PRICES, ready: env.PRODUCT_PRICES_READY !== false };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { products: priceDefaults, ready: false };
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/gokoco_product_prices?select=*`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(10000),
  });
  const rows = await response.json().catch(() => null);
  if (!response.ok) {
    if (['PGRST205', '42P01'].includes(rows?.code)) return { products: priceDefaults, ready: false };
    throw new Error('Não foi possível consultar os preços. Tente novamente.');
  }
  if (!Array.isArray(rows)) throw new Error('Resposta de preços inválida.');
  return { ready: true, products: priceDefaults.map(base => {
    const row = rows.find(r => r.id === base.id);
    return row ? { ...base, originalPrice: Number(row.original_price), salePrice: Number(row.sale_price), pixDiscountPercent: Number(row.pix_discount_percent), recoveryDiscountPercent: Number(row.recovery_discount_percent), version: row.version } : base;
  }) };
}

export function validatePrice(body) {
  const base = priceDefaults.find(p => p.id === body?.id);
  if (!base) throw new Error('Produto inválido.');
  for (const key of ['originalPrice', 'salePrice', 'pixDiscountPercent', 'recoveryDiscountPercent']) {
    if (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || Math.abs(round(body[key]) - body[key]) > 0.000001) throw new Error('Informe valores válidos com até duas casas decimais.');
  }
  if (body.salePrice < 0.01 || body.originalPrice < body.salePrice || body.originalPrice > 999999.99) throw new Error('O preço original deve ser maior ou igual ao preço de venda, e ambos devem ser positivos.');
  if ([body.pixDiscountPercent, body.recoveryDiscountPercent].some(p => p < 0 || p > 99)) throw new Error('Os descontos adicionais devem ficar entre 0% e 99%.');
  if (discountedPrice(discountedPrice(body.salePrice, body.pixDiscountPercent), body.recoveryDiscountPercent) < 0.01) throw new Error('O valor após os descontos deve ser de pelo menos R$ 0,01.');
  return { ...base, ...Object.fromEntries(['originalPrice', 'salePrice', 'pixDiscountPercent', 'recoveryDiscountPercent'].map(k => [k, body[k]])) };
}

export async function savePrice(env, body) {
  const p = validatePrice(body);
  const current = await loadPrices(env);
  if (!current.ready) return { error: 'A tabela de preços ainda precisa ser instalada no banco. Execute a migração gokoco_product_prices.sql antes de salvar.', status: 503 };
  const previous = priceFor(current.products, p.id);
  if ((body.version || null) !== previous.version) return { error: 'O preço foi alterado em outra sessão. Atualize e confira os valores antes de salvar.', status: 409 };
  const version = crypto.randomUUID();
  const payload = { id: p.id, original_price: p.originalPrice, sale_price: p.salePrice, pix_discount_percent: p.pixDiscountPercent, recovery_discount_percent: p.recoveryDiscountPercent, version, updated_at: new Date().toISOString() };
  const query = previous.version ? `?id=eq.${encodeURIComponent(p.id)}&version=eq.${encodeURIComponent(previous.version)}` : '';
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/gokoco_product_prices${query}`, {
    method: previous.version ? 'PATCH' : 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
  const saved = await response.json().catch(() => null);
  if (response.status === 409 || (response.ok && !saved?.length)) return { status: 409, error: 'O produto mudou em outra sessão. Atualize os preços.' };
  if (!response.ok) return { status: 502, error: 'Não foi possível salvar o preço no banco.' };
  return { product: publicPrice({ ...p, version }) };
}

export function pagePriceId(pathname) {
  const route = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (route === '/forja' || route === '/forja/index' || route === '/forja/pagamento') return 'forja:soarfly-kit-ferramentas-4-em-1-48vf';
  if (/^\/forja\/(produtos|checkout)\//.test(route)) return 'forja:' + route.split('/').at(-1);
  if (route.startsWith('/forja/')) return null;
  const tail = route.replace(/^\/(tl|video)/, '') || '/';
  if (tail === '/pagamento-pincel' || tail === '/upsell1') return 'pincel';
  const upsell = upsellCatalog.find(p => tail === '/upsell' + p.step || tail === '/pagamento-' + p.id);
  if (upsell) return upsell.id;
  return ['/', '/index', '/pagamento'].includes(tail) && !route.startsWith('/video') ? 'escova' : null;
}

// Muda somente valores monetários conhecidos, sem alterar números em estilos ou SVGs.
function replaceAmount(text, from, to) {
  if (from === to) return text;
  const fixed = Number(from).toFixed(2);
  const tokens = [fixed, ...(fixed.endsWith('0') ? [fixed.slice(0, -1)] : []), ...(Number.isInteger(Number(from)) ? [] : [String(Number(from))]), fixed.replace('.', ',')].sort((a, b) => b.length - a.length);
  for (const token of new Set(tokens)) {
    const pattern = new RegExp('(?<![\\d.])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\d|[.,]\\d)', 'g');
    text = text.replace(pattern, token.includes(',') ? Number(to).toFixed(2).replace('.', ',') : Number(to).toFixed(2));
  }
  if (Number.isInteger(Number(from))) {
    const pattern = new RegExp('(\\b(?:price|oldPrice|UNIT|PRICE|ORIGINAL_PRICE|value)\\s*[:=]\\s*)' + Number(from) + '(?![\\d.])', 'g');
    text = text.replace(pattern, (_, prefix) => prefix + Number(to).toFixed(2));
  }
  return text;
}

function replaceProduct(text, base, p, checkout = false) {
  if (!p.version) return text;
  const selling = checkout ? discountedPrice(p.salePrice, p.pixDiscountPercent) : p.salePrice;
  const originals = [];
  text = text.replace(/<(span|div|del|s)\b[^>]*class=["'][^"']*(?:\bold\b|line-through)[^"']*["'][^>]*>[\s\S]*?<\/\1>/g, value => {
    originals.push(replaceAmount(value, base.originalPrice, p.originalPrice)); return `<!--ORIGINAL_PRICE_${originals.length - 1}-->`;
  });
  text = text.replace(/(\bORIGINAL_PRICE\s*=\s*)[\d.]+/g, (_, prefix) => prefix + '__CONFIGURED_ORIGINAL__');
  // Placeholders avoid replacing an updated price again when it equals another old amount.
  const substitutions = [];
  // Each distinct original value has one meaning within this product section.
  const pairs = [...(base.originalPrice !== base.salePrice ? [[base.originalPrice, p.originalPrice]] : []), ...(base.originalPrice - base.salePrice !== base.salePrice ? [[base.originalPrice - base.salePrice, p.originalPrice - selling]] : []), [base.salePrice / 5, selling / 5], [base.salePrice, selling]];
  for (const [from, to] of pairs) if (from > 0 && !substitutions.some(s => s[2] === from)) {
    const placeholder = 900000 + substitutions.length + 0.99;
    text = replaceAmount(text, from, placeholder); substitutions.push([placeholder, to, from]);
  }
  for (const [placeholder, to] of substitutions) text = replaceAmount(text, placeholder, to);
  text = text.replaceAll('__CONFIGURED_ORIGINAL__', p.originalPrice.toFixed(2));
  text = text.replace(/<!--ORIGINAL_PRICE_(\d+)-->/g, (_, index) => originals[Number(index)]);
  const oldPercent = saleDiscount(base);
  text = text.replace(new RegExp(`([>\\s-])${oldPercent}%(?=[<\\s])`, 'g'), `$1${saleDiscount(p)}%`);
  if (checkout) text = text.replace(/(getItem\([^)]*disc[^)]*\)\s*===?\s*['"]0\.5['"]\s*\?\s*)0\.5/g, `$1${1 - p.recoveryDiscountPercent / 100}`);
  if (!checkout && p.pixDiscountPercent > 0) text = text.replace('</h1>', `</h1><p class="pricing-pix-note" style="font-size:13px;color:#166534;padding:4px 0">No Pix: R$ ${discountedPrice(p.salePrice, p.pixDiscountPercent).toFixed(2).replace('.', ',')} (${p.pixDiscountPercent}% de desconto extra)</p>`);
  return text;
}

export function renderPrices(html, pathname, prices) {
  const primary = pagePriceId(pathname);
  const art = [];
  html = html.replace(/<(svg|style)\b[^>]*>[\s\S]*?<\/\1>/gi, value => { art.push(value); return `<!--PRICED_ART_${art.length - 1}-->`; });
  const fragments = [];
  // Each recommendation/card is priced independently of the product currently open.
  html = html.replace(/<a\b[^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*>[\s\S]*?<\/a>/g, card => {
    const href = card.match(/href=["']([^"']+)/)?.[1];
    if (!href) return card;
    let id = pagePriceId(href.split('?')[0]);
    if (!id && /loja|vitrine/.test(pathname)) id = primary;
    const base = priceFor(null, id), p = priceFor(prices, id);
    let value = base && p ? replaceProduct(card, base, p) : card;
    if (p?.version) {
      value = value.replace(/(<div\b[^>]*class=["'][^"']*\bold\b[^"']*["'][^>]*>)[\s\S]*?(<\/div>)/g, (_, open, close) => open + (p.originalPrice > p.salePrice ? 'R$ ' + p.originalPrice.toFixed(2).replace('.', ',') : '') + close);
      const badge = saleDiscount(p) ? '-' + saleDiscount(p) + '%' : '';
      if (/class=["'][^"']*\bdiscount\b/.test(value)) value = value.replace(/(<span\b[^>]*class=["'][^"']*\bdiscount\b[^"']*["'][^>]*>)[\s\S]*?(<\/span>)/g, (_, open, close) => open + badge + close);
      else if (badge) value = value.replace(/(<span\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>[\s\S]*?<\/span>)/, `$1<span class="discount">${badge}</span>`);
    }
    fragments.push(value); return `<!--PRICED_CARD_${fragments.length - 1}-->`;
  });
  const bumpPrices = [];
  for (const id of ['necessaire', 'siage', 'wella']) {
    const p = priceFor(prices, id);
    if (p?.version) {
      const marker = 950000.99 + bumpPrices.length;
      html = replaceAmount(html, priceFor(null, id).salePrice, marker);
      bumpPrices.push([marker, /pagamento|\/checkout\//.test(pathname) ? discountedPrice(p.salePrice, p.pixDiscountPercent) : p.salePrice]);
    }
  }
  if (primary) html = replaceProduct(html, priceFor(null, primary), priceFor(prices, primary), /pagamento|\/checkout\//.test(pathname));
  for (const [marker, amount] of bumpPrices) html = replaceAmount(html, marker, amount);
  html = html.replace(/<!--PRICED_CARD_(\d+)-->/g, (_, index) => fragments[Number(index)]);
  // Embedded Forja JSON drives the catalog and product selection too.
  html = html.replace(/(<script\b[^>]*type=["']application\/json["'][^>]*>)([\s\S]*?)(<\/script>)/g, (all, open, content, close) => {
    try { const rows = JSON.parse(content); if (!Array.isArray(rows)) return all;
      return open + JSON.stringify(rows.map(row => { const p = priceFor(prices, 'forja:' + row.id); return p?.version ? { ...row, price: p.salePrice, oldPrice: p.originalPrice, discount: saleDiscount(p) } : row; })).replaceAll('<', '\\u003c') + close;
    } catch { return all; }
  });
  html = html.replace(/<!--PRICED_ART_(\d+)-->/g, (_, index) => art[Number(index)]);
  const config = { products: prices.map(publicPrice), primary, routes: Object.fromEntries(upsellCatalog.map(p => ['/upsell' + p.step, p.id])) };
  return html.replace(/<head([^>]*)>/i, `<head$1><script>window.__PRODUCT_PRICING=${JSON.stringify(config).replaceAll('<', '\\u003c')};</script><script src="/js/product-pricing.js"></script>`);
}
