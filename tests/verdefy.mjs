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
 let current=structuredClone(order),calls=0;
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
 await retryVerdefy(env,async(e,t,q)=>{assert.match(q,/tracking->_verdefy/);assert.doesNotMatch(q,/utmify/);assert.match(q,/and=\(or\(/);return [];});
});

test('admin confirmed payment mirrors independently without provider or Meta call',async()=>{
 for(const encoded of [false,true]){
 const manual={source:'admin',method:'external',paidAt:'2026-11-04T20:10:00.046Z'};
 let payload;
 const result=await mirrorVerdefy(env,{...order,tracking:{...order.tracking,manualPayment:encoded?JSON.stringify(manual):manual}},()=>assert.fail('no provider confirmation invented'),async(url,req)=>{assert.match(url,/verdefy-sales/);payload=JSON.parse(req.body);return Response.json({ok:true});});
 assert.equal(result.state,'sent');assert.equal(payload.confirmedByProvider,false);assert.equal(payload.confirmationSource,'admin');assert.equal(payload.paidAt,manual.paidAt);assert.equal(payload.tracking.utm_id,'123');
 }
});
