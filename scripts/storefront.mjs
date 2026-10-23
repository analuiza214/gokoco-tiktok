const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

// Vitrine da porta original (TikTok Shop): o próprio loja.html do site serve
// de template — mesmo banner, perfil, abas e grade. As cores da escova ficam
// como estão (já são os produtos da loja) e os complementos entram no fim.
export function renderOriginalStorefront(products, lojaHtml) {
  const cards = products.map((p) => {
    const oldPrice = Math.ceil(p.price * 1.5) - 0.1;
    const discount = Math.round((1 - p.price / oldPrice) * 100);
    const price = money(p.price).replace('R$', '').trim();
    return `<a class="product" href="/upsell${p.step}" aria-label="Ver ${escape(p.name)} por ${money(p.price)}"><div class="photo"><img src="${p.images[0]}" alt="${escape(p.name)}" loading="lazy"><span class="shipping">Frete grátis</span></div><div class="info"><p class="title">${escape(p.name)}</p><div><span class="price"><small>R$</small> ${price}</span><span class="discount">-${discount}%</span></div><div class="old">${money(oldPrice)}</div><div class="colors"><span class="dot" style="background:#e5e0d8"></span>${escape(p.contents)}</div></div></a>`;
  }).join('');
  return lojaHtml
    .replace('<title>', '<meta name="robots" content="noindex,nofollow"><title>')
    // Cada grid termina no </a> do último card + </div>: adiciona os
    // complementos depois dos cards da escova, mantendo a ordem da loja.
    .replace(/<div class="grid">([\s\S]*?)<\/a><\/div>/g, (m, inner) => `<div class="grid">${inner}</a>${cards}</div>`)
    .replace('<div class="stat"><strong>4,6 ★</strong><span>Avaliação</span></div>', '<div class="stat"><strong>4,8 ★</strong><span>Avaliação</span></div>')
    .replace('<div class="stat"><strong>Bivolt</strong><span>Voltagem</span></div>', '<div class="stat"><strong>12</strong><span>Produtos</span></div>')
    .replace('Conheça nossa escova modeladora GOKOCO nas cores preta, branca e rosa, com voltagem bivolt.', 'Conheça nossa seleção de produtos para cabelos, pele e corpo.')
    .replace('</body>', '<script>document.querySelectorAll(".grid a.product").forEach(function(a){a.href+=location.search;});</script></body>');
}
