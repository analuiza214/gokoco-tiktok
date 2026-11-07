import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../reconciler/worker.js';

test('rotina percorre novos lotes de PIX e executa as filas', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, 'https://store.example');
    calls.push({ path: new URL(url).pathname + new URL(url).search, secret: options.headers['x-cron-secret'] });
    return Response.json(calls.filter(c=>c.path==='/api/admin/reconcile-payments').length <= 2 ? { checked: 3, paid: 1 } : { checked: 1, paid: 0 });
  };
  try {
    await worker.scheduled({}, { CRON_SECRET: 'test-secret', SITE_URL: 'https://store.example' });
  } finally { globalThis.fetch = originalFetch; }
  assert.deepEqual(calls.map((call) => call.path), [
    '/api/process-purchase-queue?phase=verdefy',
    '/api/admin/reconcile-payments', '/api/admin/reconcile-payments', '/api/admin/reconcile-payments',
    '/api/process-purchase-queue?phase=fulfillment', '/api/process-purchase-queue?phase=recovery', '/video/api/reconcile-payments',
  ]);
  assert.ok(calls.every((call) => call.secret === 'test-secret'));
});

test('rotina para de consultar o gateway ao receber limite de consultas', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).origin, 'https://store.example');
    calls.push(new URL(url).pathname);
    return Response.json({ checked: 1, failed: 1, rateLimited: true });
  };
  const originalError = console.error; console.error = () => {};
  try {
    await worker.scheduled({}, { CRON_SECRET: 'test-secret', SITE_URL: 'https://store.example' });
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  assert.equal(calls.filter((path) => path === '/api/admin/reconcile-payments').length, 1);
  assert.equal(calls.includes('/api/process-purchase-queue'), true);
  assert.equal(calls.length, 4);
});

test('rotina sem SITE_URL não consulta nenhum servidor', async () => {
  const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('não deve chamar');};
  try {await assert.rejects(()=>worker.scheduled({}, {CRON_SECRET:'isolated-only'}), /SITE_URL/);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});

test('verificação privada do cron confirma destino sem rodar a fila',async()=>{const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('não deve chamar');};try{const url='https://cron.invalid/connection';assert.equal((await worker.fetch(new Request(url),{CRON_SECRET:'isolated'})).status,401);const r=await worker.fetch(new Request(url,{headers:{'x-cron-secret':'isolated'}}),{CRON_SECRET:'isolated',SITE_URL:'https://store.invalid'});assert.equal(r.status,200);assert.equal((await r.json()).target,'https://store.invalid');assert.equal(calls,0);}finally{globalThis.fetch=old;}});
