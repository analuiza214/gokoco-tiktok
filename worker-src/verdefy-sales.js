import { queryPixGatewayStatus } from './pix-gateway-status.js';
export const verdefyToken=env=>String(env.VERDEFY_SALES_TOKEN||'').trim().replace(/^Bearer\s+/i,'');
const gateways = new Set(['masterfy','umbrellapag','venuspay_pix','unipay','invictuspay','flevopay','ironpay']);
const TRACKING_KEYS = ['utm_id','utm_source','utm_medium','utm_campaign','utm_content','utm_term','verdefy_pixel'];
// Estado independente por etapa; _verdefy continua sendo o espelho do pagamento confirmado.
const STATE = {paid:'_verdefy',pending:'_verdefy_pending',expired:'_verdefy_expired',refunded:'_verdefy_refund'};
const STATUS_FILTER = {paid:'&status=eq.paid',pending:'',expired:'&status=eq.expired',refunded:'&status=eq.refunded'};
const PENDING_WINDOW_MS = 48 * 3600000;

// A origem precisa ser a mesma da credencial; sem VERDEFY_SALES_SOURCE a loja existente continua como gokoco.
export function verdefySource(env) {
  const source = String(env.VERDEFY_SALES_SOURCE || 'gokoco').trim();
  return /^[\w-]{1,60}$/.test(source) ? source : null;
}

// Envia apenas atribuicao e dados do navegador usados no Purchase; nada de cliente, endereco ou estados internos.
function trackingPayload(tracking = {}) {
  const browser = tracking._browser || {};
  return {...Object.fromEntries(TRACKING_KEYS.filter((k) => tracking[k]).map((k) => [k, String(tracking[k]).slice(0, 300)])), _browser: {fbp: browser.fbp || null, fbc: browser.fbc || null, ip: browser.ip || null, user_agent: browser.user_agent || null, source_url: browser.source_url || null}};
}

export async function mirrorVerdefy(env, order, kind = 'paid', opts = {}, query = queryPixGatewayStatus, send = env.VERDEFY_SALES?.fetch.bind(env.VERDEFY_SALES) || fetch) {
  if (typeof kind === 'function') { send = opts; query = kind; kind = 'paid'; opts = {}; }
  if (!env.VERDEFY_SALES_TOKEN) return {state:'not_configured'};
  const source = verdefySource(env);
  if (!source) throw Error('VERDEFY_SALES_SOURCE inválido.');
  if (order.tracking?.manualExternal || !gateways.has(order.gateway)) return {state:'ineligible'};
  const common = {source,orderId:String(order.id),currency:'BRL',amount:Math.round(Number(order.amount)*100),netAmount:null,gateway:order.gateway,eventId:order.serverEventId||'pix_'+order.id,tracking:trackingPayload(order.tracking),items:(order.products||[]).map(p=>({productId:p.id?String(p.id):'',title:p.name,quantity:p.quantity}))};
  const pixAt = opts.pixAt || order.tracking?._verdefy_pending?.pix_at || order.created_at;
  let payload;
  if (kind === 'pending') {
    // Venda iniciada = cobranca Pix gerada com sucesso pelo gateway (transacao e codigo Pix salvos).
    if (!order.transaction_id || !order.pix_code || order.tracking?.manualPayment || !Number.isFinite(Date.parse(pixAt))) return {state:'ineligible'};
    payload = {...common,status:'pending',confirmedByProvider:true,createdAt:pixAt};
  } else if (kind === 'expired') {
    // A loja so grava expired a partir da resposta do gateway; falhas locais ficam como failed e nao sao enviadas.
    if (order.status !== 'expired' || !order.transaction_id || order.tracking?.manualPayment) return {state:'ineligible'};
    payload = {...common,status:'expired',confirmedByProvider:true,createdAt:pixAt};
  } else if (kind === 'refunded') {
    if (order.status !== 'refunded' || !order.transaction_id || order.tracking?.manualPayment) return {state:'ineligible'};
    const verified = await query(env, order.transaction_id, order.gateway);
    if (!verified.isRefunded) throw Error('Estorno não confirmado pelo gateway.');
    const paidAt = order.tracking?._payment?.paid_at || order.tracking?._purchase?.paid_at || verified.paidAt || null;
    const refundedAt = verified.refundedAt || verified.refunded_at || null;
    payload = {...common,status:'refunded',confirmedByProvider:true,createdAt:order.created_at,paidAt:Number.isFinite(Date.parse(paidAt))?paidAt:null,refundedAt:Number.isFinite(Date.parse(refundedAt))?refundedAt:null};
  } else {
    if (order.status !== 'paid') return {state:'ineligible'};
    let manual=order.tracking?.manualPayment;
    if(typeof manual==='string'){try{manual=JSON.parse(manual);}catch{manual=null;}}
    const adminConfirmed=manual?.source==='admin'&&manual?.method==='external'&&Number.isFinite(Date.parse(manual.paidAt));
    if(order.tracking?.manualPayment&&!adminConfirmed)return {state:'ineligible'};
    if(!adminConfirmed&&!order.transaction_id)return {state:'ineligible'};
    const verified=adminConfirmed?null:await query(env,order.transaction_id,order.gateway);
    if(!adminConfirmed&&(!verified.isPaid||verified.isRefunded))throw Error('Pagamento não confirmado pelo gateway.');
    const paidAt=adminConfirmed?manual.paidAt:(verified.paidAt||order.tracking?._payment?.paid_at||order.tracking?._purchase?.paid_at);
    if (!paidAt || !Number.isFinite(Date.parse(paidAt))) throw Error('Data confirmada de pagamento ausente.');
    payload = {...common,status:'paid',confirmedByProvider:!adminConfirmed,confirmationSource:adminConfirmed?'admin':'provider',createdAt:order.created_at,paidAt};
  }
  const r = await send('https://verdefy-sales.loja-oficial.workers.dev/v1/sales', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+verdefyToken(env)},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  if (!r.ok) throw Error('Verdefy HTTP '+r.status);
  const receipt = await r.json();
  if (receipt.ok !== true) throw Error('Recebimento não confirmado.');
  return {state:'sent',sent_at:new Date().toISOString(),...(kind==='pending'?{pix_at:pixAt}:{}),...(receipt.state?{verdefy_state:String(receipt.state).slice(0,40)}:{}),...(receipt.capi?{capi:String(receipt.capi).slice(0,40)}:{})};
}

// Estado separado do destino Utmify/Meta. CAS preserva alterações concorrentes.
export async function deliverVerdefy(env, db, orderId, mirror = mirrorVerdefy, kind = 'paid', opts = {}) {
  if (!env.VERDEFY_SALES_TOKEN) return {state:'not_configured'};
  const key = STATE[kind], filter = STATUS_FILTER[kind];
  if (!key) throw Error('Etapa Verdefy inválida.');
  const missing = kind==='paid' ? 'not_paid' : 'status_changed';
  for (let attempt=0; attempt<3; attempt++) {
    const order=(await db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(orderId)}${filter}&select=*&limit=1`))?.[0];
    if (!order) return {state:missing};
    const prior=order.tracking?.[key] || {};
    if (prior.state==='sent') return prior;
    if (Date.parse(prior.retry_at)>Date.now() || Date.parse(prior.lease_until)>Date.now()) return {state:'retry_pending'};
    const pending={state:'sending',attempts:(Number(prior.attempts)||0)+1,lease_until:new Date(Date.now()+120000).toISOString(),...(opts.pixAt||prior.pix_at?{pix_at:opts.pixAt||prior.pix_at}:{})};
    const tracking={...order.tracking,[key]:pending};
    const swap=async (before,after)=>db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(order.id)}${filter}&tracking=${before==null?'is.null':'eq.'+encodeURIComponent(JSON.stringify(before))}&select=*`,'PATCH',{tracking:after});
    if (!(await swap(order.tracking,tracking))?.[0]) continue;
    let result;
    try { result=await mirror(env,order,kind,{pixAt:pending.pix_at}); if(result.state==='ineligible')result.retry_at=new Date(Date.now()+86400000).toISOString(); }
    catch { result={state:'failed',retry_at:new Date(Date.now()+Math.min(3600000,60000*2**Math.min(pending.attempts,6))).toISOString(),error:'Falha na confirmação ou envio ao Verdefy.',...(pending.pix_at?{pix_at:pending.pix_at}:{})}; }
    // Releitura evita sobrescrever a atualização de outro fluxo.
    for(let save=0;save<3;save++) {
      const latest=(await db(env,'gokoco_orders',`?id=eq.${encodeURIComponent(order.id)}${filter}&select=*&limit=1`))?.[0];
      if(!latest)return {state:missing};
      if(latest.tracking?.[key]?.lease_until!==pending.lease_until)return {state:'busy'};
      if((await swap(latest.tracking,{...latest.tracking,[key]:{...result,attempts:pending.attempts}}))?.[0])return result;
    }
    return {state:'busy'};
  }
  return {state:'busy'};
}

export async function retryVerdefy(env,db) {
  if(!env.VERDEFY_SALES_TOKEN)return {configured:false,processed:0};
  const now=encodeURIComponent(new Date().toISOString());
  const due=(key,states)=>`and=(or(tracking->${key}->>state.is.null,tracking->${key}->>state.in.(${states})),or(tracking->${key}->>retry_at.is.null,tracking->${key}->>retry_at.lte.${now}))`;
  const pix=[...gateways].join(',');
  const batches=[
    ['paid',`?status=eq.paid&gateway=neq.manual_tracking&${due('_verdefy','failed,sending,ineligible')}&select=id&order=updated_at.asc&limit=3`],
    // Pix gerados recentes: a loja informa no momento da geracao; a fila cobre falhas. Historico antigo nao e reconstruido.
    ['pending',`?transaction_id=not.is.null&pix_code=not.is.null&gateway=in.(${pix})&created_at=gte.${encodeURIComponent(new Date(Date.now()-PENDING_WINDOW_MS).toISOString())}&${due('_verdefy_pending','failed,sending')}&select=id&order=created_at.asc&limit=3`],
    ['expired',`?status=eq.expired&tracking->_verdefy_pending->>state=eq.sent&${due('_verdefy_expired','failed,sending')}&select=id&order=updated_at.asc&limit=2`],
    ['refunded',`?status=eq.refunded&gateway=in.(${pix})&${due('_verdefy_refund','failed,sending')}&select=id&order=updated_at.asc&limit=1`],
  ];
  const summary={configured:true,processed:0,sent:0};
  for(const [kind,query] of batches){
    const rows=await db(env,'gokoco_orders',query).catch(()=>[]);
    const results=await Promise.allSettled(rows.map(o=>deliverVerdefy(env,db,o.id,mirrorVerdefy,kind)));
    summary.processed+=rows.length;summary.sent+=results.filter(r=>r.status==='fulfilled'&&r.value.state==='sent').length;
    summary[kind]=rows.length;
  }
  return summary;
}
