// Servidor local de prévia: replica o roteamento upsell do worker sobre dist/.
// Uso: node scripts/preview-server.mjs [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsellCatalog } from '../worker-src/upsell-catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const port = Number(process.argv[2]) || 8787;

const types = { '.html': 'text/html', '.txt': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.gif': 'image/gif' };

const routes = { '/upsell1': 'original', '/tl/upsell1': 'tl', '/video/upsell1': 'bella', '/pagamento-pincel': 'pagamento', '/tl/pagamento-pincel': 'tl-pagamento-pincel', '/video/pagamento-pincel': 'bella-pagamento-pincel' };
for (const [prefix, theme] of [['', 'original'], ['/tl', 'tl'], ['/video', 'bella']]) {
  for (const p of upsellCatalog) {
    routes[`${prefix}/upsell${p.step}`] = `${theme}-${p.id}`;
    routes[`${prefix}/pagamento-${p.id}`] = `${theme}-pagamento-${p.id}`;
  }
  routes[`${prefix}/upsell-concluido`] = `${theme}-concluido`;
  routes[`${prefix}/vitrine`] = `${theme}-vitrine`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname).replace(/\/$/, '').replace(/\.html$/, '') || '/';
  const page = routes[pathname];
  let file;
  if (page) file = path.join(dist, 'upsell-pages', `${page}.txt`);
  else {
    file = path.join(dist, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  }
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('404 ' + pathname); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', ...(page ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Prévia em http://localhost:${port}/upsell2 (tl: /tl/upsell2, bella: /video/upsell2, vitrine: /vitrine)`));
