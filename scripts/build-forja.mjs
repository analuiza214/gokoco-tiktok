import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'sites/forja');
const output = path.join(root, 'dist/forja');
fs.mkdirSync(output, { recursive: true });

export function transformForja(text, sku = 'kit') {
  return text
    .replace(/((?:src|href)=["'])(?=(?:css|js|assets|images|uploads|videos)\/)/g, '$1/forja/')
    .replace(/(["'`(=])\/(?!\/)(?=(?:assets|css|images|js|videos|uploads|produtos|checkout|api|pagamento|loja|rastreio|favicon|catalogo-forja|upsell1)(?:[\/.?#"'`\s)]|$))/g, '$1/forja/')
    .replace(/((?:href=|location\.href\s*=\s*)["'])\/(?=["'])/g, '$1/forja/')
    .replaceAll('/forja/upsell1', '/forja/loja.html')
    .replace(/(["'])(lv_[a-zA-Z0-9_]+|coresSelecionadas|corSelecionada|corImagem|precoUnit|qtdSelecionada|voltagemSelecionada|dadosCliente|forjaProductId|dadosEndereco|dadosPessoais|freteEscolhido|lastPixOrder|lastPixTx|lastPixTxAt|lvPixNext|pedidoResumo|pixPaid_|produtoComprado|upsellRedirect_)\1/g, (match, quote, key) => `${quote}forja_${key}${key === 'lv_checkout_id' || key === 'lv_pix_cache' ? '_' + sku : ''}${quote}`)
    .replace(/((?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*)(["'])(?!forja_)([^"']+)\2/g, '$1$2forja_$3$2');
}

function copyDirectory(directory, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const input = path.join(directory, entry.name);
    const dest = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(input, dest);
    else if (/\.(html|css|js|json)$/.test(entry.name)) {
      const sku = directory.endsWith('checkout') ? path.basename(entry.name, '.html') : 'kit';
      const content = transformForja(fs.readFileSync(input, 'utf8'), sku);
      fs.writeFileSync(dest, content);
      if (entry.name.endsWith('.html')) fs.writeFileSync(dest.slice(0, -5) + '.txt', content);
    } else fs.copyFileSync(input, dest);
  }
}
copyDirectory(source, output);
// O rastreio usa o mesmo fluxo já validado do painel central.
const tracking = transformForja(fs.readFileSync(path.join(root, 'rastreio.html'), 'utf8')
  .replaceAll('GOKOCO', 'Forja Ferramentas').replaceAll('escova modeladora', 'kit de ferramentas'));
fs.writeFileSync(path.join(output, 'rastreio.html'), tracking);
fs.writeFileSync(path.join(output, 'rastreio.txt'), tracking);
console.log('Loja Forja preparada em /forja com carrinho independente.');
