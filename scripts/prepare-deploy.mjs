import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
const files = ['index.html', 'loja.html', 'pagamento.html', 'rastreio.html', 'admin.html', 'admin.css', 'admin.js', 'favicon.png', '_worker.js'];
const directories = ['assets', 'css', 'images', 'js', 'videos'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
for (const directory of directories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, directory), { recursive: true });
}
const mercadoDist = path.join(root, 'sites', 'mercado', 'dist');
if (!fs.existsSync(path.join(mercadoDist, 'index.html'))) {
  throw new Error('Build da loja Mercado Livre não encontrado.');
}
fs.cpSync(mercadoDist, path.join(output, 'tl'), { recursive: true, filter: (source) => !['_worker.js'].includes(path.basename(source)) });
fs.copyFileSync(path.join(output, 'tl', 'index.html'), path.join(output, 'tl', '__entry.txt'));
const bellaDist = path.join(root, 'sites', 'bella', 'dist', 'public');
if (!fs.existsSync(path.join(bellaDist, 'index.html'))) {
  throw new Error('Build da loja Bella Mix não encontrado.');
}
fs.cpSync(bellaDist, path.join(output, 'video'), { recursive: true, filter: (source) => path.basename(source) !== '_worker.js' });
fs.copyFileSync(path.join(output, 'video', 'index.html'), path.join(output, 'video', '__entry.txt'));
// Standalone demos: no links or redirects are added to the checkout.
const upsellSource = path.join(root, 'rascunhos-upsell');
const upsellPages = path.join(output, 'upsell-pages');
fs.mkdirSync(upsellPages, { recursive: true });
fs.cpSync(path.join(upsellSource, 'assets'), path.join(output, 'upsell-assets'), { recursive: true });
for (const variant of ['original', 'bella', 'tl']) {
  const html = fs.readFileSync(path.join(upsellSource, variant + '.html'), 'utf8')
    .replaceAll('href="assets/', 'href="/upsell-assets/')
    .replaceAll('src="assets/', 'src="/upsell-assets/');
  fs.writeFileSync(path.join(upsellPages, variant + '.txt'), html);
}
const upsellScriptPath = path.join(output, 'upsell-assets', 'app.js');
const upsellScript = fs.readFileSync(upsellScriptPath, 'utf8')
  .replace('href="'+String.fromCharCode(36)+'{key}.html"', 'href="'+String.fromCharCode(36)+'{({original:"/upsell1",bella:"/video/upsell1",tl:"/tl/upsell1"})[key]}"');
fs.writeFileSync(upsellScriptPath, upsellScript);
console.log(`Assets de publicação preparados em ${output}`);
