import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import worker from '../_worker.js';
import { upsellCatalog } from '../worker-src/upsell-catalog.js';

const root = path.resolve(import.meta.dirname,'..');
const dist = path.join(root,'dist');
const env = { ASSETS: { fetch: request => new Response(new URL(request.url).pathname) } };
let count=0;
for(const [prefix,theme] of [['','original'],['/tl','tl'],['/video','bella']]) {
  for(const suffix of ['','/','.html']) {
    const response=await worker.fetch(new Request(`https://example.test${prefix}/vitrine${suffix}`),env);
    assert.equal(await response.text(),`/upsell-pages/${theme}-vitrine.txt`);
    assert.equal(response.headers.get('Content-Type'),'text/html; charset=utf-8');
  }
  const storefront=fs.readFileSync(path.join(dist,'upsell-pages',`${theme}-vitrine.txt`),'utf8');
  // A vitrine usa o visual do próprio site: a original clona o loja.html e a
  // TL/Bella levam o catálogo dentro do bundle gerado do site.
  const vbundle=theme==='original'?'':fs.readFileSync(path.join(dist,'upsell-assets',`${theme}-vitrine-model.js`),'utf8')
    .replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})/g,(_,a,b)=>String.fromCharCode(parseInt(a||b,16)));
  const vall=storefront+vbundle;
  for(const product of upsellCatalog) {
    assert.ok(vall.includes(`upsell${product.step}`),`${theme}: link do ${product.id} ausente`);
    assert.ok(vall.includes(product.name),`${theme}: nome do ${product.id} ausente`);
    assert.ok(vall.includes(`/kalodata/${product.id}/Imagens/`),`${theme}: foto do ${product.id} ausente`);
  }
  for(const [,script] of storefront.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
  for(const product of upsellCatalog) {
    for(const [route,file] of [[`upsell${product.step}`,`${theme}-${product.id}`],[`pagamento-${product.id}`,`${theme}-pagamento-${product.id}`]]) {
      for(const suffix of ['','/','.html']) {
        const response=await worker.fetch(new Request(`https://example.test${prefix}/${route}${suffix}`),env);
        assert.equal(await response.text(),`/upsell-pages/${file}.txt`);
        assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
      }
      assert.equal((await worker.fetch(new Request(`https://example.test${prefix}/${route}`,{method:'POST'}),env)).status,405);
    }
    const html=fs.readFileSync(path.join(dist,'upsell-pages',`${theme}-${product.id}.txt`),'utf8');
    const checkout=fs.readFileSync(path.join(dist,'upsell-pages',`${theme}-pagamento-${product.id}.txt`),'utf8');
    assert.ok(html.includes(product.name));
    assert.ok(html.includes(`data-theme="${theme}"`));
    // A página replica o site original: no original o conteúdo está no HTML;
    // no TL/Bella (SPA) os dados do produto vivem no bundle gerado.
    const rendered = (theme==='original' ? html : fs.readFileSync(path.join(dist,'upsell-assets',`${theme}-${product.id}-model.js`),'utf8'))
      .replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})/g,(_,a,b)=>String.fromCharCode(parseInt(a||b,16)));
    assert.ok(rendered.includes(product.name));
    assert.match(rendered, new RegExp(String(product.price).replace(/[.,]/, '[.,]')));
    // Compra no checkout próprio e continuação do funil para a próxima oferta.
    assert.ok(html.includes(`href="${prefix}/pagamento-${product.id}"`));
    const next=`${prefix}/${product.step<6?`upsell${product.step+1}`:'upsell-concluido'}`;
    assert.ok(html.includes(`href="${next}"`));
    assert.ok(checkout.includes(`product:'${product.id}'`));
    assert.ok(checkout.includes(`var UNIT = ${product.price}`));
    assert.ok(checkout.includes(next));
    assert.ok(checkout.includes(`lv_checkout_${product.id}`));
    assert.ok(!checkout.includes('Escova Modeladora GOKOCO'));
    const media=new Set([...(html+rendered).matchAll(/\/upsell-assets\/[A-Za-z0-9_\-\/.%]+\.(?:png|webp|jpe?g|mp4)/g)].map(m=>m[0]));
    assert.ok([...media].some(u=>u.includes(`/kalodata/${product.id}/Imagens/`)),'fotos do produto ausentes');
    if(theme!=='bella')assert.ok([...media].some(u=>u.endsWith('.mp4')&&u.includes(`/kalodata/${product.id}/`)),'vídeos do produto ausentes');
    for(const url of media) {
      const file=path.join(dist,url);
      assert.ok(fs.existsSync(file),url);
      assert.ok(fs.statSync(file).size>100,url);
      if(url.endsWith('.mp4')) {
        const fd=fs.openSync(file,'r'),header=Buffer.alloc(32);
        fs.readSync(fd,header,0,32,0);fs.closeSync(fd);
        assert.ok(header.includes(Buffer.from('ftyp')),url);
      }
    }
    // Parse all inline scripts so a product-specific replacement cannot ship invalid JS.
    for(const page of [html,checkout])for(const [,script] of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      if(script.trim())new vm.Script(script);
    }
    count++;
  }
}
// Exercise the actual cart validator without network or payment side effects.
let source=fs.readFileSync(path.join(root,'worker-src','index.js'),'utf8');
source=source.slice(source.indexOf('const BUMPS ='),source.indexOf('async function nextPixAmount'));
const sandbox={upsellCatalog};vm.createContext(sandbox);
vm.runInContext(source+';this.total=cartTotal;',sandbox);
for(const p of upsellCatalog) {
  const cart={product:p.id,qty:1,colors:[],shipping:'Frete Grátis',bumps:[],discount:1,bonus:0};
  assert.equal(sandbox.total(cart),p.price);
  assert.equal(sandbox.total({...cart,qty:3}),Math.round(p.price*300)/100);
  assert.equal(sandbox.total({...cart,colors:[{label:'Preta',quantity:1}]}),null);
}
assert.equal(sandbox.total({product:'invalid',qty:1}),null);
console.log(`${count} ofertas e checkouts: rotas, sequência, preços, mídias e scripts verificados sem gerar cobranças.`);
