import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../worker-src/order-email.js', import.meta.url), 'utf8');
const { deliverPaidEmail, sendManualOrderEmail } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const copy = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  let order = {
    id: 'order-123', status: 'paid', name: 'Maria Silva', email: 'maria@example.com',
    created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:30:00Z',
    tracking: { shipping: { code: 'GK1234567890' }, _purchase: { paid_at: '2026-10-15T12:30:00Z' } },
  };
  const env = {
    RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'pedidos@gokoco.example',
    SITE_URL: 'https://loja.example',
  };
  const db = async (_env, _table, query, method, body) => {
    const params = new URLSearchParams(query.slice(1));
    if (params.get('status') === 'eq.paid' && order.status !== 'paid') return [];
    if (method !== 'PATCH') return [copy(order)];
    const expected = JSON.parse(params.get('tracking').slice(3));
    if (JSON.stringify(expected) !== JSON.stringify(order.tracking)) return [];
    order = { ...order, ...copy(body) };
    return [copy(order)];
  };
  return { env, db, get order() { return order; }, set order(value) { order = value; } };
}

test('só envia e-mail de pedido pago com rastreio e configuração completa', async () => {
  const f = fixture();
  assert.equal((await deliverPaidEmail({}, f.db, f.order.id)).state, 'not_configured');
  f.order.status = 'pending';
  assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'not_paid');
  f.order.status = 'paid'; delete f.order.tracking.shipping;
  assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'tracking_pending');
  f.order.tracking.shipping = { code: 'GK1234567890' };
  f.order.tracking._purchase.paid_at = '2026-10-14T19:00:00Z';
  assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'before_activation');
});

test('envia uma vez, com link de rastreio, perguntas e endereço de resposta', async () => {
  const f = fixture(), sent = []; const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    sent.push({ url, options, payload: JSON.parse(options.body) });
    return Response.json({ id: 'email-123' });
  };
  try {
    await Promise.all(Array.from({ length: 4 }, () => deliverPaidEmail(f.env, f.db, f.order.id)));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.resend.com/emails');
    assert.equal(sent[0].options.headers['Idempotency-Key'], 'gokoco-paid-order-123');
    assert.equal(sent[0].payload.to[0], 'maria@example.com');
    assert.equal(sent[0].payload.reply_to, 'pedidos@gokoco.example');
    assert.match(sent[0].payload.text, /GK1234567890/);
    assert.match(sent[0].payload.text, /https:\/\/loja.example\/rastreio.html\?codigo=GK1234567890/);
    assert.match(sent[0].payload.text, /Por qual motivo você comprou com a gente\?/);
    assert.match(sent[0].payload.text, /Gostou do meu atendimento\?/);
    assert.equal(f.order.tracking._email.state, 'sent');
    assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'sent');
    assert.equal(sent.length, 1);
  } finally { globalThis.fetch = original; }
});

test('falha do Resend não marca enviado e pode ser repetida com a mesma chave', async () => {
  const f = fixture(), sent = []; const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    sent.push(options.headers['Idempotency-Key']);
    return sent.length === 1 ? Response.json({ message: 'erro' }, { status: 503 }) : Response.json({ id: 'email-456' });
  };
  try {
    assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'failed');
    assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'retry_pending');
    f.order.tracking._email.retry_at = '2000-01-01T00:00:00Z';
    assert.equal((await deliverPaidEmail(f.env, f.db, f.order.id)).state, 'sent');
    assert.deepEqual(sent, ['gokoco-paid-order-123', 'gokoco-paid-order-123']);
  } finally { globalThis.fetch = original; }
});

test('envio manual usa o e-mail do pedido e escapa conteúdo HTML', async () => {
  const f = fixture(), sent = []; const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return Response.json({ id: 'manual-123' }); };
  try {
    const result = await sendManualOrderEmail(f.env, f.order, 'Sobre o pedido', 'Olá <cliente>!');
    assert.equal(result.state, 'sent');
    assert.deepEqual(sent[0].to, ['maria@example.com']);
    assert.equal(sent[0].subject, 'Sobre o pedido');
    assert.equal(sent[0].text, 'Olá <cliente>!');
    assert.match(sent[0].html, /&lt;cliente&gt;/);
    assert.equal((await sendManualOrderEmail(f.env, { email: '' }, 'Assunto', 'Mensagem')).state, 'invalid_input');
  } finally { globalThis.fetch = original; }
});
