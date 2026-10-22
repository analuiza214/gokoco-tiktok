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
  assert.equal((storefront.match(/data-product-link href=/g)||[]).length,5);
  for(const product of upsellCatalog)assert.ok(storefront.includes(`href="${prefix}/upsell${product.step}"`));
  for(const [,script] of storefront.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
  // Run the real storefront controller with a minimal DOM to test combined
  // category/search filters, reset and attribution on every product link.
  const element = dataset => ({dataset,hidden:false,value:'',events:{},attributes:{},addEventListener(event,fn){this.events[event]=fn;},setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;}});
  const cards=upsellCatalog.map(p=>element({name:p.name,category:p.category.includes('cabelos')?'Cabelos':p.category.includes('pele')?'Pele':'Corpo'}));
  const filters=['Todos','Cabelos','Pele','Corpo'].map(filter=>element({filter}));
  const ids=Object.fromEntries(['product-search','result-count','empty-results','reset-search'].map(id=>[id,element({})]));
  const links=upsellCatalog.map(p=>({href:`https://example.test${prefix}/upsell${p.step}`}));
  const document={getElementById:id=>ids[id],querySelectorAll:selector=>({'.shop-card':cards,'[data-filter]':filters,'[data-product-link]':links})[selector]};
  vm.runInNewContext([...storefront.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],{document,URL,location:{search:'?utm_source=test'}});
  filters[1].events.click();assert.equal(cards.filter(c=>!c.hidden).length,3);
  ids['product-search'].value='obrigatorio';ids['product-search'].events.input();assert.equal(cards.filter(c=>!c.hidden).length,1);
  filters[2].events.click();assert.equal(cards.filter(c=>!c.hidden).length,0);assert.equal(ids['empty-results'].hidden,false);
  ids['reset-search'].events.click();assert.equal(cards.filter(c=>!c.hidden).length,5);assert.equal(ids['empty-results'].hidden,true);
  assert.ok(links.every(link=>link.href.endsWith('?utm_source=test')));
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
    assert.equal((html.match(/<video /g)||[]).length,10);
    assert.ok(html.includes(`href="${prefix}/pagamento-${product.id}"`));
    assert.ok(html.includes('Não há depoimentos individuais'));
    assert.ok(html.includes('Não representa avaliações recebidas nesta loja'));
    const next=`${prefix}/${product.step<6?`upsell${product.step+1}`:'upsell-concluido'}`;
    assert.ok(html.includes(`href="${next}"`));
    assert.ok(checkout.includes(`product:'${product.id}'`));
    assert.ok(checkout.includes(`var UNIT = ${product.price}`));
    assert.ok(checkout.includes(next));
    assert.ok(checkout.includes(`lv_checkout_${product.id}`));
    assert.ok(!checkout.includes('Escova Modeladora GOKOCO'));
    for(const [,url] of html.matchAll(/(?:src|data-photo)="(\/upsell-assets\/[^"?]+)"/g)) {
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
