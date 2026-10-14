import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../worker-src/recovery-email.js', import.meta.url), 'utf8');
const { processRecoveryOrder } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const copy = (value) => JSON.parse(JSON.stringify(value));
const firstDue = Date.parse('2026-10-15T12:31:00Z');

function fixture() {
  let order = { id: 'order-1', status: 'pending', transaction_id: 'pix-1', gateway: 'ironpay', name: 'Maria Silva', email: 'maria@example.com', amount: 37.9, products: [{ name: 'Escova GOKOCO', quantity: 1 }], created_at: '2026-10-15T12:00:00Z', tracking: {} };
  const env = { RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'pedidos@gokoco.example', SITE_URL: 'https://loja.example' };
  let gatewayPaid = false;
  const db = async (_env, _table, query, method, body) => {
    const params = new URLSearchParams(query.slice(1));
    if (params.get('status') === 'eq.paid') return gatewayPaid ? [{ id: order.id }] : [];
    if (params.get('id')?.startsWith('neq.')) return [];
    if (params.get('id')?.startsWith('eq.') && params.get('id') !== 'eq.' + order.id) return [];
    if (params.get('status') === 'eq.pending' && order.status !== 'pending') return [];
    if (method === 'PATCH') {
      const expected = JSON.parse(params.get('tracking').slice(3));
      if (JSON.stringify(expected) !== JSON.stringify(order.tracking)) return [];
      order = { ...order, ...copy(body) };
    }
    return [copy(order)];
  };
  const verify = async () => ({ isPaid: gatewayPaid });
  return { env, db, verify, get order() { return order; }, set gatewayPaid(value) { gatewayPaid = value; } };
}

test('só inicia após 30 minutos e envia no máximo três e-mails, sem duplicação', async () => {
  const f = fixture(), sent = [], original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { sent.push({ key: options.headers['Idempotency-Key'], mail: JSON.parse(options.body) }); return Response.json({ id: `email-${sent.length}` }); };
  try {
    assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue - 120000)).state, 'scheduled');
    await Promise.all(Array.from({ length: 3 }, () => processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue)));
    assert.equal(sent.length, 1);
    assert.equal(f.order.tracking._recovery.count, 1);
    assert.match(sent[0].mail.text, /escova GOKOCO/i);
    assert.equal(sent[0].mail.reply_to, 'pedidos@gokoco.example');
    const second = Date.parse(f.order.tracking._recovery.next_at);
    assert.equal(second, firstDue + 4 * 3600000);
    assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, second - 1)).state, 'scheduled');
    await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, second);
    assert.equal(sent.length, 2);
    const third = Date.parse(f.order.tracking._recovery.next_at);
    assert.equal(third, second + 24 * 3600000);
    await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, third);
    assert.equal(sent.length, 3);
    assert.equal(f.order.tracking._recovery.count, 3);
    assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, third + 86400000)).state, 'complete');
    assert.deepEqual(sent.map((entry) => entry.key), ['gokoco-recovery-order-1-1', 'gokoco-recovery-order-1-2', 'gokoco-recovery-order-1-3']);
    assert.equal(sent.length, 3);
  } finally { globalThis.fetch = original; }
});

test('pagamento no gateway interrompe a recuperação mesmo se o banco ainda disser pendente', async () => {
  const f = fixture(); f.gatewayPaid = true;
  assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue)).state, 'customer_paid');
  assert.equal(f.order.tracking._recovery.state, 'stopped');
});

test('pedidos anteriores à ativação não recebem recuperação', async () => {
  const f = fixture();
  f.order.created_at = '2026-10-14T20:00:00Z';
  assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue)).state, 'before_activation');
});

test('falha do Resend não conta como enviado e pode ser repetida com a mesma chave', async () => {
  const f = fixture(), sent = [], original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { sent.push(options.headers['Idempotency-Key']); return sent.length === 1 ? Response.json({ message: 'erro' }, { status: 503 }) : Response.json({ id: 'email-ok' }); };
  try {
    assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue)).state, 'failed');
    assert.equal(f.order.tracking._recovery.count, 0);
    assert.equal((await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue + 1000)).state, 'retry_pending');
    await processRecoveryOrder(f.env, f.db, f.verify, f.order.id, firstDue + 30 * 60000);
    assert.equal(f.order.tracking._recovery.count, 1);
    assert.deepEqual(sent, ['gokoco-recovery-order-1-1', 'gokoco-recovery-order-1-1']);
  } finally { globalThis.fetch = original; }
});
