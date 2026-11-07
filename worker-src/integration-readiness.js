import {verdefyToken} from './verdefy-sales.js';
import {verifyAdminToken} from './admin-auth.js';
import {purchaseDestination} from './purchase-tracking.js';
import {listGateways,getActivePixGateway} from '../sites/bella/functions/_lib/gateway-config.js';
export async function integrationReadiness(request,env){
 const headers={'Cache-Control':'no-store'};if(!(await verifyAdminToken(request,env)).valid)return Response.json({error:'Não autorizado.'},{status:401,headers});
 if(request.method!=='GET')return Response.json({error:'Método inválido.'},{status:405,headers});
 let database=false,gateways=[],activeGateway=null,receiver={authorized:false},cron={authorized:false,targetMatches:false};
 try{gateways=await listGateways(env);activeGateway=await getActivePixGateway(env);const r=await fetch(String(env.SUPABASE_URL||'').trim().replace(/\/+$/,'')+'/rest/v1/gokoco_orders?select=id&limit=1',{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(12000)});database=r.ok;await r.text();}catch{}
 if(env.VERDEFY_SALES_TOKEN){try{const r=await fetch('https://verdefy-sales.loja-oficial.workers.dev/v1/connection',{headers:{Authorization:'Bearer '+verdefyToken(env)},signal:AbortSignal.timeout(12000)});const d=await r.json();receiver={status:r.status,tokenFormat:/^vfy_[a-f0-9]{64}$/.test(verdefyToken(env))?'generated':'legacy_or_invalid',authorized:r.ok&&d.ok===true,sourceMatches:d.source===String(env.VERDEFY_SALES_SOURCE||'gokoco').trim()};}catch{}}
 if(env.CRON_SECRET){try{const r=await fetch('https://gokoco-payment-reconciler.loja-oficial.workers.dev/connection',{headers:{'x-cron-secret':env.CRON_SECRET},signal:AbortSignal.timeout(12000)});const d=await r.json();cron={authorized:r.ok&&d.ok===true,targetMatches:d.target===String(env.SITE_URL||'').replace(/\/+$/,'')};}catch{}}
 return Response.json({database,cron,activeGateway,gateways:gateways.map(g=>({name:g.name,enabled:g.enabled,configured:g.configured})),receiver,destination:purchaseDestination(env),loginConfigured:!!(env.ADMIN_USER&&env.ADMIN_PASS&&env.ADMIN_SESSION_SECRET),noEventsSent:true},{headers});
}
