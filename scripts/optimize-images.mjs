import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Only the build output changes. Original files, URLs used by scripts, and
// full-resolution images remain available (including lightboxes and checkout).
export async function optimizeImages(output) {
  const directory = path.resolve(output);
  const destination = path.join(directory, '_responsive');
  await fs.mkdir(destination, { recursive: true });
  const variants = new Map();
  let optimizedTags = 0;
  async function imagesFor(url, page) {
    if (!url || /^(?:[a-z]+:|\/\/|#)/i.test(url) || /[?#]/.test(url)) return null;
    const filename = path.resolve(url.startsWith('/') ? directory : path.dirname(page), `.${url.startsWith('/') ? url : '/' + url}`);
    if (!filename.startsWith(directory + path.sep) || !/\.(?:png|jpe?g|webp|avif)$/i.test(filename)) return null;
    if (variants.has(filename)) return variants.get(filename);
    const work = (async () => {
      let original;
      try { original = await fs.readFile(filename); } catch { return null; }
      if (original.length < 8192) return null;
      const metadata = await sharp(original).metadata();
      if (!metadata.width || metadata.pages > 1) return null;
      const imageWidth = metadata.orientation >= 5 && metadata.orientation <= 8 ? metadata.height : metadata.width;
      const hash = createHash('sha256').update(original).update('responsive-v1-q88').digest('hex').slice(0, 16);
      const widths = [...new Set([192, 480, 960].map(width => Math.min(width, imageWidth)))];
      const images = [];
      for (const width of widths) {
        const name = `${hash}-${width}.webp`;
        const encoded = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 88, effort: 5 }).toBuffer();
        if (encoded.length >= original.length) {
          // Never replace an already efficient original with a larger download.
          const originalUrl = encodeURI('/' + path.relative(directory, filename).split(path.sep).join('/'));
          images.push(`${originalUrl} ${imageWidth}w`);
          break;
        }
        await fs.writeFile(path.join(destination, name), encoded);
        images.push(`/_responsive/${name} ${width}w`);
      }
      return images.join(', ');
    })();
    variants.set(filename, work);
    return work;
  }
  async function transform(html, page) {
    const tags = [...html.matchAll(/<img\b[^>]*>/gi)];
    const replacements = new Map();
    for (const [tag] of tags) {
      // An existing srcset, an ID, or the dynamic checkout product is controlled
      // by application code. Never let a static srcset override a later src change.
      if (/\b(?:srcset|id)\s*=|\balt=["']Produto["']/i.test(tag)) continue;
      const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const srcset = await imagesFor(src, page);
      if (!srcset) continue;
      const width = Number(tag.match(/\bwidth=["'](\d+)["']/i)?.[1]);
      const size = /\bw-24\b/.test(tag) ? 96 : /\bw-8\b/.test(tag) ? 32 : width && width <= 192 ? width : null;
      const sizes = size ? `${size}px` : '(max-width: 480px) 100vw, 480px';
      replacements.set(tag, tag.replace(/\s*\/?>(?=$)/, ` srcset="${srcset}" sizes="${sizes}">`));
      optimizedTags++;
    }
    html = html.replace(/<img\b[^>]*>/gi, tag => replacements.get(tag) || tag);
    // Match the responsive LCP request so preload and img do not download two files.
    for (const [tag] of [...html.matchAll(/<link\b[^>]*>/gi)]) {
      if (!/\brel=["']preload["']/i.test(tag) || !/\bas=["']image["']/i.test(tag)) continue;
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      const srcset = await imagesFor(href, page);
      if (srcset) html = html.replace(tag, tag.replace(/\s*\/?>(?=$)/, ` imagesrcset="${srcset}" imagesizes="(max-width: 480px) 100vw, 480px">`));
    }
    return html;
  }
  const pages = ['index.html', 'loja.html', 'pagamento.html', 'rastreio.html'];
  const upsells = path.join(directory, 'upsell-pages');
  try { pages.push(...(await fs.readdir(upsells)).filter(name => name.endsWith('.txt')).map(name => 'upsell-pages/' + name)); } catch {}
  for (const name of pages) {
    const page = path.join(directory, name);
    let html;
    try { html = await fs.readFile(page, 'utf8'); } catch { continue; }
    await fs.writeFile(page, await transform(html, page));
  }
  console.log(`Imagens responsivas: ${optimizedTags} elementos; originais preservados.`);
  return { optimizedTags, originals: variants.size };
}
