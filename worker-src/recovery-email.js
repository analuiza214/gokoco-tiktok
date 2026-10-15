// Recuperação de PIX não pago: até três mensagens por cliente, com estado no pedido.
const RECOVERY_ACTIVATION_AT = '2026-10-14T22:28:59Z';
const RECOVERY_DELAYS = [30 * 60000, 4 * 3600000, 24 * 3600000];
const recoveryText = (value, limit = 200) => String(value || '').trim().slice(0, limit);
const recoveryEmail = (value) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const recoveryHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

function recoverySettings(env) {
  const key = recoveryText(env.RESEND_API_KEY, 300);
  const from = recoveryText(env.RESEND_FROM_EMAIL, 254);
  let site;
  try { site = new URL(String(env.SITE_URL || '')); } catch { return null; }
  if (!key || !recoveryEmail(from) || site.protocol !== 'https:') return null;
  return { key, from, site: site.origin };
}

function recoveryMessage(order, number, settings) {
  const name = recoveryText(order.name, 100).split(/\s+/)[0] || 'cliente';
  const items = Array.isArray(order.products) ? order.products.map((item) => recoveryText(item.name, 120)).filter(Boolean).join(', ') : '';
  const amount = Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const link = `${settings.site}/?utm_source=recovery&utm_medium=email&utm_campaign=email${number}`;
  const messages = [
    `Seu PIX foi gerado, mas ainda não identificamos o pagamento. Se quiser concluir a compra da sua escova GOKOCO, acesse a loja. Caso já tenha pago, desconsidere esta mensagem.`,
    `Seu pedido da escova GOKOCO ainda aparece sem pagamento confirmado. Você pode voltar à loja para concluir a compra. Caso já tenha pago, desconsidere esta mensagem.`,
    `Este é nosso último lembrete sobre o pedido da escova GOKOCO que ainda aparece sem pagamento confirmado. Se quiser, você pode concluir a compra na loja. Caso já tenha pago, desconsidere esta mensagem.`,
  ];
  const subject = [`Seu pedido GOKOCO ainda está aguardando pagamento`, `Ainda quer sua escova GOKOCO?`, `Último lembrete sobre seu pedido GOKOCO`][number - 1];
  const body = messages[number - 1];
  const text = `Olá, ${name}!\n\n${body}\n\n${items ? `Produto: ${items}\n` : ''}Valor do pedido: ${amount}\n\nVoltar à loja: ${link}\n\nEquipe GOKOCO`;
  const html = `<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#17212b;line-height:1.6"><h1 style="font-size:22px">Olá, ${recoveryHtml(name)}!</h1><p>${recoveryHtml(body)}</p>${items ? `<p><strong>Produto:</strong> ${recoveryHtml(items)}</p>` : ''}<p><strong>Valor do pedido:</strong> ${recoveryHtml(amount)}</p><p><a href="${recoveryHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#15803d;color:#fff;text-decoration:none;font-weight:bold">Voltar à loja</a></p><p>Equipe GOKOCO</p></div>`;
  return { from: `GOKOCO <${settings.from}>`, to: [order.email], reply_to: settings.from, subject, text, html };
}

async function recoverySwap(db, env, order, state) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db(env, 'gokoco_orders', query, 'PATCH', { tracking: { ...(order.tracking || {}), _recovery: state } });
  return rows?.[0] || null;
}

async function stopRecovery(db, env, order, count, reason) {
  await recoverySwap(db, env, order, { ...(order.tracking?._recovery || {}), count, state: 'stopped', reason });
  return { state: reason, count };
}

export async function processRecoveryOrder(env, db, verifyPayment, orderId, now = Date.now()) {
  const settings = recoverySettings(env);
  if (!settings) return { state: 'not_configured' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`);
    const order = rows?.[0];
    if (!order || order.status !== 'pending' || !order.transaction_id || order.gateway === 'manual_tracking') return { state: 'not_pending' };
    const email = recoveryText(order.email, 254).toLowerCase();
    if (!recoveryEmail(email)) return { state: 'invalid_email' };
    if (Date.parse(order.created_at) < Date.parse(RECOVERY_ACTIVATION_AT)) return { state: 'before_activation' };
    const prior = order.tracking?._recovery || {};
    const count = Number(prior.count) || 0;
    if (count >= 3 || prior.state === 'stopped') return { state: prior.state || 'complete', count };
    const dueAt = count ? Date.parse(prior.next_at) : Date.parse(order.created_at) + RECOVERY_DELAYS[0];
    if (!Number.isFinite(dueAt) || dueAt > now) return { state: 'scheduled', count };
    if (prior.state === 'sending' && Date.parse(prior.lease_until) > now) return { state: 'sending', count };
    if (Date.parse(prior.retry_at) > now) return { state: 'retry_pending', count };

    // Um cliente com outro pedido já pago ou em recuperação não recebe nova sequência.
    const paid = await db(env, 'gokoco_orders', `?email=eq.${encodeURIComponent(email)}&status=eq.paid&select=id&limit=1`);
    if (paid?.length) return stopRecovery(db, env, order, count, 'customer_paid');
    if (!count) {
      const latest = await db(env, 'gokoco_orders', `?email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id&order=created_at.desc&limit=1`);
      if (latest?.[0]?.id !== order.id) return stopRecovery(db, env, order, count, 'newer_order');
      const others = await db(env, 'gokoco_orders', `?email=eq.${encodeURIComponent(email)}&id=neq.${encodeURIComponent(order.id)}&tracking->_recovery->>count=gte.1&select=id&limit=1`);
      if (others?.length) return stopRecovery(db, env, order, count, 'already_contacted');
    }

    // O banco pode ainda dizer pendente quando o gateway já recebeu o PIX.
    const payment = await verifyPayment(env, order.transaction_id, order.gateway);
    if (payment.isPaid || payment.isRefunded || payment.isExpired) return stopRecovery(db, env, order, count, 'payment_changed');
    const number = count + 1;
    const sending = { ...prior, count, state: 'sending', number, claim: crypto.randomUUID(), lease_until: new Date(now + 120000).toISOString() };
    const claimed = await recoverySwap(db, env, order, sending);
    if (!claimed) continue;
    const stillPending = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&status=eq.pending&select=id&limit=1`);
    if (!stillPending?.length) return { state: 'payment_changed', count };
    let result;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `gokoco-recovery-${order.id}-${number}` },
        body: JSON.stringify(recoveryMessage(claimed, number, settings)),
        signal: AbortSignal.timeout(12000),
      });
      const receipt = await response.json().catch(() => ({}));
      if (!response.ok || !receipt.id) throw new Error(`Resend não confirmou o envio (HTTP ${response.status}).`);
      result = { count: number, state: number === 3 ? 'complete' : 'scheduled', sent: [...(Array.isArray(prior.sent) ? prior.sent : []), { number, at: new Date(now).toISOString(), id: String(receipt.id) }], next_at: number < 3 ? new Date(now + RECOVERY_DELAYS[number]).toISOString() : null };
    } catch (error) {
      result = { ...prior, count, state: 'failed', retry_at: new Date(now + 30 * 60000).toISOString(), error: recoveryText(error.message, 160) };
      console.error('[recovery-email]', order.id, result.error);
    }
    const completed = await recoverySwap(db, env, claimed, result);
    if (!completed) throw new Error('Não foi possível registrar o resultado da recuperação.');
    return { state: result.state, count: result.count, sent: result.state !== 'failed' };
  }
  return { state: 'busy' };
}

export async function processRecoveryQueue(env, db, verifyPayment, limit = 3) {
  if (!recoverySettings(env)) return { configured: false, processed: 0 };
  const now = Date.now();
  const cutoff = new Date(now - RECOVERY_DELAYS[0]).toISOString();
  const size = Math.max(1, Math.min(3, limit));
  const base = `?status=eq.pending&gateway=neq.manual_tracking&created_at=gte.${encodeURIComponent(RECOVERY_ACTIVATION_AT)}&created_at=lte.${encodeURIComponent(cutoff)}`;
  const [newOrders, followups] = await Promise.all([
    db(env, 'gokoco_orders', `${base}&or=(tracking->_recovery.is.null,tracking->_recovery->>state.eq.failed,tracking->_recovery->>state.eq.sending)&or=(tracking->_recovery->>count.is.null,tracking->_recovery->>count.eq.0)&select=id&order=created_at.desc&limit=${size}`),
    db(env, 'gokoco_orders', `${base}&tracking->_recovery->>count=gte.1&tracking->_recovery->>count=lte.2&tracking->_recovery->>state=neq.stopped&tracking->_recovery->>next_at=lte.${encodeURIComponent(new Date(now).toISOString())}&select=id&order=created_at.asc&limit=${size}`),
  ]);
  const rows = [...followups, ...newOrders].slice(0, size);
  const results = await Promise.allSettled(rows.map((order) => processRecoveryOrder(env, db, verifyPayment, order.id, now)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === 'fulfilled' && r.value.sent).length, failed: results.filter((r) => r.status === 'rejected' || r.value?.state === 'failed').length };
}
