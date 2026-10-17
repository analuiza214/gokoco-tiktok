import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../reconciler/worker.js';

test('rotina percorre novos lotes de PIX e executa as filas', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ path: new URL(url).pathname + new URL(url).search, secret: options.headers['x-cron-secret'] });
    return Response.json(calls.length <= 2 ? { checked: 3, paid: 1 } : { checked: 1, paid: 0 });
  };
  try {
    await worker.scheduled({}, { CRON_SECRET: 'test-secret' });
  } finally { globalThis.fetch = originalFetch; }
  assert.deepEqual(calls.map((call) => call.path), [
    '/api/admin/reconcile-payments', '/api/admin/reconcile-payments', '/api/admin/reconcile-payments',
    '/api/process-purchase-queue?phase=fulfillment', '/api/process-purchase-queue?phase=recovery',
  ]);
  assert.ok(calls.every((call) => call.secret === 'test-secret'));
});

test('rotina para de consultar o gateway ao receber limite de consultas', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(url).pathname);
    return Response.json({ checked: 1, failed: 1, rateLimited: true });
  };
  const originalError = console.error; console.error = () => {};
  try {
    await worker.scheduled({}, { CRON_SECRET: 'test-secret' });
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  assert.equal(calls.filter((path) => path === '/api/admin/reconcile-payments').length, 1);
  assert.equal(calls.includes('/api/process-purchase-queue'), true);
  assert.equal(calls.length, 2);
});
