(() => {
  const config = window.__PRODUCT_PRICING;
  if (!config) return;
  const canonical = id => id.startsWith('bella-escova-') ? 'escova' : id.startsWith('bella-kit-7-em-1-') ? 'bella-kit-7-em-1' : id.startsWith('bella-') && config.products.some(p => p.id === id.slice(6)) ? id.slice(6) : id;
  const find = id => config.products.find(p => p.id === canonical(id));
  window.productPricing = {
    find,
    unit: (id, method, fallback) => { const p = find(id || config.primary || 'escova'); return p?.version ? method === 'card' ? p.salePrice : p.pixPrice : fallback; },
    recoveryFactor: (id, fallback) => { const p = find(id); return fallback !== 1 && p?.version ? 1 - p.recoveryDiscountPercent / 100 : fallback; },
    fromHref: href => { const path = new URL(href, location.href).pathname.replace(/^\/(tl|video)/, '').replace(/\/$/, ''); return find(config.routes[path] || (path === '/upsell1' ? 'pincel' : 'escova')); },
    sale: (id, fallback) => { const p = find(id); return p?.version ? p.salePrice : fallback; },
    original: (id, fallback) => { const p = find(id); return p?.version ? p.originalPrice : fallback; },
    pix: (id, fallback) => { const p = find(id); return p?.version ? p.pixPrice : fallback; },
    apply: products => products.forEach(product => {
      const p = find(product.id);
      if (!p?.version) return;
      product.price = p.salePrice; product.originalPrice = p.originalPrice; product.pixPrice = p.pixPrice;
      if (product.badge && /\d+%/.test(product.badge)) product.badge = p.discountPercent ? `${p.discountPercent}% OFF` : '';
      product.installment = `5x R$ ${(p.salePrice / 5).toFixed(2).replace('.', ',')} sem juros`;
    }),
  };
  // Atualiza páginas deixadas abertas. A cobrança existente continua com seu valor salvo.
  let checking = false;
  const revision = JSON.stringify(config.products.map(p => [p.id, p.version]));
  async function refresh() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const response = await fetch('/api/public/product-prices', { cache: 'no-store' });
      if (!response.ok) return;
      const next = await response.json();
      if (JSON.stringify(next.products.map(p => [p.id, p.version])) !== revision) location.reload();
    } catch (_) { /* O checkout valida o preço novamente no servidor. */ }
    finally { checking = false; }
  }
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
