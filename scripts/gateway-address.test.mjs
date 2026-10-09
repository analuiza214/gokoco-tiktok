import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function provider(name, exportName) {
  const source = fs.readFileSync(new URL(`../worker-src/providers/${name}.js`, import.meta.url), 'utf8');
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return module[exportName];
}

const address = { street: 'Rua das Flores', number: '123', complement: 'Apto 4', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zipCode: '60000-000' };
const body = { amount: 37.90, name: 'Maria Silva', email: 'maria@example.com', phone: '85999999999', document: '52998224725', productName: 'Escova GOKOCO', address };
const env = { IRONPAY_API_TOKEN: 'test', IRONPAY_OFFER_HASH: 'offer', IRONPAY_PRODUCT_HASH: 'product', MASTERFY_API_KEY: 'test', UMBRELLAPAG_API_KEY: 'test', VENUS_PAY_SECRET_KEY: 'test' };

test('as quatro integrações recebem o endereço completo na cobrança PIX', async () => {
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), payload: JSON.parse(options.body) });
    return Response.json({});
  };
  try {
    const context = { env, request: new Request('https://store.example/api/public/pix/create') };
    const headers = { 'Content-Type': 'application/json' };
    await (await provider('ironpay', 'createPixIronpay'))(context, headers, body);
    await (await provider('masterfy', 'createPixMasterfy'))(context, headers, body);
    await (await provider('umbrellapag', 'createPixUmbrellapag'))(context, headers, body);
    await (await provider('venuspay', 'createPixVenuspay'))(context, headers, body);
  } finally { globalThis.fetch = oldFetch; }
  assert.equal(calls.length, 4);
  assert.deepEqual(Object.fromEntries(['street_name', 'number', 'complement', 'neighborhood', 'city', 'state', 'zip_code'].map((key) => [key, calls[0].payload.customer[key]])), {
    street_name: 'Rua das Flores', number: '123', complement: 'Apto 4', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip_code: '60000000',
  });
  assert.equal(calls[1].payload.delivery.address.street, address.street);
  assert.equal(calls[1].payload.delivery.address.zipCode, '60000000');
  assert.equal(calls[2].payload.customer.address.street, address.street);
  assert.equal(calls[2].payload.shipping.address.zipCode, '60000000');
  assert.equal(calls[3].payload.metadata.shipping_address.street, address.street);
  assert.equal(calls[3].payload.metadata.shipping_address.zip_code, '60000000');
});
