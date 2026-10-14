// Envia uma única confirmação por pedido pago, usando o estado de rastreio já salvo.
const emailText = (value, limit = 300) => String(value || '').trim().slice(0, limit);
const emailAddress = (value) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const EMAIL_ACTIVATION_AT = Date.parse('2026-10-14T19:56:21Z');

function emailSettings(env) {
  const key = emailText(env.RESEND_API_KEY, 300);
  const from = emailText(env.RESEND_FROM_EMAIL, 254);
  let site;
  try { site = new URL(String(env.SITE_URL || '')); } catch { return null; }
  if (!key || !emailAddress(from) || site.protocol !== 'https:') return null;
  return { key, from, replyTo: from, start: EMAIL_ACTIVATION_AT, site: site.origin };
}

function composeEmail(order, code, settings) {
  const firstName = emailText(order.name, 100).split(/\s+/)[0] || 'cliente';
  const url = `${settings.site}/rastreio.html?codigo=${encodeURIComponent(code)}`;
  const questions = [
    'Por qual motivo você comprou com a gente?',
    'Gostou do nosso site?',
    'Gostou do meu atendimento?',
    'O que te chamou atenção para comprar pelo nosso anúncio e não pelo dos concorrentes?',
  ];
  const intro = `Olá, ${firstName}!\n\nSeu pagamento da escova GOKOCO foi confirmado. Seu código de rastreio é ${code}.\nAcompanhe seu pedido: ${url}\n\nPosso te fazer algumas perguntas simples para nos ajudar a entender melhor nossos clientes? Se quiser, responda diretamente a este e-mail:\n\n`;
  const text = intro + questions.map((question, index) => `${index + 1}. ${question}`).join('\n') + '\n\nObrigado por comprar com a gente!\nEquipe GOKOCO';
  const html = `<div style="max-width:560px;margin:auto;font-family:Arial,sans-serif;color:#17212b;line-height:1.55"><h1 style="font-size:22px">Pagamento confirmado, ${escapeHtml(firstName)}!</h1><p>Seu código de rastreio da escova GOKOCO é:</p><p style="font-size:22px;font-weight:700;letter-spacing:1px">${escapeHtml(code)}</p><p><a href="${escapeHtml(url)}" style="color:#047857;font-weight:700">Acompanhar meu pedido</a></p><p>Posso te fazer algumas perguntas simples para nos ajudar a entender melhor nossos clientes? Se quiser, responda diretamente a este e-mail:</p><ol>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol><p>Obrigado por comprar com a gente!<br>Equipe GOKOCO</p></div>`;
  return { from: `GOKOCO <${settings.from}>`, to: [emailText(order.email, 254)], reply_to: settings.replyTo, subject: `Seu pedido GOKOCO foi confirmado · rastreio ${code}`, text, html };
}

async function swapEmailState(db, env, order, tracking) {
  const query = `?id=eq.${encodeURIComponent(order.id)}&status=eq.paid&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=*`;
  const rows = await db(env, 'gokoco_orders', query, 'PATCH', { tracking });
  return rows?.[0] || null;
}

export async function deliverPaidEmail(env, db, orderId, paidAt) {
  const settings = emailSettings(env);
  if (!settings) return { state: 'not_configured' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(orderId)}&status=eq.paid&select=*&limit=1`);
    const order = rows?.[0];
    if (!order) return { state: 'not_paid' };
    if (order.tracking?.manualExternal) return { state: 'external_tracking' };
    const code = emailText(order.tracking?.shipping?.code, 40);
    if (!/^[A-Z0-9]{8,40}$/.test(code)) return { state: 'tracking_pending' };
    if (!emailAddress(String(order.email || ''))) return { state: 'invalid_email' };
    const date = order.tracking?.manualPayment?.paidAt || order.tracking?._purchase?.paid_at || paidAt || order.updated_at || order.created_at;
    if (!Number.isFinite(Date.parse(date)) || Date.parse(date) < settings.start) return { state: 'before_activation' };
    const prior = order.tracking?._email || {};
    if (prior.state === 'sent') return { state: 'sent', sent_at: prior.sent_at, email_id: prior.email_id };
    if (prior.state === 'sending' && Date.parse(prior.lease_until) > Date.now()) return { state: 'sending' };
    if (Date.parse(prior.retry_at) > Date.now()) return { state: 'retry_pending' };
    const claim = crypto.randomUUID();
    const sending = { state: 'sending', claim, attempts: (Number(prior.attempts) || 0) + 1, lease_until: new Date(Date.now() + 120000).toISOString() };
    const tracking = { ...order.tracking, _email: sending };
    const claimed = await swapEmailState(db, env, order, tracking);
    if (!claimed) continue;
    let result;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `gokoco-paid-${order.id}` },
        body: JSON.stringify(composeEmail(claimed, code, settings)),
        signal: AbortSignal.timeout(12000),
      });
      const receipt = await response.json().catch(() => ({}));
      if (!response.ok || !receipt.id) throw new Error(`Resend não confirmou o envio (HTTP ${response.status}).`);
      result = { state: 'sent', claim, attempts: sending.attempts, sent_at: new Date().toISOString(), email_id: String(receipt.id) };
    } catch (error) {
      result = { state: 'failed', claim, attempts: sending.attempts, retry_at: new Date(Date.now() + 60000).toISOString(), error: error.name === 'TimeoutError' ? 'Tempo limite ao enviar o e-mail.' : emailText(error.message, 160) };
      console.error('[order-email]', order.id, result.error);
    }
    const completed = await swapEmailState(db, env, claimed, { ...tracking, _email: result });
    if (!completed) throw new Error('Não foi possível registrar o resultado do envio do e-mail.');
    return result;
  }
  return { state: 'busy' };
}

export async function retryPaidEmails(env, db, limit = 1) {
  const settings = emailSettings(env);
  if (!settings) return { configured: false, processed: 0 };
  const path = 'tracking->_email->>state';
  const codePath = encodeURIComponent('tracking->shipping->>code');
  const rows = await db(env, 'gokoco_orders', `?status=eq.paid&gateway=neq.manual_tracking&${codePath}=not.is.null&updated_at=gte.${encodeURIComponent(new Date(settings.start).toISOString())}&or=(${path}.is.null,${path}.neq.sent)&select=id&order=created_at.desc&limit=${Math.max(1, Math.min(3, limit))}`);
  const results = await Promise.allSettled(rows.map((order) => deliverPaidEmail(env, db, order.id)));
  return { configured: true, processed: rows.length, sent: results.filter((r) => r.status === 'fulfilled' && r.value.state === 'sent').length, failed: results.filter((r) => r.status === 'rejected' || r.value?.state === 'failed').length };
}
