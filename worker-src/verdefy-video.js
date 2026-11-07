import {deliverVerdefy,mirrorVerdefy} from './verdefy-sales.js';
import {queryPixGatewayStatus} from '../sites/bella/functions/_lib/pix-gateway-status.js';
const status={checkout_iniciado:'creating',pix_gerado:'pending',pago:'paid',expirado:'expired',reembolsado:'refunded'};
export function videoOrder(lead){return {...lead,id:String(lead.id),status:status[lead.status]||lead.status,amount:Number(lead.valor),products:lead.tracking?._items||[],pix_code:lead.tracking?._verdefy_pix?.generated?'gateway_confirmed':null,serverEventId:String(lead.transaction_id||lead.id)+'_purchase'};}
async function request(env,path,method='GET',body){const base=String(env.SUPABASE_URL||'').trim().replace(/\/+$/,'');if(!base||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Banco não configurado');const r=await fetch(base+'/rest/v1/leads'+path,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Banco indisponível');return r.json();}
export async function deliverVideoVerdefy(env,id,kind='paid'){
 const db=async(e,_table,q,method,body)=>{q=q.replace('status=eq.paid','status=eq.pago').replace('status=eq.expired','status=eq.expirado').replace('status=eq.refunded','status=eq.reembolsado');return (await request(e,q,method,body)).map(videoOrder);};
 const mirror=(e,o,k,opts)=>mirrorVerdefy(e,o,k,{...opts,...(o.tracking?._verdefy_pix?.at?{pixAt:o.tracking._verdefy_pix.at}:{})},queryPixGatewayStatus);
 return deliverVerdefy(env,db,id,mirror,kind);
}
export async function rememberVideoPayment(env,tx,paidAt){
 for(let n=0;n<3;n++){const row=(await request(env,'?transaction_id=eq.'+encodeURIComponent(tx)+'&select=id,tracking&limit=1'))[0];if(!row)return;const old=row.tracking||{};if(old._payment?.paid_at)return;const valid=Number.isFinite(Date.parse(paidAt||''));const tracking={...old,_payment:{paid_at:valid?paidAt:new Date().toISOString(),date_source:valid?'gateway':'observed_confirmation'}};const saved=await request(env,'?id=eq.'+encodeURIComponent(row.id)+'&tracking='+(row.tracking==null?'is.null':'eq.'+encodeURIComponent(JSON.stringify(old)))+'&select=id','PATCH',{tracking});if(saved.length)return;}
}
export async function retryVideoVerdefy(env){
 if(!env.VERDEFY_SALES_TOKEN)return {configured:false};const recent=encodeURIComponent(new Date(Date.now()-48*3600000).toISOString());let processed=0,sent=0;
 for(const [kind,s,key] of [['pending','pix_gerado','_verdefy_pending'],['paid','pago','_verdefy'],['expired','expirado','_verdefy_expired'],['refunded','reembolsado','_verdefy_refund']]){const rows=await request(env,'?status=eq.'+s+'&created_at=gte.'+recent+'&and=(or(tracking->'+key+'->>state.is.null,tracking->'+key+'->>state.neq.sent),or(tracking->'+key+'->>retry_at.is.null,tracking->'+key+'->>retry_at.lte.'+encodeURIComponent(new Date().toISOString())+'))&select=id&order=created_at.asc&limit=2');for(const row of rows){processed++;const v=await deliverVideoVerdefy(env,row.id,kind).catch(()=>({state:'failed'}));if(v.state==='sent')sent++;}}
 return {configured:true,processed,sent};
}
