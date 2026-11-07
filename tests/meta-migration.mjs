import test from 'node:test';import assert from 'node:assert/strict';import {deliverPaidPurchase} from '../worker-src/purchase-tracking.js';
const base={id:'isolated-order',status:'paid',tracking:{_purchase:{paid_at:'2026-11-04T12:00:00Z'}}};
test('migration never resends a prior Utmify purchase to Meta, including uncertain states',async()=>{for(const state of ['sent','sending','failed']){const order=structuredClone(base);order.tracking._purchase.utmify={state};const r=await deliverPaidPurchase({PURCHASE_DELIVERY_MODE:'meta'},async()=>[order],order.id);assert.equal(r.state,'previous_destination');}});
test('cutover excludes history and invalid cutoff without calling Meta',async()=>{for(const cutoff of ['2026-11-05T00:00:00Z','invalid']){const r=await deliverPaidPurchase({PURCHASE_DELIVERY_MODE:'meta',PURCHASE_MIGRATION_AT:cutoff},async()=>[base],base.id);assert.equal(r.state,'before_migration');}});

test('Verdefy explicito nao cai em Utmify ou Meta direto nem exige token Meta na loja',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('nao deve enviar');};
 try{const r=await deliverPaidPurchase({PURCHASE_DELIVERY_MODE:'verdefy',UTMIFY_API_TOKEN:'isolated',FB_ACCESS_TOKEN:'isolated'},async()=>[base],base.id);assert.equal(r.destination,'verdefy');assert.equal(r.state,'not_configured');assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
