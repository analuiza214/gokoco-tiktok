import test from 'node:test';
import assert from 'node:assert/strict';
import {mirrorVerdefy,deliverVerdefy,retryVerdefy} from '../worker-src/verdefy-sales.js';
const env={VERDEFY_SALES_TOKEN:'isolated-test-only'};
const order={id:'test-1',status:'paid',gateway:'masterfy',transaction_id:'provider-1',amount:10,created_at:new Date().toISOString(),tracking:{_payment:{paid_at:new Date().toISOString()},utm_id:'123'},products:[{name:'Item',quantity:1}]};
test('manual, unsupported and unpaid never call provider or receiver',async()=>{
 for(const patch of [{status:'pending'},{tracking:{manualPayment:true}},{tracking:{manualExternal:true}},{gateway:'unknown'}]) {
  assert.equal((await mirrorVerdefy(env,{...order,...patch},()=>assert.fail(),()=>assert.fail())).state,'ineligible');
 }
});
test('gateway must confirm paid and not refunded; strips invented product identity',async()=>{
 for(const state of [{isPaid:false},{isPaid:true,isRefunded:true}])await assert.rejects(mirrorVerdefy(env,order,async()=>state,()=>assert.fail()));
 let payload;
 assert.equal((await mirrorVerdefy(env,order,async()=>({isPaid:true}),async(url,req)=>{payload=JSON.parse(req.body);return Response.json({ok:true});})).state,'sent');
 assert.equal(payload.amount,1000);assert.equal(payload.netAmount,null);assert.equal(payload.items[0].productId,'');assert.equal(payload.tracking.utm_id,'123');
});
test('independent state retries failure and does not resend accepted order',async()=>{
 let current=structuredClone(order),calls=0;current.tracking._verdefy={state:'ineligible'};
 const db=async(e,t,q,method,body)=>{
  if(method!=='PATCH')return [structuredClone(current)];
  const expected=JSON.parse(new URLSearchParams(q).get('tracking').slice(3));
  if(JSON.stringify(expected)!==JSON.stringify(current.tracking))return [];
  current.tracking=body.tracking;return [structuredClone(current)];
 };
 assert.equal((await deliverVerdefy(env,db,order.id,async()=>{throw Error('offline');})).state,'failed');
 assert.equal((await deliverVerdefy(env,db,order.id,()=>assert.fail())).state,'retry_pending');
 current.tracking._verdefy.retry_at=new Date(0).toISOString();
 assert.equal((await deliverVerdefy(env,db,order.id,async()=>{calls++;return {state:'sent'};})).state,'sent');
 assert.equal((await deliverVerdefy(env,db,order.id,()=>assert.fail())).state,'sent');assert.equal(calls,1);
});
test('retry selects independent state even if primary destination sent',async()=>{
 const queries=[];
 await retryVerdefy(env,async(e,t,q)=>{queries.push(q);assert.match(q,/tracking->_verdefy/);assert.doesNotMatch(q,/utmify/);assert.match(q,/and=\(or\(/);assert.doesNotMatch(q,/updated_at=gte/);assert.match(q,/limit=[123]&?/);return [];});
 assert.match(queries[0],/^\?status=eq\.paid&.*limit=3$/);
 assert.match(queries[1],/pix_code=not\.is\.null/);assert.match(queries[1],/created_at=gte\./);assert.doesNotMatch(queries[1],/masterfy_card/);
 assert.match(queries[2],/status=eq\.expired&tracking->_verdefy_pending->>state=eq\.sent/);
 assert.match(queries[3],/status=eq\.refunded/);
});

const capture=()=>{const sent=[];return {sent,send:async(url,req)=>{sent.push(JSON.parse(req.body));return Response.json({ok:true,state:'pending'});}};};
test('source da credencial vem de VERDEFY_SALES_SOURCE; sem ela a loja existente continua gokoco',async()=>{
 const c=capture();
 await mirrorVerdefy(env,order,'paid',{},async()=>({isPaid:true}),c.send);
 await mirrorVerdefy({...env,VERDEFY_SALES_SOURCE:'src_abc'},order,'paid',{},async()=>({isPaid:true}),c.send);
 assert.deepEqual(c.sent.map(p=>p.source),['gokoco','src_abc']);
 await assert.rejects(mirrorVerdefy({...env,VERDEFY_SALES_SOURCE:'../x'},order,'paid',{},async()=>({isPaid:true}),c.send));
 assert.equal(c.sent[0].eventId,'pix_test-1');
});
test('Pix gerado envia pending sem consultar gateway; exige transacao e codigo Pix; preserva data da geracao',async()=>{
 const c=capture();const pixAt='2026-11-05T12:00:00.000Z';
 const pending={...order,status:'pending',pix_code:'000201...',tracking:{utm_id:'123',utm_term:'456',utm_content:'789',verdefy_pixel:'98988e4c-9c44-4d29-afea-9759b20d8604',_purchase:{utmify:{state:'sent'}},shipping:{code:'GKX'},_browser:{fbp:'fb.1.1.1',fbc:null,ip:'203.0.113.5',user_agent:'UA',source_url:'https://gocoko-tiktok.shop/pagamento'}}};
 const r=await mirrorVerdefy(env,pending,'pending',{pixAt},()=>assert.fail('no gateway query'),c.send);
 assert.equal(r.state,'sent');assert.equal(r.pix_at,pixAt);
 const p=c.sent[0];assert.equal(p.status,'pending');assert.equal(p.createdAt,pixAt);assert.equal(p.amount,1000);assert.equal(p.confirmedByProvider,true);
 assert.deepEqual(Object.keys(p.tracking).sort(),['_browser','utm_content','utm_id','utm_term','verdefy_pixel']);assert.equal(p.tracking._browser.ip,'203.0.113.5');
 assert.equal(JSON.stringify(p).includes('GKX'),false);assert.equal(JSON.stringify(p).includes('utmify'),false);
 for(const patch of [{pix_code:null},{transaction_id:null},{gateway:'masterfy_card'},{tracking:{manualExternal:true}}])assert.equal((await mirrorVerdefy(env,{...pending,...patch},'pending',{pixAt},()=>assert.fail(),()=>assert.fail())).state,'ineligible');
});
test('expirado usa estado ja confirmado pelo gateway; estorno reconsulta o gateway e preserva data do pagamento',async()=>{
 const c=capture();
 await mirrorVerdefy(env,{...order,status:'expired',tracking:{_verdefy_pending:{state:'sent',pix_at:'2026-11-05T10:00:00.000Z'}}},'expired',{},()=>assert.fail(),c.send);
 assert.equal(c.sent[0].status,'expired');assert.equal(c.sent[0].createdAt,'2026-11-05T10:00:00.000Z');
 assert.equal((await mirrorVerdefy(env,{...order,status:'failed'},'expired',{},()=>assert.fail(),()=>assert.fail())).state,'ineligible');
 const refunded={...order,status:'refunded'};
 await assert.rejects(mirrorVerdefy(env,refunded,'refunded',{},async()=>({isRefunded:false}),()=>assert.fail()));
 await mirrorVerdefy(env,refunded,'refunded',{},async()=>({isRefunded:true,refundedAt:'2026-11-05T15:00:00.000Z'}),c.send);
 const p=c.sent[1];assert.equal(p.status,'refunded');assert.equal(p.paidAt,order.tracking._payment.paid_at);assert.equal(p.refundedAt,'2026-11-05T15:00:00.000Z');
 assert.equal((await mirrorVerdefy(env,{...refunded,tracking:{manualPayment:{source:'admin',method:'external',paidAt:'2026-11-05T10:00:00Z'}}},'refunded',{},()=>assert.fail(),()=>assert.fail())).state,'ineligible');
});
test('estado pending e independente do pagamento: pedido pago depois nao perde o aviso nem duplica o espelho pago',async()=>{
 let current={...structuredClone(order),status:'pending',pix_code:'x'},calls=[];
 const db=async(e,t,q,method,body)=>{const params=new URLSearchParams(q);if(params.get('status')&&params.get('status')!=='eq.'+current.status)return [];if(method!=='PATCH')return [structuredClone(current)];if(JSON.stringify(JSON.parse(params.get('tracking').slice(3)))!==JSON.stringify(current.tracking))return [];current.tracking=body.tracking;return [structuredClone(current)];};
 const mirror=async(e,o,kind,opts)=>{calls.push(kind+':'+(opts.pixAt||''));return {state:'sent',...(kind==='pending'?{pix_at:opts.pixAt}:{})};};
 assert.equal((await deliverVerdefy(env,db,order.id,mirror,'pending',{pixAt:'2026-11-05T12:00:00.000Z'})).state,'sent');
 assert.equal((await deliverVerdefy(env,db,order.id,mirror,'paid')).state,'not_paid');
 current.status='paid';
 assert.equal((await deliverVerdefy(env,db,order.id,mirror,'paid')).state,'sent');
 assert.equal((await deliverVerdefy(env,db,order.id,mirror,'pending')).state,'sent');
 assert.equal((await deliverVerdefy(env,db,order.id,mirror,'paid')).state,'sent');
 assert.deepEqual(calls,['pending:2026-11-05T12:00:00.000Z','paid:']);
 assert.equal(current.tracking._verdefy_pending.pix_at,'2026-11-05T12:00:00.000Z');assert.equal(current.tracking._verdefy.state,'sent');
});

test('admin confirmed payment mirrors independently without provider or Meta call',async()=>{
 for(const encoded of [false,true]){
 const manual={source:'admin',method:'external',paidAt:'2026-11-04T20:10:00.046Z'};
 let payload;
 const result=await mirrorVerdefy(env,{...order,transaction_id:null,tracking:{...order.tracking,manualPayment:encoded?JSON.stringify(manual):manual}},()=>assert.fail('no provider confirmation invented'),async(url,req)=>{assert.match(url,/verdefy-sales/);payload=JSON.parse(req.body);return Response.json({ok:true});});
 assert.equal(result.state,'sent');assert.equal(payload.confirmedByProvider,false);assert.equal(payload.confirmationSource,'admin');assert.equal(payload.paidAt,manual.paidAt);assert.equal(payload.tracking.utm_id,'123');
 }
});
