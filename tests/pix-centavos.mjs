import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('nextPixAmount gera valor entre 1 e 5 centavos acima do valor base e nunca o valor cheio', async () => {
  const source = fs.readFileSync(new URL('../worker-src/index.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('async function nextPixAmount('), source.indexOf('async function db('));
  
  let dbRows = [];
  const fakeDb = async () => dbRows;
  const context = { db: fakeDb, Math, Array, Number };
  const nextPixAmount = vm.runInNewContext(code + ';nextPixAmount', context);

  const basePrice = 37.90;
  const expectedSet = new Set([37.91, 37.92, 37.93, 37.94, 37.95]);

  // Test 1: 100 execuções aleatórias sem pedido anterior
  const generatedAmounts = new Set();
  for (let i = 0; i < 100; i++) {
    const amt = await nextPixAmount({}, basePrice);
    assert.ok(expectedSet.has(amt), `Valor ${amt} não está no intervalo esperado (37.91 a 37.95)`);
    assert.notEqual(amt, 37.90, 'Valor não pode ser o valor cheio original');
    generatedAmounts.add(amt);
  }
  // Deve ter variado entre as opções possíveis (pelo menos 3 diferentes em 100 sorteios)
  assert.ok(generatedAmounts.size >= 3, `Deveria ter gerado valores variados, mas gerou apenas ${[...generatedAmounts]}`);

  // Test 2: Com pedido anterior (offset = 3 centavos -> 37.93)
  dbRows = [{ amount: '37.93' }];
  for (let i = 0; i < 50; i++) {
    const amt = await nextPixAmount({}, basePrice);
    assert.ok(expectedSet.has(amt));
    assert.notEqual(amt, 37.93, 'Não deve repetir o offset anterior imediatamente');
  }

  // Test 3: Quando o banco falha / lança erro
  context.db = async () => { throw new Error('DB connection failed'); };
  const fallbackNextPixAmount = vm.runInNewContext(code + ';nextPixAmount', context);
  for (let i = 0; i < 20; i++) {
    const amt = await fallbackNextPixAmount({}, basePrice);
    assert.ok(expectedSet.has(amt));
    assert.notEqual(amt, 37.90);
  }
});

test('end-to-end /api/public/pix/create aplica variacao de 1 a 5 centavos', async () => {
  const workerModule = await import('../_worker.js');
  const worker = workerModule.default;

  const mockDb = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('gokoco_gateways')) {
      return new Response(JSON.stringify([{
        id: 'masterfy',
        name: 'Masterfy',
        method: 'pix',
        enabled: true,
        configured: true,
      }]), { headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('gokoco_orders')) {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body);
        return new Response(JSON.stringify([{ id: 'test-order-id', ...body }]), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('api.masterfypagamentos.com')) {
      return new Response(JSON.stringify({
        id: 'tx-12345',
        data: { copypaste: '00020126580014br.gov.bcb.pix0136test' },
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  };

  const oldFetch = globalThis.fetch;
  globalThis.fetch = mockDb;

  try {
    const env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      MASTERFY_API_KEY: 'test-masterfy-key',
      SITE_URL: 'https://bellamix-oficial.shop',
    };

    const req = new Request('https://bellamix-oficial.shop/api/public/pix/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkoutId: 'test-checkout-' + Math.random(),
        amount: 37.90,
        client: {
          name: 'Cliente Teste Centavos',
          email: 'teste@example.com',
          phone: '11999999999',
          document: '12345678909',
        },
        cart: {
          product: 'escova',
          qty: 1,
          colors: [{ label: 'Preta', quantity: 1 }],
          shipping: 'Frete Grátis',
          bumps: [],
          discount: 1,
          bonus: 0,
        },
        shipping: {
          cep: '01001000',
          logradouro: 'Praça da Sé',
          numero: '100',
          bairro: 'Sé',
          cidade: 'São Paulo',
          uf: 'SP',
        },
      }),
    });

    const amounts = new Set();
    for (let i = 0; i < 10; i++) {
      const loopReq = new Request('https://bellamix-oficial.shop/api/public/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutId: 'test-checkout-loop-' + i + '-' + Math.random(),
          amount: 37.90,
          client: {
            name: 'Cliente Teste Centavos',
            email: 'teste@example.com',
            phone: '11999999999',
            document: '12345678909',
          },
          cart: {
            product: 'escova',
            qty: 1,
            colors: [{ label: 'Preta', quantity: 1 }],
            shipping: 'Frete Grátis',
            bumps: [],
            discount: 1,
            bonus: 0,
          },
          shipping: {
            cep: '01001000',
            logradouro: 'Praça da Sé',
            numero: '100',
            bairro: 'Sé',
            cidade: 'São Paulo',
            uf: 'SP',
          },
        }),
      });
      const loopRes = await worker.fetch(loopReq, env, {});
      assert.equal(loopRes.status, 200);
      const loopData = await loopRes.json();
      assert.ok(loopData.amount >= 37.91 && loopData.amount <= 37.95);
      assert.notEqual(loopData.amount, 37.90);
      amounts.add(loopData.amount);
    }
    assert.ok(amounts.size >= 2, 'Deveria variar os centavos aleatoriamente entre chamadas');
  } finally {
    globalThis.fetch = oldFetch;
  }
});
