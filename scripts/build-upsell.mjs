import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildKalodataUpsells, offerFor } from './build-kalodata-upsells.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
const assets = path.join(output, 'upsell-assets');
const pages = path.join(output, 'upsell-pages');
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync(pages, { recursive: true });

/* ============================ PRODUTO — editar aqui ============================
   O Wellington vai mandar nome final, fotos, vídeos, descrição e avaliações
   reais do pincel. Até lá, estes são os dados provisórios. IMPORTANTE:
   `price` precisa bater com o valor do produto 'pincel' em cartTotal
   (worker-src/index.js), senão o checkout recusa o pedido. */
const PRODUCT = {
  id: 'pincel',
  name: 'Kit de Pincéis Profissional',
  price: 29.90,
  priceText: 'R$ 29,90',
  oldPriceText: 'R$ 89,90',
  installment: '5x R$ 5,98 sem juros',
  checkoutUrl: '/pagamento-pincel',
  description: 'O Kit de Pincéis Profissional reúne os pincéis essenciais para uma maquiagem completa: base, corretivo, pó, blush, contorno, sombra, delineado e acabamento. Cerdas sintéticas macias e densas, que não soltam e espalham o produto sem desperdício.',
  description2: 'Cabos firmes e confortáveis, virolas reforçadas e kit pensado para uso diário ou profissional. Fácil de limpar com sabão neutro.',
  features: [
    'Kit completo de pincéis para rosto e olhos',
    'Cerdas sintéticas macias e densas',
    'Não solta cerdas durante o uso',
    'Fácil de limpar e secar',
  ],
  specRows: [
    ['Produto', 'Kit de Pincéis Profissional'],
    ['Conteúdo', 'Kit completo de pincéis'],
    ['Cerdas', 'Sintéticas macias e densas'],
    ['Uso', 'Rosto, olhos e acabamento'],
    ['Limpeza', 'Sabão neutro e água'],
    ['Garantia', 'Conforme política do site'],
  ],
  variant: { name: 'Kit completo', file: 'hero.svg', swatch: '#eadbca' },
  // Rótulos usados nas substituições dos templates originais.
  optLabel: 'KIT COMPLETO',
  optionLabel: 'Opção do kit',
  optionPhrase: 'a opção do kit',
  optionShort: 'Opção',
  askAbout: 'o kit',
  exampleQuestion: 'Ex.: Quantos pincéis vêm no kit?',
  rankBadge: '1º em Pincéis e Acessórios',
  matchLabel: 'Pincéis',
  slug: 'kit-pinceis-profissional',
  // Dados exibidos só na versão Bella Mix (produto injetado em lib/data.ts).
  bella: { price: 32.90, rating: 4.9, reviewCount: 582, soldCount: '693 vendidos' },
  faq: [
    { question: 'Quantos pincéis vêm no kit?', answer: 'O kit completo acompanha os pincéis essenciais para rosto, olhos e acabamento.' },
    { question: 'As cerdas são sintéticas?', answer: 'Sim, cerdas sintéticas macias e densas, fáceis de limpar.' },
    { question: 'Serve para iniciantes?', answer: 'Sim, o kit atende desde quem está começando até uso profissional.' },
    { question: 'Como faço para comprar?', answer: 'Clique em Comprar, preencha seus dados e finalize com PIX.' },
    { question: 'Qual o prazo de entrega?', answer: 'Após a confirmação do pagamento você recebe o código de rastreio para acompanhar tudo.' },
    { question: 'E se chegar com defeito?', answer: 'Você pode trocar seguindo a política de devolução do site.' },
    { question: 'O pagamento é seguro?', answer: 'Sim, o pagamento via PIX é processado com segurança.' },
  ],
  reviews: [
    { name: 'Mariana Costa', text: 'Os pincéis são macios e não soltam cerdas. A base ficou muito bem espalhada.', photos: [1] },
    { name: 'Fernanda Alves', text: 'Chegou antes do prazo, veio tudo certinho na embalagem. Gostei bastante da qualidade.', photos: [2] },
    { name: 'Juliana Santos', text: 'Uso todo dia pra maquiagem do trabalho. O de base e o de pó são os meus preferidos.', photos: [3] },
    { name: 'Camila Rodrigues', text: 'Pelo preço achei que viria simples, mas me surpreendi. As cerdas são densas e firmes.', photos: [4] },
    { name: 'Patrícia Mendes', text: 'Comprei pra minha filha que tá começando a se maquiar. Ela amou o kit.', photos: [1] },
    { name: 'Larissa Oliveira', text: 'O pincel de esfumar é muito bom, deixa a sombra bem degradê.', photos: [2] },
    { name: 'Beatriz Ferreira', text: 'Chegou em 8 dias, bem embalado. Recomendo.', photos: [3] },
    { name: 'Ana Paula Souza', text: 'Lavei duas vezes e não caiu nenhuma cerda. Qualidade ótima.', photos: [4] },
  ],
};
/* ============================================================================== */

// As imagens do produto são SVGs transparentes: a foto real vem do sprite
// kit-editorial.png via background CSS (arquivos já gerados pelo Codex).
const photoNames = ['hero', 'hand', 'counter', 'routine'];
for (const name of photoNames) {
  fs.writeFileSync(path.join(assets, `${name}.svg`), '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"></svg>');
}
const PHOTOS = photoNames.map((name) => `/upsell-assets/${name}.svg`);
const spriteCss = `
img[src*="/upsell-assets/"][src$=".svg"]{background-image:url('/upsell-assets/kit-editorial.png');background-size:200% 200%;background-repeat:no-repeat;background-position:0 0;background-color:#fff}
img[src$="/hand.svg"]{background-position:100% 0!important}img[src$="/counter.svg"]{background-position:0 100%!important}img[src$="/routine.svg"]{background-position:100% 100%!important}
`;

function replaceFunction(source, name, body) {
  const expression = new RegExp('^  (?:async )?function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^  \\}', 'm');
  if (!expression.test(source)) throw new Error(`Function ${name} missing from source template`);
  return source.replace(expression, `  function ${name}() { ${body} }`);
}
function replaceBetween(source, start, end, replacement) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Template section missing: ${start}`);
  return source.slice(0, a) + replacement + source.slice(b);
}
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------------------------------------------------------------- TL (Mercado) */
function marketTemplate(source, product = PRODUCT, photos = PHOTOS, videos = []) {
  source = replaceBetween(source, 'const BRUSH_COLORS = [', '] as const;',
    `const BRUSH_COLORS = [${JSON.stringify(product.variant)}`);
  source = replaceBetween(source, 'function answerProductQuestion(', '\nexport default function',
    `function answerProductQuestion(question: string): string { return ${JSON.stringify(product.description)} }\n`);
  // Compra sai da SPA e vai pro checkout PIX do produto.
  source = replaceFunction(source, 'handleFinalizarCompra',
    `setShowCart(false); window.location.assign(${JSON.stringify(product.checkoutUrl)});`);
  const slideItems = photos.map((src) => ({ type: 'image', src }));
  if (videos.length) slideItems.push({ type: 'video', src: videos[0] });
  source = replaceBetween(source, '  const slides: SlideItem[] = [', '\n  function goToSlide',
    `  const slides: SlideItem[] = ${JSON.stringify(slideItems)};\n`);
  source = source.replace(/const reviewPhotos = .*?;/,
    `const reviewPhotos = ${JSON.stringify(photos)};`);
  if (videos.length) {
    source = source.replace(/const testimonialVideos = [^\n]*;/,
      `const testimonialVideos = ${JSON.stringify(videos.slice(0, 4))};`);
    // Thumb real: o primeiro frame do próprio vídeo (sem poster), formato UGC.
    source = source.replace(/ poster=\{img\(`[^`]*`\)\}/, '')
      .replaceAll('preload="none"', 'preload="metadata"');
  }
  // Mesma quantidade de avaliações do template original — só muda o conteúdo.
  const reviews = product.reviews.map((r) => ({ name: r.name, initials: initials(r.name), text: r.text, photos: r.photos }));
  source = replaceBetween(source, '  const brushReviews = [', '\n  const reviewHelpfulCounts',
    `  const brushReviews = ${JSON.stringify(reviews)};\n`);
  const faqCount = (source.match(/question:/g) || []).length;
  const faqs = Array.from({ length: faqCount }, (_, i) => product.faq[i % product.faq.length]);
  source = replaceBetween(source, '  const commonQuestions = [', '\n  return (',
    `  const commonQuestions = ${JSON.stringify(faqs)};`);
  source = replaceBetween(source, "            ['Produto',", '          ].map(([k, v]',
    `            ${product.specRows.map((x) => JSON.stringify(x)).join(',\n')},\n`);
  source = replaceBetween(source, '          A Escova Modeladora GOKOCO 3 em 1 alisa', '\n        </p>', '          ' + product.description);
  source = replaceBetween(source, '          O kit inclui escova modeladora', '\n        </p>', '          ' + product.description2);
  source = replaceBetween(source, "            'Produto: 1 Escova Modeladora", '          ].map((item)',
    `            ${product.features.map((x) => JSON.stringify(x)).join(',\n')},\n`);
  source = source.replace(/img\(`\/images\/escova\/cores\/\$\{[^}]+\}[^`]*`\)/g, JSON.stringify(photos[0]));
  source = source.replace(/alt=\{i === 0 \?[\s\S]*?: 'Detalhe da Escova GOKOCO'\}/, `alt="${product.name}"`);
  source = source.replaceAll('Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt', product.name)
    .replaceAll('Escova Modeladora GOKOCO 3 em 1', product.name)
    .replaceAll('R$ 37,90', product.priceText).replaceAll('37.90', String(product.price))
    .replaceAll('>37<', `>${Math.trunc(product.price)}<`).replaceAll('5x R$ 7,58 sem juros', product.installment)
    .replaceAll('1º em Álbuns Copa do Mundo', product.rankBadge)
    .replaceAll('Pergunte sobre a escova', `Pergunte sobre ${product.askAbout}`)
    .replaceAll('Ex.: A escova é bivolt?', product.exampleQuestion)
    .replaceAll('Escolha a cor da escova', `Escolha ${product.optionPhrase}`)
    .replaceAll('Cor da escova', product.optionLabel).replaceAll('>Cor:', `>${product.optionShort}:`)
    .replaceAll('gokoco_escova', `gokoco_${product.id}`);
  return source;
}

/* ----------------------------------------------- Bundles TL + Bella (React) --- */
async function bundleVariant(variant, { product = PRODUCT, photos = PHOTOS, videos = [], key = variant, sprite = spriteCss } = {}) {
  const market = variant === 'tl';
  const site = path.join(root, 'sites', market ? 'mercado' : 'bella');
  const siteBase = market ? '/tl/' : '/video/';
  const distHtml = fs.readFileSync(path.join(site, 'dist', market ? 'index.html' : 'public/index.html'), 'utf8');
  const entry = market
    ? `import React from 'react';import{createRoot}from'react-dom/client';import{Router}from'wouter';import Product from'@/pages/product-page';createRoot(document.getElementById('root')).render(<Router base="/tl"><Product/></Router>);`
    : `import React from 'react';import{createRoot}from'react-dom/client';import{Router}from'wouter';import Product from'@/pages/product';import{Header}from'@/components/layout/header';import{Footer}from'@/components/layout/footer';import{FreteGratisBar}from'@/components/frete-gratis-bar';createRoot(document.getElementById('root')).render(<Router base="/video"><div className="flex flex-col min-h-screen" style={{overflowX:'hidden',maxWidth:'100%',width:'100%'}}><FreteGratisBar/><div className="h-[38px] shrink-0" aria-hidden="true"/><Header/><main className="flex-1"><Product/></main><Footer/></div></Router>);`;
  await build({
    stdin: { contents: entry, loader: 'tsx', resolveDir: site },
    absWorkingDir: site, bundle: true, format: 'esm', platform: 'browser',
    jsx: 'automatic', target: 'es2022', minify: true,
    outfile: path.join(assets, `${key}-model.js`),
    define: { 'import.meta.env.BASE_URL': JSON.stringify(siteBase), 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'upsell-template-sandbox', setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => ({ path: path.join(site, 'src', args.path.slice(2)), namespace: 'source-alias' }));
        b.onLoad({ filter: /.*/, namespace: 'source-alias' }, (args) => {
          const file = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'].map((ext) => args.path + ext).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
          if (!file) throw new Error(`Missing template import ${args.path}`);
          const rel = file.replace(/\\/g, '/');
          let code = fs.readFileSync(file, 'utf8');
          // O carrinho da SPA não é usado: a compra vai pro checkout externo do pincel.
          if (rel.endsWith('hooks/use-cart.tsx')) code = 'export function useCart(){return {items:[],itemCount:0,total:0,addItem(){},removeItem(){},updateQuantity(){},clearCart(){}}}';
          else if (rel.endsWith('lib/data.ts') && !market) {
            const item = {
              id: `bella-${product.id}`, slug: product.slug, name: product.name,
              price: product.bella.price, pixPrice: product.price, installment: product.bella.installment ?? product.installment,
              rating: product.bella.rating, reviewCount: product.bella.reviewCount, soldCount: product.bella.soldCount,
              originalPrice: product.bella.originalPrice, badge: product.bella.badge,
              description: product.description, mainImage: photos[0], gallery: photos,
              features: product.features,
              productReviews: product.reviews.map((r, i) => ({
                id: i + 1, author: r.name, name: r.name, initials: initials(r.name),
                rating: 5, text: r.text, photo: photos[(r.photos[0] - 1) % photos.length],
                photos: r.photos.map((n) => photos[(n - 1) % photos.length]),
              })),
            };
            code = code.replace('export const products: Product[] = [', 'export const products: Product[] = [' + JSON.stringify(item) + ',');
          }
          else if (rel.endsWith('lib/utils.ts')) code = code.replace('`${import.meta.env.BASE_URL}${path.startsWith', 'path.startsWith("/upsell-assets/") ? path : `${import.meta.env.BASE_URL}${path.startsWith');
          else if (rel.endsWith('lib/img.ts')) code = code.replace('return `${', 'if(path.startsWith("/upsell-assets/"))return path;return `${');
          else if (rel.endsWith('pages/product-page.tsx') && market) code = marketTemplate(code, product, photos, videos);
          else if (rel.endsWith('pages/product.tsx') && !market) {
            code = code.replace('const product = products.find(p => p.slug === slug);', 'const product = products[0];');
            code = code.replace(/  const handleBuyNow = \(\) => \{[\s\S]*?\n  \};/,
              `  const handleBuyNow = () => { fireAddToCart(quantity); window.location.assign(${JSON.stringify(product.checkoutUrl)}); };`);
            code = code.replace(/  const handleAddToCart = \(e: React.MouseEvent<HTMLButtonElement>\) => \{[\s\S]*?\n  \};/,
              `  const handleAddToCart = () => { fireAddToCart(quantity); window.location.assign(${JSON.stringify(product.checkoutUrl)}); };`);
          }
          return { contents: code, loader: file.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file) };
        });
      },
    }],
  });
  // Head e body 100% iguais ao site original (fontes, pixels, meta): só troca
  // o entry point, o título e marca como noindex.
  let html = distHtml
    .replace(/<script type="module" crossorigin src="[^"]*assets\/index-[^"]*\.js"><\/script>/, `<script type="module" crossorigin src="/upsell-assets/${key}-model.js"></script>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${product.name}${market ? '' : ' | Bella Mix'}</title>`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${product.name} por ${product.priceText}." />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${product.name}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${product.name} por ${product.priceText}." />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${product.name}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${product.name} por ${product.priceText}." />`)
    .replace('<body>', `<body data-theme="${variant}">`);
  if (sprite) html = html.replace('</head>', `<style>${sprite}</style></head>`);
  fs.writeFileSync(path.join(pages, `${key}.txt`), html);
}

/* --------------------------------------------------------- Original (TikTok) */
function buildOriginal(product = PRODUCT, photos = PHOTOS, videos = [], key = 'original', sprite = spriteCss) {
  let original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  original = original
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${product.name} | Oferta</title>`)
    .replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${product.name}</h1>`)
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">');
  if (!original.includes('name="robots"')) original = original.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');
  original = original.replace('<body>', '<body data-theme="original">');
  // Imagens do produto → assets próprios. Avatares de perfil continuam os mesmos.
  let photoIndex = 0, preloadIndex = 0;
  original = original.replace(/src="\/images\/f2\/[^" ]+"/g, () => `src="${photos[photoIndex++ % photos.length]}"`)
    .replace(/href="\/images\/f2\/[^" ]+"/g, () => `href="${photos[preloadIndex++ % photos.length]}"`);
  if (videos.length) {
    // Vídeos reais do produto nos cards de criadores; a thumb é o primeiro
    // frame do próprio vídeo (preload=metadata + #t), formato UGC do original.
    let videoIndex = 0;
    original = original.replace(/data-vid="[^"]*"><img src="\/images\/criadores\/[^" ]+"[^>]*>/g,
      () => {
        const v = videos[videoIndex++ % videos.length];
        return `data-vid="${v}"><video src="${v}#t=0.6" muted playsinline preload="metadata" class="w-full aspect-[9/16] object-cover opacity-95" style="pointer-events:none" tabindex="-1" aria-hidden="true"></video>`;
      })
      .replace('Rotina com a escova', 'Rotina com o produto');
  }
  if (product.reviewCount) {
    // Contagem/nota de avaliações próprias por produto.
    original = original.replaceAll('722 avaliações', `${product.reviewCount} avaliações`)
      .replaceAll('(722)', `(${product.reviewCount})`)
      .replaceAll('>4.6<', `>${product.ratingDisplay ?? '4.8'}<`);
  }
  original = original.replaceAll('gokoco_escova', `gokoco_${product.id}`);
  // Modal de opção: mesma estrutura, uma opção só.
  original = original.replace(/var OPTS=\[[\s\S]*?\];/,
    `var OPTS=[{n:${JSON.stringify(product.name)},l:${JSON.stringify(product.optLabel)},i:'${photos[0]}',out:false,p:${product.price}}];`);
  original = original.replace('id="lv-voltage-section" style="margin-top:18px', 'id="lv-voltage-section" style="display:none;margin-top:18px')
    .replace(`(voltage?' · '+voltage:'')`, `''`)
    .replace(/Cor da escova/g, product.optionLabel).replace(/uma ou mais cores/g, 'uma opção')
    .replace(/uma cor/g, 'uma opção').replace(/Selecione uma cor/g, 'Selecione uma opção')
    .replace(/Selecione a voltagem/g, 'Comprar agora')
    .replace(/'Escova Modeladora GOKOCO \('/g, `'${product.name} ('`)
    .replace(/alt="Escova[^"]*"/g, `alt="${product.name}"`);
  // Checkout real do produto.
  original = original.replace(`lvUrl?window.lvUrl('/pagamento'):'/pagamento'`, `lvUrl?window.lvUrl('${product.checkoutUrl}'):'${product.checkoutUrl}'`)
    .replace(/href="(?:\/pagamento|\/pagamento.html)(?:\?[^" ]*)?"/g, `href="${product.checkoutUrl}"`);
  // Seção "Sobre este produto": mesma estrutura, conteúdo do produto.
  original = original.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g, (section) => {
    if (section.includes('Sobre este produto')) {
      return section
        .replace(/(<div class="mt-2 grid[^>]*>)[\s\S]*?(<\/div><div class="my-3)/,
          `$1${product.specRows.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join('')}$2`)
        .replace(/(<div class="mt-2 text-\[13px\][^>]*>)[\s\S]*?(<\/section>)/,
          `$1<h3 class="text-[14px] font-bold mt-2">${product.name}</h3>${product.hook ? `<p class="mt-2"><strong>${product.hook}</strong></p>` : ''}<p class="mt-2">${product.description}</p>${product.bullets ? `<p class="mt-2">${product.description2}</p>` : ''}<h3 class="text-[13px] font-bold mt-3">Destaques do Produto:</h3>${product.bullets ? product.bullets.map((b) => `<div class="flex gap-1.5"><span class="text-[color:var(--pann-primary)] mt-0.5">•</span><span><strong>${b.k}:</strong> ${b.v}</span></div>`).join('') : product.features.map((f) => '<p class="mt-2">' + f + '</p>').join('')}</div>${product.detailImages ? `<div class="mt-3 flex flex-col gap-2">${product.detailImages.map((src, i) => `<img src="${src}" alt="${product.name} detalhe ${i + 1}" loading="lazy" decoding="async" width="800" height="800" class="w-full h-auto rounded-lg">`).join('')}</div>` : ''}$2`);
    }
    return section;
  });
  // Avaliações: mesma quantidade/estrutura do original, conteúdo do produto.
  let reviewIndex = 0;
  original = original.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g, (article) => {
    const r = product.reviews[reviewIndex++ % product.reviews.length];
    return article
      .replace(/<p\b([^>]*)>[\s\S]*?<\/p>/, `<p$1>${r.text}</p>`)
      .replace(/(<div class="text-sm font-medium">)[\s\S]*?(<\/div>)/, `$1${r.name}$2`);
  });
  // Textos de produto/preço — o resto (contagens, badges, timers) fica igual.
  const priceNum = product.price.toFixed(2).replace('.', ',');
  for (const [from, to] of [
    ['Escova Modeladora GOKOCO Alisa e Modela 3 em 1 Íons Negativos 9 Níveis de Temperatura', product.name],
    ['Escova Modeladora GOKOCO 3 em 1', product.name],
    ['Escova Modeladora GOKOCO', product.name],
    ['R$ 37,90', product.priceText], ['37,90', priceNum], ['37.90', product.price.toFixed(2)], ['>37<', `>${Math.trunc(product.price)}<`],
  ]) original = original.split(from).join(to);
  original = original.replace(/(<p\b[^>]*>)(?:(?!<\/p>)[\s\S])*Escolha a cor[\s\S]*?<\/p>/g,
    '$1Escolha a opção e a quantidade ao clicar em Comprar Agora.</p>');
  if (sprite) original = original.replace('</head>', `<style>${sprite}</style></head>`);
  fs.writeFileSync(path.join(pages, `${key}.txt`), original);
}

/* ------------------------------------------------------- Checkout do pincel */
function buildPagamento(product = PRODUCT, gallery = PHOTOS, filename = 'pagamento', next = '/upsell3', offer = undefined) {
  const PRODUCT = product;
  const photos = gallery;
  let pag = fs.readFileSync(path.join(root, 'pagamento.html'), 'utf8');
  pag = pag.replace(/Escova Modeladora\)\/i/, `${PRODUCT.matchLabel})/i`);
  for (const [from, to] of [
    ['var UNIT = 37.90', `var UNIT = ${PRODUCT.price}`],
    [`localStorage.setItem('precoUnit','37.90')`, `localStorage.setItem('precoUnit','${PRODUCT.price}')`],
    ['v=37.90', `v=${PRODUCT.price}`],
    ['getAmount()||37.90', `getAmount()||${PRODUCT.price}`],
    ['R$&nbsp;37,90', `R$&nbsp;29,90`],
    ['R$ 37,90', PRODUCT.priceText],
    ['37,90', '29,90'], ['37.90', '29.90'], ['>37<', '>29<'],
    ['Escova Modeladora GOKOCO 3 em 1', PRODUCT.name],
    ['Escova Modeladora GOKOCO', PRODUCT.name],
    ['/images/f2/potes-1.webp', photos[0]],
    [`de:'R$ 129,90'`, `de:'${PRODUCT.oldPriceText}'`],
    ['Realizei o pagamento da minha compra da escova GOKOCO', `Realizei o pagamento da minha compra do ${PRODUCT.name}`],
    [`localStorage.setItem('voltagemSelecionada','Bivolt')`, `localStorage.setItem('voltagemSelecionada','')`],
  ]) pag = pag.split(from).join(to);
  // Carrinho do pincel: sem cores, marcado como produto próprio pro cartTotal.
  pag = pag.replace('return {qty:order.qty||1,colors:colors,', `return {product:'${PRODUCT.id}',qty:order.qty||1,colors:[],`);
  // Semeia a seleção do produto caso o cliente caia direto no checkout.
  pag = pag.replace('</head>', `<meta name="robots" content="noindex,nofollow"><style>${spriteCss}</style></head>`)
    .replace('<body>', `<body data-theme="checkout"><script>try{localStorage.setItem('corSelecionada',${JSON.stringify(PRODUCT.name)});localStorage.setItem('corImagem',${JSON.stringify(photos[0])});localStorage.setItem('coresSelecionadas','[]');}catch(e){}<\/script>`);
  if (offer !== undefined) {
    // Card de oferta pós-pagamento: produto seguinte do funil (ou nenhum).
    pag = pag.replace(/var LV_OFFER=\{[^;]*\};?/, `var LV_OFFER=${offer ? JSON.stringify(offer) : 'null'};`);
  }
  if (filename !== 'pagamento') {
    // The original template has legacy fixed-price substitutions above.
    pag = pag.replaceAll('29.90', PRODUCT.price.toFixed(2)).replaceAll('29,90', PRODUCT.price.toFixed(2).replace('.', ','))
      .replaceAll('/upsell3', next).replaceAll('lv_checkout_id', `lv_checkout_${PRODUCT.id}`)
      .replaceAll('Escova Modeladora GOKOCO', PRODUCT.name)
      .replaceAll('Garantia 12 meses', 'Confira as condições da loja')
      .replaceAll('Cor: ', 'Opção: ');
    // A direct checkout visit must not inherit the quantity of the main order.
    pag = pag.replace('<body data-theme="checkout">', `<body data-theme="checkout"><script>try{localStorage.setItem('qtdSelecionada','1');sessionStorage.removeItem('lv_disc');}catch(e){}<\/script>`);
  }
  fs.writeFileSync(path.join(pages, `${filename}.txt`), pag);
}

buildOriginal();
buildPagamento(PRODUCT, PHOTOS, 'pagamento', '/upsell2', offerFor('popozuda'));
await bundleVariant('tl');
await bundleVariant('bella');
await buildKalodataUpsells({ root, output, buildCheckout: buildPagamento, buildOriginal, bundleVariant });
console.log('Upsells gerados idênticos aos sites originais, com checkout PIX real do pincel.');
