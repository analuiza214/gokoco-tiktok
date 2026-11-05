import { queryPixGatewayStatus } from './pix-gateway-status.js';
const gateways = new Set(['masterfy','umbrellapag','venuspay_pix','unipay','invictuspay','flevopay','ironpay']);

export async function mirrorVerdefy(env, order, query = queryPixGatewayStatus, send = fetch) {
  if (!env.VERDEFY_SALES_TOKEN) return {state:'not_configured'};
  if (order.status !== 'paid' || order.tracking?.manualExternal || !gateways.has(order.gateway)) return {state:'ineligible'};
  let manual=order.tracking?.manualPayment;
  if(typeof manual==='string'){try{manual=JSON.parse(manual);}catch{manual=null;}}
  const adminConfirmed=manual?.source==='admin'&&manual?.method==='external'&&Number.isFinite(Date.parse(manual.paidAt));
  if(order.tracking?.manualPayment&&!adminConfirmed)return {state:'ineligible'};
  if(!adminConfirmed&&!order.transaction_id)return {state:'ineligible'};
  const verified=adminConfirmed?null:await query(env,order.transaction_id,order.gateway);
  if(!adminConfirmed&&(!verified.isPaid||verified.isRefunded))throw Error('Pagamento n�o confirmado pelo gateway.');
  const paidAt=adminConfirmed?manual.paidAt:(verified.paidAt||order.tracking?._payment?.paid_at||order.tracking?._purchase?.paid_at);
  if (!paidAt || !Number.isFinite(Date.parse(paidAt))) throw Error('Data confirmada de pagamento ausente.');
  const payload = {source:'gokoco',orderId:String(order.id),status:'paid',confirmedByProvider:!adminConfirmed,confirmationSource:adminConfirmed?'admin':'provider',currency:'BRL',amount:Math.round(Number(order.amount)*100),netAmount:null,createdAt:order.created_at,paidAt,gateway:order.gateway,tracking:order.tracking,items:(order.products||[]).map(p=>({productId:p.id?String(p.id):'',title:p.name,quantity:p.quantity}))};
  const r = await send('https://verdefy-sales.joazinhisonetinho44.workers.dev/v1/sales', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.VERDEFY_SALES_TOKEN},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  if (!r.ok) throw Error('Verdefy HTTP '+r.status);
  const receipt = await r.json();
  if (receipt.ok !== true) throw Error('Recebimento não confirmado.');
  return {state:'sent',sent_at:new Date().toISOString()};
}

// Estado separado do destino Utmify/Meta. CAS preserva alterações concorrentes.
export async function deliverVerdefy(env, db, orderId, mirror = mirrorVerdefy) {
  if (!env.VERDEFY_SALES_TOKEN) return {state:'not_configured'};
  for (let attempt=0; attempt<3; attempt++) {
    const order=(await db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`))?.[0];
    if (!order) return {state:'not_paid'};
    const prior=order.tracking?._verdefy || {};
    if (prior.state==='sent') return prior;
    if (Date.parse(prior.retry_at)>Date.now() || Date.parse(prior.lease_until)>Date.now()) return {state:'retry_pending'};
    const pending={state:'sending',attempts:(Number(prior.attempts)||0)+1,lease_until:new Date(Date.now()+120000).toISOString()};
    const tracking={...order.tracking,_verdefy:pending};
    const swap=async (before,after)=>db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(before||{}))}&select=*`,'PATCH',{tracking:after});
    if (!(await swap(order.tracking,tracking))?.[0]) continue;
    let result;
    try { result=await mirror(env,order); if(result.state==='ineligible')result.retry_at=new Date(Date.now()+86400000).toISOString(); }
    catch { result={state:'failed',retry_at:new Date(Date.now()+Math.min(3600000,60000*2**Math.min(pending.attempts,6))).toISOString(),error:'Falha na confirmação ou envio ao Verdefy.'}; }
    // Releitura evita sobrescrever a atualização de outro fluxo.
    for(let save=0;save<3;save++) {
      const latest=(await db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&select=*&limit=1`))?.[0];
      if(!latest)return {state:'not_paid'};
      if(latest.tracking?._verdefy?.lease_until!==pending.lease_until)return {state:'busy'};
      if((await swap(latest.tracking,{...latest.tracking,_verdefy:{...result,attempts:pending.attempts}}))?.[0])return result;
    }
    return {state:'busy'};
  }
  return {state:'busy'};
}

export async function retryVerdefy(env,db) {
  if(!env.VERDEFY_SALES_TOKEN)return {configured:false,processed:0};
  const since=new Date(Date.now()-7*86400000).toISOString();
  const now=new Date().toISOString();
  const rows=await db(env,'gokoco_orders',`?status=eq.paid&gateway=neq.manual_tracking&and=(or(tracking->_verdefy->>state.is.null,tracking->_verdefy->>state.in.(failed,sending,ineligible)),or(tracking->_verdefy->>retry_at.is.null,tracking->_verdefy->>retry_at.lte.${encodeURIComponent(now)}))&select=id&order=updated_at.asc&limit=3`);
  const results=await Promise.allSettled(rows.map(o=>deliverVerdefy(env,db,o.id)));
  return {configured:true,processed:rows.length,sent:results.filter(r=>r.status==='fulfilled'&&r.value.state==='sent').length};
}
