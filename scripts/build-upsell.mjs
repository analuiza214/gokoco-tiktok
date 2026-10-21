import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

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
const photos = photoNames.map((name) => `/upsell-assets/${name}.svg`);
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
function marketTemplate(source) {
  source = replaceBetween(source, 'const BRUSH_COLORS = [', '] as const;',
    `const BRUSH_COLORS = [{name:'${PRODUCT.variant.name}',file:'${PRODUCT.variant.file}',swatch:'${PRODUCT.variant.swatch}'}`);
  source = replaceBetween(source, 'function answerProductQuestion(', '\nexport default function',
    `function answerProductQuestion(question: string): string { return ${JSON.stringify(PRODUCT.description)} }\n`);
  // Compra sai da SPA e vai pro checkout PIX compartilhado do pincel.
  source = replaceFunction(source, 'handleFinalizarCompra',
    `setShowCart(false); window.location.assign(${JSON.stringify(PRODUCT.checkoutUrl)});`);
  source = replaceBetween(source, '  const slides: SlideItem[] = [', '\n  function goToSlide',
    `  const slides: SlideItem[] = ${JSON.stringify(photos.map((src) => ({ type: 'image', src })))};\n`);
  source = source.replace(/const reviewPhotos = .*?;/,
    `const reviewPhotos = ${JSON.stringify(photos)};`);
  // Mesma quantidade de avaliações do template original — só muda o conteúdo.
  const reviews = PRODUCT.reviews.map((r) => ({ name: r.name, initials: initials(r.name), text: r.text, photos: r.photos }));
  source = replaceBetween(source, '  const brushReviews = [', '\n  const reviewHelpfulCounts',
    `  const brushReviews = ${JSON.stringify(reviews)};\n`);
  const faqCount = (source.match(/question:/g) || []).length;
  const faqs = Array.from({ length: faqCount }, (_, i) => PRODUCT.faq[i % PRODUCT.faq.length]);
  source = replaceBetween(source, '  const commonQuestions = [', '\n  return (',
    `  const commonQuestions = ${JSON.stringify(faqs)};`);
  source = replaceBetween(source, "            ['Produto',", '          ].map(([k, v]',
    `            ${PRODUCT.specRows.map((x) => JSON.stringify(x)).join(',\n')},\n`);
  source = replaceBetween(source, '          A Escova Modeladora GOKOCO 3 em 1 alisa', '\n        </p>', '          ' + PRODUCT.description);
  source = replaceBetween(source, '          O kit inclui escova modeladora', '\n        </p>', '          ' + PRODUCT.description2);
  source = replaceBetween(source, "            'Produto: 1 Escova Modeladora", '          ].map((item)',
    `            ${PRODUCT.features.map((x) => JSON.stringify(x)).join(',\n')},\n`);
  source = source.replace(/img\(`\/images\/escova\/cores\/\$\{[^}]+\}[^`]*`\)/g, JSON.stringify(photos[0]));
  source = source.replace(/alt=\{i === 0 \?[\s\S]*?: 'Detalhe da Escova GOKOCO'\}/, `alt="${PRODUCT.name}"`);
  source = source.replaceAll('Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt', PRODUCT.name)
    .replaceAll('Escova Modeladora GOKOCO 3 em 1', PRODUCT.name)
    .replaceAll('R$ 37,90', PRODUCT.priceText).replaceAll('37.90', String(PRODUCT.price))
    .replaceAll('>37<', '>29<').replaceAll('5x R$ 7,58 sem juros', PRODUCT.installment)
    .replaceAll('1º em Álbuns Copa do Mundo', '1º em Pincéis e Acessórios')
    .replaceAll('Pergunte sobre a escova', 'Pergunte sobre o kit')
    .replaceAll('Ex.: A escova é bivolt?', 'Ex.: Quantos pincéis vêm no kit?')
    .replaceAll('Escolha a cor da escova', 'Escolha a opção do kit')
    .replaceAll('Cor da escova', 'Opção do kit').replaceAll('>Cor:', '>Opção:')
    .replaceAll('gokoco_escova', 'gokoco_pincel');
  return source;
}

/* ----------------------------------------------- Bundles TL + Bella (React) --- */
async function bundleVariant(variant) {
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
    outfile: path.join(assets, `${variant}-model.js`),
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
            const pincel = {
              id: 'bella-pincel', slug: 'kit-pinceis-profissional', name: PRODUCT.name,
              price: 32.90, pixPrice: PRODUCT.price, installment: PRODUCT.installment,
              rating: 4.9, reviewCount: 582, soldCount: '693 vendidos',
              description: PRODUCT.description, mainImage: photos[0], gallery: photos,
              features: PRODUCT.features,
              productReviews: PRODUCT.reviews.map((r, i) => ({
                id: i + 1, author: r.name, name: r.name, initials: initials(r.name),
                rating: 5, text: r.text, photo: photos[(r.photos[0] - 1) % photos.length],
                photos: r.photos.map((n) => photos[(n - 1) % photos.length]),
              })),
            };
            code = code.replace('export const products: Product[] = [', 'export const products: Product[] = [' + JSON.stringify(pincel) + ',');
          }
          else if (rel.endsWith('lib/utils.ts')) code = code.replace('`${import.meta.env.BASE_URL}${path.startsWith', 'path.startsWith("/upsell-assets/") ? path : `${import.meta.env.BASE_URL}${path.startsWith');
          else if (rel.endsWith('lib/img.ts')) code = code.replace('return `${', 'if(path.startsWith("/upsell-assets/"))return path;return `${');
          else if (rel.endsWith('pages/product-page.tsx') && market) code = marketTemplate(code);
          else if (rel.endsWith('pages/product.tsx') && !market) {
            code = code.replace('const product = products.find(p => p.slug === slug);', 'const product = products[0];');
            code = code.replace(/  const handleBuyNow = \(\) => \{[\s\S]*?\n  \};/,
              `  const handleBuyNow = () => { fireAddToCart(quantity); window.location.assign(${JSON.stringify(PRODUCT.checkoutUrl)}); };`);
            code = code.replace(/  const handleAddToCart = \(e: React.MouseEvent<HTMLButtonElement>\) => \{[\s\S]*?\n  \};/,
              `  const handleAddToCart = () => { fireAddToCart(quantity); window.location.assign(${JSON.stringify(PRODUCT.checkoutUrl)}); };`);
          }
          return { contents: code, loader: file.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file) };
        });
      },
    }],
  });
  // Head e body 100% iguais ao site original (fontes, pixels, meta): só troca
  // o entry point, o título e marca como noindex.
  let html = distHtml
    .replace(/<script type="module" crossorigin src="[^"]*assets\/index-[^"]*\.js"><\/script>/, `<script type="module" crossorigin src="/upsell-assets/${variant}-model.js"></script>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${PRODUCT.name}${market ? '' : ' | Bella Mix'}</title>`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${PRODUCT.name} por ${PRODUCT.priceText}." />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${PRODUCT.name}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${PRODUCT.name} por ${PRODUCT.priceText}." />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${PRODUCT.name}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${PRODUCT.name} por ${PRODUCT.priceText}." />`)
    .replace('<body>', `<body data-theme="${variant}">`)
    .replace('</head>', `<style>${spriteCss}</style></head>`);
  fs.writeFileSync(path.join(pages, `${market ? 'tl' : 'bella'}.txt`), html);
}

/* --------------------------------------------------------- Original (TikTok) */
function buildOriginal() {
  let original = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  original = original
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${PRODUCT.name} | Oferta</title>`)
    .replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${PRODUCT.name}</h1>`)
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">');
  if (!original.includes('name="robots"')) original = original.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');
  original = original.replace('<body>', '<body data-theme="original">');
  // Imagens do produto → assets do pincel (sprites já inseridos pelo Codex).
  // Avatares de perfil e thumbs dos vídeos continuam os mesmos do site original.
  let photoIndex = 0;
  original = original.replace(/src="\/images\/f2\/[^" ]+"/g, () => `src="${photos[photoIndex++ % photos.length]}"`);
  // Modal de opção: mesma estrutura, uma opção só (variantes reais vêm depois).
  original = original.replace(/var OPTS=\[[\s\S]*?\];/,
    `var OPTS=[{n:${JSON.stringify(PRODUCT.name)},l:'KIT COMPLETO',i:'${photos[0]}',out:false,p:${PRODUCT.price}}];`);
  original = original.replace('id="lv-voltage-section" style="margin-top:18px', 'id="lv-voltage-section" style="display:none;margin-top:18px')
    .replace(`(voltage?' · '+voltage:'')`, `''`)
    .replace(/Cor da escova/g, 'Opção do kit').replace(/uma ou mais cores/g, 'uma opção')
    .replace(/uma cor/g, 'uma opção').replace(/Selecione uma cor/g, 'Selecione uma opção')
    .replace(/Selecione a voltagem/g, 'Comprar agora')
    .replace(/'Escova Modeladora GOKOCO \('/g, `'${PRODUCT.name} ('`)
    .replace(/alt="Escova[^"]*"/g, `alt="${PRODUCT.name}"`);
  // Checkout real do pincel.
  original = original.replace(`lvUrl?window.lvUrl('/pagamento'):'/pagamento'`, `lvUrl?window.lvUrl('${PRODUCT.checkoutUrl}'):'${PRODUCT.checkoutUrl}'`)
    .replace(/href="(?:\/pagamento|\/pagamento.html)(?:\?[^" ]*)?"/g, `href="${PRODUCT.checkoutUrl}"`);
  // Seção "Sobre este produto": mesma estrutura, conteúdo do pincel.
  original = original.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g, (section) => {
    if (section.includes('Sobre este produto')) {
      return section
        .replace(/(<div class="mt-2 grid[^>]*>)[\s\S]*?(<\/div><div class="my-3)/,
          `$1${PRODUCT.specRows.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join('')}$2`)
        .replace(/(<div class="mt-2 text-\[13px\][^>]*>)[\s\S]*?(<\/section>)/,
          `$1<h3 class="text-[14px] font-bold mt-2">${PRODUCT.name}</h3><p class="mt-2">${PRODUCT.description}</p><h3 class="text-[13px] font-bold mt-3">Destaques do Produto:</h3>${PRODUCT.features.map((f) => '<p class="mt-2">' + f + '</p>').join('')}</div>$2`);
    }
    return section;
  });
  // Avaliações: mesma quantidade/estrutura do original, conteúdo do pincel.
  let reviewIndex = 0;
  original = original.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g, (article) => {
    const r = PRODUCT.reviews[reviewIndex++ % PRODUCT.reviews.length];
    return article
      .replace(/<p\b([^>]*)>[\s\S]*?<\/p>/, `<p$1>${r.text}</p>`)
      .replace(/(<div class="text-sm font-medium">)[\s\S]*?(<\/div>)/, `$1${r.name}$2`);
  });
  // Textos de produto/preço — o resto (contagens, badges, timers) fica igual.
  for (const [from, to] of [
    ['Escova Modeladora GOKOCO Alisa e Modela 3 em 1 Íons Negativos 9 Níveis de Temperatura', PRODUCT.name],
    ['Escova Modeladora GOKOCO 3 em 1', PRODUCT.name],
    ['Escova Modeladora GOKOCO', PRODUCT.name],
    ['R$ 37,90', PRODUCT.priceText], ['37,90', '29,90'], ['37.90', '29.90'], ['>37<', '>29<'],
  ]) original = original.split(from).join(to);
  original = original.replace(/(<p\b[^>]*>)(?:(?!<\/p>)[\s\S])*Escolha a cor[\s\S]*?<\/p>/g,
    '$1Escolha a opção e a quantidade ao clicar em Comprar Agora.</p>');
  original = original.replace('</head>', `<style>${spriteCss}</style></head>`);
  fs.writeFileSync(path.join(pages, 'original.txt'), original);
}

/* ------------------------------------------------------- Checkout do pincel */
function buildPagamento() {
  let pag = fs.readFileSync(path.join(root, 'pagamento.html'), 'utf8');
  pag = pag.replace(/Escova Modeladora\)\/i/, 'Pincéis)/i');
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
  fs.writeFileSync(path.join(pages, 'pagamento.txt'), pag);
}

buildOriginal();
buildPagamento();
await bundleVariant('tl');
await bundleVariant('bella');
console.log('Upsells gerados idênticos aos sites originais, com checkout PIX real do pincel.');
