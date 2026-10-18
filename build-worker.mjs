import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(root, 'worker-src', 'index.js')],
  outfile: path.join(root, '_worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});
console.log('Criado _worker.js');
