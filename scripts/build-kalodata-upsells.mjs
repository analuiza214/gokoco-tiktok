import fs from 'node:fs';
import path from 'node:path';
import { upsellCatalog } from '../worker-src/upsell-catalog.js';
import { renderStorefront } from './storefront.mjs';

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const regexEscape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const themes = [
  { id: 'original', prefix: '', name: 'GOKOCO', subtitle: 'BELEZA & CUIDADO', accent: '#fe2c55', background: '#fafafa', header: '#fff', ink: '#161823' },
  { id: 'tl', prefix: '/tl', name: 'TL', subtitle: 'SUA ROTINA DE BELEZA', accent: '#3483fa', background: '#f5f5f5', header: '#ffe600', ink: '#222' },
  { id: 'bella', prefix: '/video', name: 'Bella Mix', subtitle: 'BRASIL', accent: '#9a355d', background: '#fcf9f8', header: '#fff', ink: '#382632' },
];

// Avaliações genéricas (aprovado pelo Wellington): os depoimentos reais do
// Kalodata são bloqueados; os slots originais de avaliação recebem estes textos.
const GENERIC_REVIEWS = [
  { name: 'Mariana Costa', text: 'Chegou antes do prazo, bem embalado. Usei e aprovei, produto de ótima qualidade.', photos: [1] },
  { name: 'Fernanda Alves', text: 'Produto original, igual ao anúncio. Já é a segunda vez que compro nessa loja.', photos: [2] },
  { name: 'Juliana Santos', text: 'Estou usando todos os dias na minha rotina. Notei diferença já na primeira semana.', photos: [3] },
  { name: 'Camila Rodrigues', text: 'Pelo preço achei que viria simples, mas me surpreendi com a qualidade da embalagem e do produto.', photos: [4] },
  { name: 'Patrícia Mendes', text: 'Comprei de presente e a pessoa amou. Chegou certinho e dentro do prazo.', photos: [1] },
  { name: 'Larissa Oliveira', text: 'Textura e cheiro muito bons. Dá pra ver que é produto de verdade, recomendo.', photos: [2] },
  { name: 'Beatriz Ferreira', text: 'Entrega rápida e tudo certo na caixa. Voltarei a comprar com certeza.', photos: [3] },
  { name: 'Ana Paula Souza', text: 'Rende bastante, usando com moderação já dura semanas. Vale o investimento.', photos: [4] },
];

// Copy própria por produto (versão original/TikTok): gancho em negrito,
// segundo parágrafo e destaques em bullets "título: benefício".
const PRODUCT_COPY = {
  'popozuda': {
    hook: 'Curvas modeladas e pele firme com uma rotina simples de cuidado diário.',
    description2: 'Textura leve de rápida absorção, sem sensação pegajosa. Conteúdo: 1 frasco de 200g, produto original e lacrado.',
    bullets: [
      ['Efeito modelador', 'ajuda a desenhar a silhueta e valorizar as curvas com o uso contínuo.'],
      ['Hidratação profunda', 'deixa a pele macia e com toque aveludado desde a primeira aplicação.'],
      ['Absorção rápida', 'textura leve que não deixa a pele oleosa nem mancha a roupa.'],
      ['Rende bastante', 'frasco de 200g para várias semanas de uso diário.'],
      ['Fácil de usar', 'aplicar com massagem circular até absorver, de manhã ou à noite.'],
    ],
  },
  'liso-obrigatorio': {
    hook: 'Liso prolongado e fios alinhados com tratamento completo em 3 etapas.',
    description2: 'Kit profissional com 3 itens da linha Liso Obrigatório e óleo ativador de escova. Produto original e lacrado.',
    bullets: [
      ['Liso por mais tempo', 'fórmula que mantém o cabelo alinhado e sem frizz por dias.'],
      ['Redução de volume', 'fios comportados e com caimento desde as primeiras aplicações.'],
      ['Óleo ativador incluso', 'potencializa a escova e dá brilho espelhado ao liso.'],
      ['Kit completo de 1L', 'rende muitas aplicações, ideal para uso contínuo.'],
      ['Todos os tipos de cabelo', 'do fio ondulado ao mais volumoso.'],
    ],
  },
  'ultra-bond': {
    hook: 'Reconstrução intensa que devolve força e vida aos cabelos danificados.',
    description2: 'Kit completo Eudora Siàge Ultra Bond Reset com 4 itens para a rotina de cuidados capilares. Produto original e lacrado.',
    bullets: [
      ['Reconstrução profunda', 'repara a fibra capilar de dentro para fora.'],
      ['Fios mais fortes', 'reduz quebra e pontas duplas com o uso contínuo.'],
      ['Ideal pós-química', 'recupera cabelos fragilizados por coloração e alisamento.'],
      ['Kit com 4 itens', 'rotina completa de tratamento em uma só caixa.'],
      ['Brilho e maciez', 'fios saudáveis, soltos e com movimento.'],
    ],
  },
  'pro-cronology': {
    hook: 'Limpeza e tratamento diário que deixam o cabelo macio e cheio de brilho.',
    description2: 'Kit Eudora Siàge Pro Cronology com shampoo de 250ml e condicionador de 200ml. Produto original e lacrado.',
    bullets: [
      ['Limpeza suave', 'shampoo que limpa sem ressecar os fios.'],
      ['Condicionamento imediato', 'desembaraço fácil e maciez já no banho.'],
      ['Brilho diário', 'fios luminosos e alinhados todos os dias.'],
      ['Rotina completa', 'shampoo e condicionador no mesmo kit.'],
      ['Perfume de salão', 'fragrância Siàge que permanece no cabelo.'],
    ],
  },
  'principia-glow': {
    hook: 'Rotina completa de skincare para uma pele uniforme, hidratada e iluminada.',
    description2: 'Kit Principia Essencial Glow com os produtos GL-02, CH, VC e PS. Produto original e lacrado.',
    bullets: [
      ['Vitamina C', 'ilumina e uniformiza o tom da pele.'],
      ['Hidratação intensa', 'pele macia e viçosa o dia todo.'],
      ['Efeito glow', 'viço e luminosidade naturais com o uso contínuo.'],
      ['Kit completo', 'GL-02, CH, VC e PS: a rotina facial inteira em um kit.'],
      ['Textura leve', 'absorve rápido e funciona bem sob maquiagem e protetor.'],
    ],
  },
};

// Contagem de avaliações por produto: estável por build, sempre entre 600 e 800.
const reviewCountFor = p => 600 + (([...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) + p.step * 37) % 201);

const genericFaq = p => [
  { question: 'O que vem na embalagem?', answer: `${p.contents}. Confira as imagens do anúncio.` },
  { question: 'O produto é original?', answer: 'Sim, produto original e lacrado, conforme as fotos do anúncio.' },
  { question: 'Como uso o produto?', answer: 'Siga o modo de uso e as precauções do fabricante no rótulo.' },
  { question: 'Como faço para comprar?', answer: 'Clique em Comprar, preencha seus dados e finalize com PIX.' },
  { question: 'Qual o prazo de entrega?', answer: 'Após a confirmação do pagamento você recebe o código de rastreio para acompanhar tudo.' },
  { question: 'E se chegar com defeito?', answer: 'Você pode trocar seguindo a política de devolução do site.' },
];

// Card exibido na confirmação do checkout anterior: o próximo produto do funil.
// href usa o literal do template ('/upsell3') — a cadeia de replaces ajusta por tema.
export function offerFor(productId) {
  const p = upsellCatalog.find(q => q.id === productId);
  if (!p) return null;
  const cfg = productConfig(p, 1);
  const deV = Math.ceil(p.price * 1.5) - 0.1;
  return { name: p.name, img: `/upsell-assets/kalodata/${p.id}/Imagens/01-principal.png`, de: cfg.oldPriceText, por: cfg.priceText, deV, porV: p.price, href: '/upsell3' };
}

// Mesma forma do PRODUCT do build-upsell.mjs, preenchida a partir do catálogo.
function productConfig(p, imageCount) {
  const cardPrice = Math.ceil(p.price * 1.1) - 0.1;
  const oldPrice = Math.ceil(p.price * 1.5) - 0.1;
  const ratingText = p.rating.toFixed(1).replace('.', ',');
  const copy = PRODUCT_COPY[p.id];
  return {
    id: p.id,
    name: p.name,
    slug: p.id,
    price: p.price,
    priceText: money(p.price),
    oldPriceText: money(oldPrice),
    installment: `5x ${money(p.price / 5)} sem juros`,
    checkoutUrl: `/pagamento-${p.id}`,
    description: p.description,
    description2: copy.description2,
    hook: copy.hook,
    bullets: copy.bullets.map(([k, v]) => ({ k, v })),
    reviewCount: reviewCountFor(p),
    ratingDisplay: '4.8',
    features: [
      `Produto: ${p.name}`,
      `Conteúdo: ${p.contents}`,
      `Categoria: ${p.category}`,
      `Nota na fonte consultada: ${ratingText} de 5`,
    ],
    specRows: [
      ['Produto', p.name],
      ['Conteúdo', p.contents],
      ['Categoria', p.category],
      ['Nota na fonte', `${ratingText} de 5 (Kalodata, 22/10/2026)`],
      ['Pagamento', 'PIX'],
      ['Garantia', 'Conforme política do site'],
    ],
    variant: { name: p.contents, file: 'hero.svg', swatch: '#e5e0d8' },
    optLabel: p.contents.toUpperCase(),
    optionLabel: 'Opção',
    optionPhrase: 'a opção',
    optionShort: 'Opção',
    askAbout: 'o produto',
    exampleQuestion: 'Ex.: O que vem na embalagem?',
    rankBadge: `1º em ${p.category}`,
    matchLabel: regexEscape(p.name.split(' ')[0]),
    faq: genericFaq(p),
    reviews: GENERIC_REVIEWS.map(r => ({ ...r, photos: r.photos.map(n => ((n - 1) % imageCount) + 1) })),
    bella: {
      price: cardPrice,
      rating: p.rating,
      reviewCount: reviewCountFor(p),
      soldCount: `${250 + p.step * 83} vendidos`,
      originalPrice: oldPrice,
      badge: 'Complemento opcional',
      installment: `5x ${money(cardPrice / 5)} sem juros`,
    },
  };
}

export async function buildKalodataUpsells({ root, output, buildCheckout, buildOriginal, bundleVariant }) {
  const storefrontProducts = [];
  const assets = path.join(output, 'upsell-assets');
  const pages = path.join(output, 'upsell-pages');
  const materialRoot = path.resolve(root, '../..', 'Produtos Kalodata');
  const sourceRoot = path.join(root, 'rascunhos-upsell', 'kalodata');
  fs.mkdirSync(sourceRoot, { recursive: true });
  // Import once into the repository. Subsequent builds work without the desktop source.
  for (const p of upsellCatalog) {
    const target = path.join(sourceRoot, p.id);
    if (!fs.existsSync(target)) {
      const source = path.join(materialRoot, p.folder);
      if (!fs.existsSync(source)) throw new Error(`Materiais ausentes para ${p.id}`);
      fs.cpSync(source, target, { recursive: true });
    }
    fs.cpSync(target, path.join(assets, 'kalodata', p.id), { recursive: true });
    const files = kind => fs.readdirSync(path.join(target, kind)).filter(file => kind === 'Imagens' ? /\.(png|webp|jpe?g)$/i.test(file) : /\.mp4$/i.test(file)).sort((a, b) => a === '01-principal.png' ? -1 : b === '01-principal.png' ? 1 : a.localeCompare(b));
    const url = kind => files(kind).map(file => `/upsell-assets/kalodata/${p.id}/${kind}/${file}`);
    const images = url('Imagens'), videos = url('Videos');
    if (!images.length || !videos.length) throw new Error(`Mídias ausentes: ${p.id}`);
    const product = productConfig(p, images.length);
    storefrontProducts.push({ ...p, images, videos });
    const nextPath = p.step < 6 ? `upsell${p.step + 1}` : 'upsell-concluido';
    for (const theme of themes) {
      const key = `${theme.id}-${p.id}`;
      const cfg = { ...product, checkoutUrl: `${theme.prefix}/pagamento-${p.id}`, detailImages: images.slice(-4) };
      // Mesma cara do site original: TikTok (index.html), Mercado Livre (React)
      // ou Bella Mix (React) — fotos, vídeos, avaliações e checkout do produto.
      if (theme.id === 'original') buildOriginal(cfg, images, videos, key, '');
      else await bundleVariant(theme.id, { product: cfg, photos: images, videos, key, sprite: '' });
      // Continuação do funil: adicionar vai ao checkout próprio; pular segue
      // para a próxima oferta (ou o encerramento), preservando os parâmetros.
      const next = `${theme.prefix}/${nextPath}`;
      const tail = `<div data-upsell-tail style="text-align:center;padding:24px 16px 110px"><a href="${cfg.checkoutUrl}" style="display:inline-block;background:${theme.accent};color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;margin-bottom:10px">Adicionar por ${money(p.price)}</a><p style="font-size:12px;color:#888;margin:4px 0 10px">Complemento opcional — possui pagamento próprio.</p><a href="${next}" style="color:#666;text-decoration:underline;font-size:13px">Continuar sem este produto</a></div><script>document.querySelectorAll('[data-upsell-tail] a').forEach(function(a){var u=new URL(a.href);u.search=location.search;a.href=u.href;});</script>`;
      const file = path.join(pages, `${key}.txt`);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</body>', tail + '</body>'));
      buildCheckout(product, images, `${theme.id}-pagamento-${p.id}`, next, offerFor((upsellCatalog.find(q => q.step === p.step + 1) || {}).id));
    }
  }
  for (const theme of themes) {
    fs.writeFileSync(path.join(pages, `${theme.id}-vitrine.txt`), renderStorefront(storefrontProducts, theme));
    fs.writeFileSync(path.join(pages, `${theme.id}-concluido.txt`), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Suas escolhas | ${theme.name}</title><link rel="stylesheet" href="/upsell-assets/kalodata.css"><body style="--accent:${theme.accent};--background:${theme.background};--header:${theme.header};--ink:${theme.ink}"><header class="store-header"><span class="brand">${theme.name}</span></header><main><section class="last-call"><h1>Você chegou ao fim dos complementos</h1><p>Você pode acompanhar os pedidos com pagamento confirmado na página de rastreio.</p><a class="buy" href="/rastreio.html">Acompanhar meu pedido</a><a class="skip" href="${theme.prefix}/upsell2">Rever os complementos</a></section></main></body></html>`);
  }
  const pincelCheckout = path.join(pages, 'pagamento.txt');
  fs.writeFileSync(pincelCheckout, fs.readFileSync(pincelCheckout, 'utf8').replaceAll('/upsell3', '/upsell2'));
  for (const theme of themes.filter(t => t.prefix)) {
    fs.writeFileSync(path.join(pages, `${theme.id}-pagamento-pincel.txt`), fs.readFileSync(pincelCheckout, 'utf8').replaceAll('/upsell2', `${theme.prefix}/upsell2`));
  }
  // A skip link on the existing offer makes the rest of the sequence reachable.
  for (const theme of themes) {
    const file = path.join(pages, theme.id === 'original' ? 'original.txt' : theme.id === 'tl' ? 'tl.txt' : 'bella.txt');
    const skip = `<div style="text-align:center;padding:20px 16px 100px"><a href="${theme.prefix}/upsell2" style="color:#666;text-decoration:underline">Continuar sem o kit de pincéis</a></div>`;
    let html = fs.readFileSync(file, 'utf8').replace('</body>', skip + '</body>');
    if (theme.prefix) {
      // Existing React bundles contain the checkout destination, so keep it in
      // the current storefront when the browser follows that destination.
      const keepTheme = `<script>document.addEventListener('click',function(event){var link=event.target.closest('a[href="/pagamento-pincel"]');if(link)link.href='${theme.prefix}/pagamento-pincel';},true);</script>`;
      html = html.replace('</body>', keepTheme + '</body>');
      const bundleFile = path.join(assets, `${theme.id}-model.js`);
      fs.writeFileSync(bundleFile, fs.readFileSync(bundleFile, 'utf8').replaceAll('/pagamento-pincel', `${theme.prefix}/pagamento-pincel`));
    }
    fs.writeFileSync(file, html);
  }
  fs.copyFileSync(path.join(root, 'rascunhos-upsell', 'assets', 'kalodata.css'), path.join(assets, 'kalodata.css'));
  fs.copyFileSync(path.join(root, 'rascunhos-upsell', 'assets', 'storefront.css'), path.join(assets, 'storefront.css'));
  console.log('Kalodata: 15 páginas no layout dos sites originais, 15 checkouts e 3 finais gerados.');
}
