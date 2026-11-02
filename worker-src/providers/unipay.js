// UniPay seller API v1. Credentials stay exclusively in the Worker.
const BASE = 'https://api-dash.unipaybr.com/v1';
const reply = (value, status, headers) => new Response(JSON.stringify(value), { status, headers });
const digits = value => String(value || '').replace(/\D/g, '');
const STATUSES = new Set(['pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'voided', 'failed', 'expired', 'chargeback']);

async function call(env, path, payload) {
  const publicKey = String(env.UNIPAY_PUBLIC_KEY || '').trim();
  const secretKey = String(env.UNIPAY_SECRET_KEY || '').trim();
  const key = publicKey && secretKey ? btoa(`${publicKey}:${secretKey}`) : '';
  if (!key) return { error: 'UniPay não configurada.', status: 503 };
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${key}` },
      signal: AbortSignal.timeout(15000),
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) {
      return { error: 'UniPay não confirmou a operação.', status: 502, upstreamStatus: response.status };
    }
    return { data };
  } catch {
    return { error: 'Falha de comunicação com a UniPay.', status: 502 };
  }
}

// UniPay returns { data: { id, status, payment_fields: { copy_paste } } }.
// Reject incomplete responses before exposing a payment to the checkout.
function transaction(data) { return data.data?.transaction || data.transaction || data.data || data; }

export async function createPixUnipay({ request, env }, headers, body) {
  const amount = Math.round(Number(body.amount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) return reply({ error: 'Valor PIX inválido.' }, 400, headers);
  const document = digits(body.document);
  const phone = digits(body.phone);
  if (![11, 14].includes(document.length) || ![10, 11, 12, 13].includes(phone.length) || !String(body.email || '').includes('@')) {
    return reply({ error: 'Informe CPF/CNPJ, e-mail e telefone válidos para a UniPay.' }, 400, headers);
  }
  const address = body.address || {};
  const payload = {
    amount, currency: 'BRL', payment_method: 'pix', product_type: 'physical',
    customer: { name: String(body.name || '').trim(), email: String(body.email || '').trim(), tax_id: document, phone, type: document.length === 14 ? 'company' : 'individual' },
    items: [{ name: String(body.productName || 'Pedido GOKOCO').slice(0, 255), quantity: 1, unit_price: amount, tangible: true }],
    billing_address: { country: 'BR', street: address.street, number: address.number, complement: address.complement, neighborhood: address.neighborhood, city: address.city, state: address.state, zip_code: digits(address.zipCode || address.zipcode) },
    metadata: { order_id: String(body.reference || '') },
    payment_details: { expires_in_seconds: 1800 },
  };
  const result = await call(env, '/charges', payload);
  if (result.error) return reply(result, result.status, headers);
  const tx = transaction(result.data);
  const id = tx.id || tx.transactionId;
  const pixCode = tx.payment_fields?.copy_paste || tx.payment_fields?.qr_code || tx.payment_fields?.qrcode;
  if (!id || typeof pixCode !== 'string' || !pixCode.startsWith('000201')) {
    return reply({ error: 'Resposta PIX da UniPay sem identificador ou código válido. Confira o contrato da API antes de tentar novamente.' }, 502, headers);
  }
  return reply({ transactionId: String(id), gateway: 'unipay', status: 'pending', pixCode,
    qrCodeBase64: tx.payment_fields?.qr_code_base64 || null }, 200, headers);
}

export async function statusPixUnipay({ env }, headers, transactionId) {
  const result = await call(env, `/charges/${encodeURIComponent(String(transactionId))}`);
  if (result.error) return reply(result, result.status, headers);
  const tx = transaction(result.data);
  const status = String(tx.status || '').toLowerCase();
  if (String(tx.id || '') !== String(transactionId) || !STATUSES.has(status)) {
    return reply({ error: 'Resposta de consulta inválida da UniPay.' }, 502, headers);
  }
  return reply({ transactionId: String(transactionId), gateway: 'unipay', status,
    isPaid: status === 'captured', isRefunded: status === 'refunded',
    isExpired: ['failed', 'expired', 'voided'].includes(status), paidAt: tx.captured_at || null }, 200, headers);
}
