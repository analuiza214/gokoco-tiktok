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
console.log(`Assets de publicação preparados em ${output}`);
