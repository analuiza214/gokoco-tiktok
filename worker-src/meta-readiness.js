export async function metaReadiness(env,send=fetch){
 const pixel=String(env.FB_PIXEL_ID||'1542362403143695').trim(),token=String(env.FB_ACCESS_TOKEN||'').trim();
 if(!token)return {configured:false,readAccess:false,reason:'missing_token'};
 if(!/^\d+$/.test(pixel))return {configured:true,readAccess:false,reason:'invalid_pixel'};
 try{const r=await send('https://graph.facebook.com/v25.0/'+pixel+'?fields=id',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});const d=await r.json();let tokenRecognized=null;if(!r.ok){try{const identity=await send('https://graph.facebook.com/v25.0/me?fields=id',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});const identityBody=await identity.json();tokenRecognized=identity.ok&&!!identityBody.id;}catch{}}return {configured:true,pixel,tokenRecognized,readAccess:r.ok&&String(d.id)===pixel,reason:r.ok&&String(d.id)===pixel?'pixel_read_verified':'meta_rejected',metaCode:Number(d.error?.code)||null,purchaseTested:false};}catch{return {configured:true,pixel,readAccess:false,reason:'unavailable',purchaseTested:false};}
}
