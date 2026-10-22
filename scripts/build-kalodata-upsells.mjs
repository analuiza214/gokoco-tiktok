import fs from 'node:fs';
import path from 'node:path';
import { upsellCatalog } from '../worker-src/upsell-catalog.js';
import { renderStorefront } from './storefront.mjs';

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themes = [
  { id: 'original', prefix: '', name: 'GOKOCO', subtitle: 'BELEZA & CUIDADO', accent: '#fe2c55', background: '#fafafa', header: '#fff', ink: '#161823' },
  { id: 'tl', prefix: '/tl', name: 'TL', subtitle: 'SUA ROTINA DE BELEZA', accent: '#3483fa', background: '#f5f5f5', header: '#ffe600', ink: '#222' },
  { id: 'bella', prefix: '/video', name: 'Bella Mix', subtitle: 'BRASIL', accent: '#9a355d', background: '#fcf9f8', header: '#fff', ink: '#382632' },
];

function renderProduct(product, theme) {
  const p = product;
  const next = `${theme.prefix}/${p.step < 6 ? `upsell${p.step + 1}` : 'upsell-concluido'}`;
  const checkout = `${theme.prefix}/pagamento-${p.id}`;
  const source = `https://www.kalodata.com/product/detail?id=${p.sourceId}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(p.name)} | ${theme.name}</title><meta name="description" content="${escape(p.description)}"><link rel="stylesheet" href="/upsell-assets/kalodata.css"></head>
<body data-theme="${theme.id}" style="--accent:${theme.accent};--background:${theme.background};--header:${theme.header};--ink:${theme.ink}">
<header class="store-header"><a href="${theme.prefix}/vitrine" class="brand">${theme.name}<small>${theme.subtitle}</small></a><a href="${theme.prefix}/vitrine" style="font-size:12px;text-decoration:none">← Ver todos os produtos</a></header>
<main><nav class="crumb" aria-label="Etapas">Compra principal <span>›</span> Complementos <span>›</span> ${escape(p.category)}</nav>
<section class="product-grid"><div class="gallery"><div class="main-picture"><img id="main-image" src="${p.images[0]}" alt="${escape(p.name)}" width="800" height="800" fetchpriority="high"></div><div class="thumbnails" aria-label="Imagens do produto">${p.images.map((src,i)=>`<button type="button" data-photo="${src}" aria-label="Ver imagem ${i+1}" aria-pressed="${i===0}"><img src="${src}" alt="${escape(p.name)} — imagem ${i+1}" loading="lazy" width="76" height="76"></button>`).join('')}</div></div>
<div class="product-info"><span class="tag">Complemento opcional</span><p class="category">${escape(p.category)}</p><h1>${escape(p.name)}</h1><a class="rating" href="#avaliacoes"><span aria-hidden="true">★</span> ${p.rating.toFixed(1).replace('.',',')} / 5 <small>Nota do produto na fonte consultada</small></a><p class="description">${escape(p.description)}</p><div class="price">${money(p.price)}</div><p class="price-detail">Valor por unidade · pagamento via PIX</p><div class="included"><strong>O que vem</strong><p>${escape(p.contents)}</p></div><a class="buy" data-buy href="${checkout}">Quero adicionar este produto <span>→</span></a><a class="skip" href="${next}">Continuar sem este produto</a><p class="optional">Você escolhe se deseja comprar este complemento. Ele possui pagamento próprio.</p></div></section>
<section class="section" id="videos"><div class="section-title"><div><p class="eyebrow">Veja o produto em vídeo</p><h2>Conheça de perto</h2></div><span>${p.videos.length} vídeos</span></div><p class="section-intro">Conteúdos de criadores vinculados a este produto na fonte consultada. Podem incluir publicidade.</p><div class="video-grid">${p.videos.map((src,i)=>`<article class="video-card"><video controls playsinline preload="none" aria-label="Vídeo ${i+1} sobre ${escape(p.name)}"><source src="${src}" type="video/mp4"></video><p>Vídeo ${String(i+1).padStart(2,'0')}</p></article>`).join('')}</div></section>
<section class="section" id="avaliacoes"><p class="eyebrow">Avaliação do produto</p><h2>Nota na fonte consultada</h2><div class="review-summary"><div><strong>${p.rating.toFixed(1).replace('.',',')}</strong><span> / 5</span><p class="stars" aria-label="Nota ${p.rating} de 5">★ ★ ★ ★ ★</p></div><div><h3>${escape(p.name)}</h3><p>Nota geral exibida no Kalodata na coleta de 22/10/2026. Não representa avaliações recebidas nesta loja.</p><a href="${source}" target="_blank" rel="noopener noreferrer">Consultar fonte ↗</a></div></div><p class="section-intro">Não há depoimentos individuais disponíveis para exibição.</p></section>
<section class="section faq"><h2>Antes de escolher</h2><details><summary>O que está incluído?</summary><p>${escape(p.contents)}. Confira as imagens e as informações da embalagem.</p></details><details><summary>Como usar o produto?</summary><p>Siga o modo de uso e as precauções do fabricante no rótulo. Confira a indicação para sua rotina antes de usar.</p></details><details><summary>Preciso adicionar este produto?</summary><p>Não. O complemento é opcional. Você pode seguir sem adicioná-lo.</p></details></section>
<section class="last-call"><h2>Complete seus cuidados</h2><p>${escape(p.name)}</p><a class="buy" data-buy href="${checkout}">Adicionar por ${money(p.price)} <span>→</span></a><a class="skip" href="${next}">Continuar sem adicionar</a></section></main>
<footer>${theme.name} · ${theme.subtitle}</footer><div class="mobile-buy"><div><small>Complemento opcional</small><strong>${money(p.price)}</strong></div><a class="buy" data-buy href="${checkout}">Adicionar</a></div>
<script>document.querySelectorAll('[data-photo]').forEach(function(button){button.addEventListener('click',function(){document.getElementById('main-image').src=button.dataset.photo;document.querySelectorAll('[data-photo]').forEach(function(other){other.setAttribute('aria-pressed',String(other===button));});});});document.querySelectorAll('video').forEach(function(video){video.addEventListener('play',function(){document.querySelectorAll('video').forEach(function(other){if(other!==video)other.pause();});});});document.querySelectorAll('[data-buy]').forEach(function(link){link.addEventListener('click',function(){try{localStorage.setItem('qtdSelecionada','1');localStorage.setItem('corSelecionada',${JSON.stringify(p.name)});localStorage.setItem('corImagem',${JSON.stringify(p.images[0])});localStorage.setItem('coresSelecionadas','[]');localStorage.setItem('precoUnit',${JSON.stringify(p.price.toFixed(2))});localStorage.setItem('voltagemSelecionada','');}catch(e){}var url=new URL(link.href);url.search=location.search;link.href=url.href;});});document.querySelectorAll('a.skip').forEach(function(link){var url=new URL(link.href);url.search=location.search;link.href=url.href;});</script></body></html>`;
}

export async function buildKalodataUpsells({root,output,buildCheckout}) {
  const storefrontProducts = [];
  const assets = path.join(output,'upsell-assets');
  const pages = path.join(output,'upsell-pages');
  const materialRoot = path.resolve(root,'../..','Produtos Kalodata');
  const sourceRoot = path.join(root,'rascunhos-upsell','kalodata');
  fs.mkdirSync(sourceRoot,{recursive:true});
  // Import once into the repository. Subsequent builds work without the desktop source.
  for (const p of upsellCatalog) {
    const target=path.join(sourceRoot,p.id);
    if(!fs.existsSync(target)) {
      const source=path.join(materialRoot,p.folder);
      if(!fs.existsSync(source))throw new Error(`Materiais ausentes para ${p.id}`);
      fs.cpSync(source,target,{recursive:true});
    }
    fs.cpSync(target,path.join(assets,'kalodata',p.id),{recursive:true});
    const files = kind => fs.readdirSync(path.join(target,kind)).filter(file=>kind==='Imagens'?/\.(png|webp|jpe?g)$/i.test(file):/\.mp4$/i.test(file)).sort((a,b)=>a==='01-principal.png'?-1:b==='01-principal.png'?1:a.localeCompare(b));
    const url=kind=>files(kind).map(file=>`/upsell-assets/kalodata/${p.id}/${kind}/${file}`);
    const product={...p,images:url('Imagens'),videos:url('Videos')};
    storefrontProducts.push(product);
    if(!product.images.length||!product.videos.length)throw new Error(`Mídias ausentes: ${p.id}`);
    for(const theme of themes){
      fs.writeFileSync(path.join(pages,`${theme.id}-${p.id}.txt`),renderProduct(product,theme));
      buildCheckout({...p,priceText:money(p.price),oldPriceText:money(p.price)},product.images,`${theme.id}-pagamento-${p.id}`,`${theme.prefix}/${p.step<6?`upsell${p.step+1}`:'upsell-concluido'}`);
    }
  }
  for(const theme of themes){
    fs.writeFileSync(path.join(pages,`${theme.id}-vitrine.txt`),renderStorefront(storefrontProducts,theme));
    fs.writeFileSync(path.join(pages,`${theme.id}-concluido.txt`),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Suas escolhas | ${theme.name}</title><link rel="stylesheet" href="/upsell-assets/kalodata.css"><body style="--accent:${theme.accent};--background:${theme.background};--header:${theme.header};--ink:${theme.ink}"><header class="store-header"><span class="brand">${theme.name}</span></header><main><section class="last-call"><h1>Você chegou ao fim dos complementos</h1><p>Você pode acompanhar os pedidos com pagamento confirmado na página de rastreio.</p><a class="buy" href="/rastreio.html">Acompanhar meu pedido</a><a class="skip" href="${theme.prefix}/upsell2">Rever os complementos</a></section></main></body></html>`);
  }
  const pincelCheckout=path.join(pages,'pagamento.txt');
  fs.writeFileSync(pincelCheckout,fs.readFileSync(pincelCheckout,'utf8').replaceAll('/upsell1','/upsell2'));
  for(const theme of themes.filter(t=>t.prefix)) {
    fs.writeFileSync(path.join(pages,`${theme.id}-pagamento-pincel.txt`),fs.readFileSync(pincelCheckout,'utf8').replaceAll('/upsell2',`${theme.prefix}/upsell2`));
  }
  // A skip link on the existing offer makes the rest of the sequence reachable.
  for(const theme of themes){
    const file=path.join(pages,theme.id==='original'?'original.txt':theme.id==='tl'?'tl.txt':'bella.txt');
    const skip=`<div style="text-align:center;padding:20px 16px 100px"><a href="${theme.prefix}/upsell2" style="color:#666;text-decoration:underline">Continuar sem o kit de pincéis</a></div>`;
    let html=fs.readFileSync(file,'utf8').replace('</body>',skip+'</body>');
    if(theme.prefix) {
      // Existing React bundles contain the checkout destination, so keep it in
      // the current storefront when the browser follows that destination.
      const keepTheme=`<script>document.addEventListener('click',function(event){var link=event.target.closest('a[href="/pagamento-pincel"]');if(link)link.href='${theme.prefix}/pagamento-pincel';},true);</script>`;
      html=html.replace('</body>',keepTheme+'</body>');
      const bundleFile=path.join(assets,`${theme.id}-model.js`);
      fs.writeFileSync(bundleFile,fs.readFileSync(bundleFile,'utf8').replaceAll('/pagamento-pincel',`${theme.prefix}/pagamento-pincel`));
    }
    fs.writeFileSync(file,html);
  }
  fs.copyFileSync(path.join(root,'rascunhos-upsell','assets','kalodata.css'),path.join(assets,'kalodata.css'));
  fs.copyFileSync(path.join(root,'rascunhos-upsell','assets','storefront.css'),path.join(assets,'storefront.css'));
  console.log('Kalodata: 15 páginas, 15 checkouts e 3 finais gerados.');
}
