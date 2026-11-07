import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import {onRequest as utmify} from '../sites/bella/functions/api/utmify-order.js';
import {onRequest as meta} from '../sites/bella/functions/api/fb-purchase.js';

test('atalhos públicos antigos recusam eventos sem consultar banco ou provedor', async () => {
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('Nenhuma chamada externa permitida');};
  try {
    for(const handler of [utmify,meta]) for(const method of ['GET','OPTIONS','POST']) {
      const request=new Request('https://isolated.invalid/api/legacy',{method,...(method==='POST'?{body:JSON.stringify({status:'paid',orderId:'isolated-only',valueInCents:100})}:{})});
      const r=await handler({request,env:new Proxy({}, {get(){throw Error('Credenciais não devem ser lidas');}})});
      assert.equal(r.status,410);assert.equal(r.headers.get('Cache-Control'),'no-store');
      assert.equal((await r.json()).code,'legacy_purchase_route_disabled');
    }
    assert.equal(calls,0);
  } finally {globalThis.fetch=original;}
});

test('Worker publicado bloqueia os dois atalhos Video, mesmo com segredos configurados', async () => {
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('Nenhum envio permitido');};
  try {
    for(const route of ['/video/api/utmify-order','/video/api/fb-purchase']) {
      const r=await worker.fetch(new Request('https://isolated.invalid'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'paid',event_id:'isolated-only',valueInCents:100})}),{UTMIFY_API_TOKEN:'isolated-only',FB_ACCESS_TOKEN:'isolated-only'});
      assert.equal(r.status,410);assert.equal((await r.json()).code,'legacy_purchase_route_disabled');
    }
    assert.equal(calls,0);
  } finally {globalThis.fetch=original;}
});
