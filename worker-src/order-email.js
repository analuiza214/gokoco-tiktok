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

function brandedOrderEmail(title, content, code, settings) {
  const trackingUrl = `${settings.site}/rastreio.html?codigo=${encodeURIComponent(code || '')}`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;color:#24252b;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(title)} — novidades sobre seu pedido GOKOCO.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden">
<tr><td bgcolor="#17181f" style="padding:30px 28px;border-bottom:4px solid #ef3456"><a href="${escapeHtml(settings.site)}" style="color:#ffffff;text-decoration:none;font-size:28px;font-weight:800;letter-spacing:3px">GOKOCO<span style="color:#ff5976">.</span></a><p style="margin:9px 0 0;color:#d1d5db;font-size:12px;letter-spacing:1px">CUIDADO EM CADA DETALHE</p></td></tr>
<tr><td style="padding:32px 28px 12px"><p style="margin:0 0 12px;color:#c52646;font-size:11px;font-weight:bold;letter-spacing:1.5px">SOBRE SEU PEDIDO</p><h1 style="margin:0 0 24px;font-size:25px;line-height:1.3;color:#17181f;overflow-wrap:anywhere">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.75;color:#4b5563;overflow-wrap:anywhere;word-break:break-word">${content}</div></td></tr>
${code ? `<tr><td style="padding:12px 28px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fff2f5" style="border:1px solid #ffd6df;border-radius:12px"><tr><td align="center" style="padding:24px 16px"><p style="margin:0 0 10px;color:#9d2440;font-size:11px;font-weight:bold;letter-spacing:1.5px">SEU CÓDIGO DE RASTREIO</p><p style="margin:0 0 22px;font-family:Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:2px;color:#17181f;word-break:break-all">${escapeHtml(code)}</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#d92a4b" style="border-radius:8px;mso-padding-alt:15px 24px"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:15px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">Acompanhar meu pedido &rarr;</a></td></tr></table></td></tr></table></td></tr>` : ''}
<tr><td style="padding:22px 28px;border-top:1px solid #edf0f3;background-color:#fafafa"><p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#17181f">Conte com a gente.</p><p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280">Precisa de ajuda? Responda a este e-mail ou <a href="https://api.whatsapp.com/send?phone=5583993302240" style="color:#a72340;text-decoration:underline">fale com nosso atendimento</a>.</p></td></tr>
</table><p style="max-width:550px;margin:20px auto 0;color:#777e8b;font-size:11px;line-height:1.7;text-align:center">GOKOCO &bull; Atendimento ao cliente<br>Esta mensagem é referente ao seu pedido em nossa loja.</p>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
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
  const html = brandedOrderEmail(`Pagamento confirmado, ${firstName}!`, `<p style="margin:0 0 20px">Recebemos o pagamento da sua escova GOKOCO. Obrigado por escolher nossa loja!</p><p style="margin:0 0 16px">Queremos conhecer você melhor. Se quiser, responda a este e-mail contando:</p><ol style="padding-left:22px;margin:0 0 24px">${questions.map((question) => `<li style="margin-bottom:8px">${escapeHtml(question)}</li>`).join('')}</ol>`, code, settings);
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
    const date = order.tracking?.manualPayment?.paidAt || order.tracking?._purchase?.paid_at || order.tracking?._payment?.paid_at || paidAt || order.updated_at || order.created_at;
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

export async function sendManualOrderEmail(env, order, subject, message) {
  const settings = emailSettings(env);
  if (!settings) return { state: 'not_configured' };
  const recipient = emailText(order.email, 254);
  const title = emailText(subject, 150);
  const body = emailText(message, 5000);
  if (!emailAddress(recipient) || !title || !body) return { state: 'invalid_input' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `GOKOCO <${settings.from}>`, to: [recipient], reply_to: settings.replyTo,
      subject: title, text: body,
      html: brandedOrderEmail(title, `<p style="margin:0 0 20px">${escapeHtml(body).replace(/\r?\n/g, '<br>')}</p>`, order.status === 'paid' ? order.tracking?.shipping?.code : null, settings),
    }),
    signal: AbortSignal.timeout(12000),
  });
  const receipt = await response.json().catch(() => ({}));
  if (!response.ok || !receipt.id) return { state: 'failed' };
  return { state: 'sent', email_id: String(receipt.id) };
}
