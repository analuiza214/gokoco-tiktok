import assert from 'node:assert/strict';
import { createPixInvictuspay, statusPixInvictuspay } from '../worker-src/providers/invictuspay.js';
const env = { INVICTUSPAY_API_KEY: 'test-only' };
const context = { env, request: new Request('https://shop.example/video/api/pix/create') };
const body = { amount: 37.91, name: 'Teste', email: 'teste@example.com', document: '12345678909', phone: '11999999999', reference: 'order-test' };
const originalFetch = globalThis.fetch;
let count = 0;
try {
  globalThis.fetch = async (url, options) => {
    count++;
    assert.equal(url, 'https://api.invictuspayv2.com.br/api/v1/transactions');
    assert.equal(options.headers['X-Api-Key'], env.INVICTUSPAY_API_KEY);
    const payload = JSON.parse(options.body);
    assert.equal(payload.amount, 3791);
    assert.equal(payload.items.reduce((sum, item) => sum + item.amount, 0), payload.amount);
    assert.equal(payload.items[0].externalRef, body.reference);
    assert.equal(payload.postbackUrl, 'https://shop.example/video/api/pix/webhook');
    return Response.json({ transaction: { id: 'tx-test', pix: { qrcode: '000201-test' } } });
  };
  const created = await createPixInvictuspay(context, {}, body);
  assert.equal(created.status, 200);
  assert.equal((await created.json()).transactionId, 'tx-test');
  assert.equal((await createPixInvictuspay(context, {}, { ...body, amount: NaN })).status, 400);
  assert.equal(count, 1);
  assert.equal((await createPixInvictuspay({ env: {} }, {}, body)).status, 503);
  globalThis.fetch = async () => Response.json({ id: 'tx-test', status: 'paid', paid_at: '2026-10-28T12:00:00Z' });
  assert.equal((await (await statusPixInvictuspay(context, {}, 'tx-test')).json()).isPaid, true);
  globalThis.fetch = async () => Response.json({ id: 'different', status: 'paid' });
  assert.equal((await statusPixInvictuspay(context, {}, 'tx-test')).status, 502);
  globalThis.fetch = async () => Response.json({ id: 'tx-test', status: 'unknown' });
  assert.equal((await statusPixInvictuspay(context, {}, 'tx-test')).status, 502);
  globalThis.fetch = async () => Response.json({ id: 'tx-test' });
  assert.equal((await createPixInvictuspay(context, {}, body)).status, 502);
  globalThis.fetch = async () => { throw new Error('timeout'); };
  assert.equal((await statusPixInvictuspay(context, {}, 'tx-test')).status, 502);
  console.log('InvictusPay: validação, payload, consulta e falhas passaram (API simulada).');
} finally { globalThis.fetch = originalFetch; }
