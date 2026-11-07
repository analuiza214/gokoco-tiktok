// Cada lote executa em uma requisição própria para respeitar o limite do Pages.
export default {
  async scheduled(_event, env) {
    if (!env.SITE_URL) throw new Error('SITE_URL não configurado.');
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET não configurado.');
    const summary = { checked: 0, paid: 0, failed: 0 };
    let rateLimited = false;
    const call = async (path) => {
      const response = await fetch(`${String(env.SITE_URL).replace(/\/+$/, '')}${path}`, {
        method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`Reconciliação respondeu HTTP ${response.status}.`);
      return response.json();
    };
    // Espelho independente: falhas de entrega/gateway n�o bloqueiam o painel.
    await call('/api/process-purchase-queue?phase=verdefy').catch(error=>console.error('Verdefy sync failed',error.message));
    for (let batch = 0; batch < 5; batch++) {
      const result = await call('/api/admin/reconcile-payments');
      summary.checked += result.checked || 0;
      summary.paid += result.paid || 0;
      summary.failed += result.failed || 0;
      if (result.rateLimited) { rateLimited = true; break; }
      if (result.checked < 3) break;
    }
    const queue = await call('/api/process-purchase-queue?phase=fulfillment');
    const recovery = rateLimited ? null : await call('/api/process-purchase-queue?phase=recovery');
    // A loja Vídeo tem reconcile próprio; uma passada por minuto basta.
    const bella = await call('/video/api/reconcile-payments').catch((error) => ({ error: error.message }));
    console.log('Payment reconciliation completed', { ...summary, queue, recovery, bella });
    if (summary.failed) console.error('Falhas temporárias de consulta ao gateway', { failed: summary.failed });
  },
  async fetch(request,env) {
    if(new URL(request.url).pathname==='/connection'){if(request.method!=='GET'||!env.CRON_SECRET||request.headers.get('x-cron-secret')!==env.CRON_SECRET)return Response.json({ok:false},{status:401,headers:{'Cache-Control':'no-store'}});return Response.json({ok:true,target:env.SITE_URL||null},{headers:{'Cache-Control':'no-store'}});}
    return Response.json({ service: 'gokoco-payment-reconciler', ok: true });
  },
};
