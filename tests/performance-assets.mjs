import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { optimizeImages } from '../scripts/optimize-images.mjs';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'gokoco-responsive-'));
await fs.mkdir(path.join(fixture, 'images'));
// Lossless random pixels keep the test image above the optimization threshold.
const bytes = crypto.getRandomValues(new Uint8Array(640 * 32 * 3));
const rows = Buffer.concat(Array.from({length: 10}, () => bytes));
const original = await sharp(rows, {raw:{width:640,height:320,channels:3}}).png().toBuffer();
await fs.writeFile(path.join(fixture, 'images', 'photo.png'), original);
await fs.writeFile(path.join(fixture, 'index.html'), '<link rel="preload" as="image" href="/images/photo.png"><img src="/images/photo.png" width="480"><img src="/images/photo.png" width="96"><img id="cart-thumb" src="/images/photo.png"><img alt="Produto" src="/images/photo.png"><img src="/images/missing.png"><img src="https://example.com/photo.png">');
await optimizeImages(fixture);
const html = await fs.readFile(path.join(fixture, 'index.html'), 'utf8');
assert.deepEqual(await fs.readFile(path.join(fixture, 'images', 'photo.png')), original, 'original file must not change');
assert.match(html, /imagesrcset="([^"]+)"/);
const srcsets = [...html.matchAll(/(?<!image)srcset="([^"]+)"/g)].map(m => m[1]);
assert.equal(srcsets.length, 2, 'dynamic and external images must not acquire a static srcset');
assert.equal(html.match(/imagesrcset="([^"]+)"/)[1], srcsets[0], 'preload and LCP image must select the same resource');
assert.match(html, /sizes="96px"/);
for (const item of srcsets[0].split(', ')) {
  const [url, width] = item.split(' ');
  const metadata = await sharp(path.join(fixture, url)).metadata();
  assert.equal(metadata.width, Number(width.slice(0, -1)));
}
assert.match(html, /<img id="cart-thumb" src="\/images\/photo.png">/);
assert.match(html, /<img alt="Produto" src="\/images\/photo.png">/);
console.log('Imagens responsivas: arquivos válidos, preload alinhado, originais e imagens dinâmicas preservados.');
