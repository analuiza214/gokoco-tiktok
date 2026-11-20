import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const bellaLogoHeader = `<div class="flex items-center gap-2 pl-1"><span class="font-bold text-[17px] tracking-tight text-[#d6336c] flex items-center gap-1.5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d6336c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>Bella Mix</span><span class="inline-flex items-center gap-1 bg-[#fff0f5] text-[#d6336c] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#fbcfe8]"><svg width="10" height="10" viewBox="0 0 24 24" fill="#d6336c"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>OFICIAL</span></div>`;

const bellaModalProtection = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px"><span style="font-weight:800;font-size:18px;color:#d6336c;display:flex;align-items:center;gap:6px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d6336c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>Bella Mix</span><svg width="18" height="18" viewBox="0 0 24 24" fill="#0e9f6e" aria-label="Verificado"><path d="M12 1.5l2.2 2.06 3-.36 1.1 2.83 2.83 1.1-.36 3L22.5 12l-2.06 2.2.36 3-2.83 1.1-1.1 2.83-3-.36L12 22.5l-2.2-2.06-3 .36-1.1-2.83-2.83-1.1.36-3L1.5 12l2.06-2.2-.36-3 2.83-1.1 1.1-2.83 3 .36z"/><path d="M10.6 15.5l-3-3 1.27-1.27 1.73 1.73 4.2-4.2L16.07 10z" fill="#fff"/></svg></div><p style="text-align:center;margin-top:10px;font-size:13.5px;line-height:1.5;color:#475569">Esta loja é 100% verificada com certificado de segurança e a sua compra é totalmente protegida pela Bella Mix Oficial. Qualquer dúvida entre em contato pelo Chat.</p>`;

// 1. Processar index.html -> oferta.html
let ofertaHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Favicon
ofertaHtml = ofertaHtml.replace('/images/favicon-tiktok.png?v=1', '/images/favicon.png');

// Metatags
ofertaHtml = ofertaHtml.replace(
  '<meta property="og:title" content="Lovable App"><meta property="og:description" content="Project Mirror replicates a web application, enabling users to view and interact with its content."><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Lovable App"><meta name="description" content="Project Mirror replicates a web application, enabling users to view and interact with its content."><meta name="twitter:description" content="Project Mirror replicates a web application, enabling users to view and interact with its content.">',
  '<meta property="og:title" content="Escova Modeladora GOKOCO Íons Negativos 9 Temperaturas | Bella Mix"><meta property="og:description" content="Oferta exclusiva da Escova Modeladora GOKOCO Íons Negativos na Loja Oficial Bella Mix. Cabelos lisos, brilhantes e alinhados em minutos."><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Escova Modeladora GOKOCO Íons Negativos 9 Temperaturas | Bella Mix"><meta name="description" content="Oferta exclusiva da Escova Modeladora GOKOCO Íons Negativos na Loja Oficial Bella Mix. Cabelos lisos, brilhantes e alinhados em minutos."><meta name="twitter:description" content="Oferta exclusiva da Escova Modeladora GOKOCO Íons Negativos na Loja Oficial Bella Mix. Cabelos lisos, brilhantes e alinhados em minutos.">'
);
ofertaHtml = ofertaHtml.replaceAll('/images/id-preview-807c3067--04de2700-f792-4574-8810-835d1e24753e.lovable.app-1783021361018.png', '/images/f2/potes-1.webp');

// Substituir TODOS os blocos de logo tiktok no header
const oldHeaderLogoRegex = /<div class="flex items-center gap-1\.5 pl-1"><img src="\/assets\/tiktok-shop-logo-[^"]+" alt="TikTok Shop"[^>]*><img src="data:image\/webp;base64,[^"]+" alt="Verificado"[^>]*><\/div>/g;
ofertaHtml = ofertaHtml.replace(oldHeaderLogoRegex, bellaLogoHeader);

// Garantia
ofertaHtml = ofertaHtml.replace(
  'Essa compra é assegurada pela Bella Mix e TikTokShop.',
  'Essa compra é 100% assegurada pela Bella Mix Oficial.'
);

// Modal proteção
const modalSnippet = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px"><img src="/assets/tiktok-shop-logo-DIvjPbke.png" alt="TikTok Shop" style="height:22px;width:auto;object-fit:contain" loading="lazy">';
const modalStart = ofertaHtml.indexOf(modalSnippet);
if (modalStart !== -1) {
  const modalEnd = ofertaHtml.indexOf('</p>', modalStart);
  ofertaHtml = ofertaHtml.slice(0, modalStart) + bellaModalProtection + ofertaHtml.slice(modalEnd + 4);
}

// Direcionar para checkout limpo
ofertaHtml = ofertaHtml.replaceAll('href="/pagamento"', 'href="/pagamento-oferta"');
ofertaHtml = ofertaHtml.replaceAll("window.lvUrl('/pagamento'):'/pagamento'", "window.lvUrl('/pagamento-oferta'):'/pagamento-oferta'");

// Redução de fricção: Cor Preta pré-definida e botão sempre ativo
ofertaHtml = ofertaHtml.replace(
  '<button type="button" id="lv-color-cta" disabled style="width:100%;border:0;border-radius:10px;padding:12px;font-weight:800;font-size:16px;color:#fff;background:#d5d6d9;line-height:1.2">Selecione uma cor<span style="display:block;font-size:11.5px;font-weight:600;opacity:.9;margin-top:2px">Envio grátis</span></button>',
  '<button type="button" id="lv-color-cta" style="width:100%;border:0;border-radius:10px;padding:12px;font-weight:800;font-size:16px;color:#fff;background:#fe2c55;line-height:1.2">Comprar agora (1 item)<span style="display:block;font-size:11.5px;font-weight:600;opacity:.9;margin-top:2px">Envio grátis</span></button>'
);

// Iniciar com cor preta selecionada
ofertaHtml = ofertaHtml.replace(
  'var QT=OPTS.map(function(){return 0;});',
  'var QT=OPTS.map(function(_, i){return i===0 ? 1 : 0;});'
);

// Atualizar função update para manter botão vivo se desmarcar tudo
const oldUpdateElse = `    }else{
      selLbl.innerHTML='Selecione: <strong style="color:#161823">uma ou mais cores</strong>';
      priceEl.textContent=fmt(PRICE);
      cta.disabled=true;
      cta.style.background='#d5d6d9';
      cta.innerHTML='Selecione uma cor<span style="display:block;font-size:11.5px;font-weight:600;opacity:.9;margin-top:2px">Envio grátis</span>';
    }`;

const newUpdateElse = `    }else{
      thumb.src=OPTS[0].i;
      selLbl.innerHTML='Padrão: <strong style="color:#161823">Preta (1 item)'+(voltage?' · '+voltage:'')+'</strong>';
      priceEl.textContent=fmt(PRICE);
      cta.disabled=false;
      cta.style.background='#fe2c55';
      cta.innerHTML='Comprar agora (1 item)<span style="display:block;font-size:11.5px;font-weight:600;opacity:.9;margin-top:2px">Envio grátis</span>';
    }`;

ofertaHtml = ofertaHtml.replace(oldUpdateElse, newUpdateElse);

// Executar update() logo na inicialização para renderizar a seleção inicial
ofertaHtml = ofertaHtml.replace(
  '  render();\n  function open()',
  '  update();\n  function open()'
);

// Fallback no clique do CTA para garantir preta caso nada esteja marcado
ofertaHtml = ofertaHtml.replace(
  "cta.addEventListener('click',function(){\n    var c=chosen(); if(!c.length||!voltage)return;",
  "cta.addEventListener('click',function(){\n    var c=chosen(); if(!c.length){ QT[0]=1; c=chosen(); } if(!voltage) voltage='Bivolt';"
);

fs.writeFileSync(path.join(root, 'oferta.html'), ofertaHtml, 'utf8');
console.log('oferta.html criado com sucesso!');

// 2. Processar pagamento.html -> pagamento-oferta.html
let pagHtml = fs.readFileSync(path.join(root, 'pagamento.html'), 'utf8');

// Favicon
pagHtml = pagHtml.replace('/images/favicon-tiktok.png?v=1', '/images/favicon.png');

// Metatags
pagHtml = pagHtml.replace(
  '<meta property="og:title" content="Lovable App"/><meta property="og:description" content="Project Mirror replicates a web application, enabling users to view and interact with its content."/><meta property="og:type" content="website"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="Lovable App"/><meta name="description" content="Project Mirror replicates a web application, enabling users to view and interact with its content."/><meta name="twitter:description" content="Project Mirror replicates a web application, enabling users to view and interact with its content."/>',
  '<meta property="og:title" content="Pagamento Seguro | Bella Mix Oficial"/><meta property="og:description" content="Finalização de pedido segura com criptografia SSL na Bella Mix Oficial."/><meta property="og:type" content="website"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="Pagamento Seguro | Bella Mix Oficial"/><meta name="description" content="Finalização de pedido segura com criptografia SSL na Bella Mix Oficial."/><meta name="twitter:description" content="Finalização de pedido segura com criptografia SSL na Bella Mix Oficial;"/>'
);

pagHtml = pagHtml.replaceAll(/https:\/\/pub-bb2e103a32db4e198524a2e9ed8f35b4\.r2\.dev\/[^\s"']+/g, '/images/f2/potes-1.webp');
pagHtml = pagHtml.replaceAll('/images/id-preview-807c3067--04de2700-f792-4574-8810-835d1e24753e.lovable.app-1783021361018.png', '/images/f2/potes-1.webp');

// Header em todos os steps
pagHtml = pagHtml.replaceAll(oldHeaderLogoRegex, bellaLogoHeader);

// Textos de desconto e rodapés
pagHtml = pagHtml.replaceAll('Desconto do TikTok Shop', 'Desconto Promocional Especial');
pagHtml = pagHtml.replaceAll('© 2026 Tiktok Shop', '© 2026 Bella Mix Oficial • Pagamento Seguro SSL');
pagHtml = pagHtml.replaceAll('desconto TikTok', 'desconto especial');
pagHtml = pagHtml.replaceAll('TikTok/Instagram', 'Instagram');

// Rodapé com imagem webp se houver
const footer2Regex = /© 2026 Tiktok Shop<img decoding="async" loading="lazy" src="data:image\/webp;base64,[^"]+" alt="Verificado"[^>]*>/g;
pagHtml = pagHtml.replaceAll(footer2Regex, '© 2026 Bella Mix Oficial • Pagamento Seguro SSL');

fs.writeFileSync(path.join(root, 'pagamento-oferta.html'), pagHtml, 'utf8');
console.log('pagamento-oferta.html criado com sucesso!');
