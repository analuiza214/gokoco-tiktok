// Cada lote executa em uma requisição própria para respeitar o limite do Pages.
export default {
  async scheduled(_event, env) {
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET não configurado.');
    const summary = { checked: 0, paid: 0, failed: 0 };
    const call = async (path) => {
      const response = await fetch(`https://gokoco-tiktok.pages.dev${path}`, {
        method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`Reconciliação respondeu HTTP ${response.status}.`);
      return response.json();
    };
    for (let batch = 0; batch < 5; batch++) {
      const result = await call('/api/admin/reconcile-payments');
      summary.checked += result.checked || 0;
      summary.paid += result.paid || 0;
      summary.failed += result.failed || 0;
      if (result.checked < 10) break;
    }
    const queue = await call('/api/process-purchase-queue?phase=fulfillment');
    const recovery = await call('/api/process-purchase-queue?phase=recovery');
    console.log('Payment reconciliation completed', { ...summary, queue, recovery });
    if (summary.failed) console.error('Falhas temporárias de consulta ao gateway', { failed: summary.failed });
  },
  fetch() { return Response.json({ service: 'gokoco-payment-reconciler', ok: true }); },
};
