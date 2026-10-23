// FlevoPay PIX. The API key is used only by the Worker, never by the browser.
const BASE = 'https://app.flevopag.com/api/v1';
const reply = (data, status, headers) => new Response(JSON.stringify(data), { status, headers });

// Gera CPF válido aleatório quando o cliente não informa documento.
function gerarCpfAleatorio() {
  const rand = () => Math.floor(Math.random() * 9);
  const d = Array.from({ length: 9 }, rand);
  let s1 = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d.push(((s1 * 10) % 11) % 10);
  let s2 = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  d.push(((s2 * 10) % 11) % 10);
  return d.join("");
}

export async function createPixFlevopay({ request, env }, headers, body) {
  const key = String(env.FLEVOPAY_API_KEY || '').trim();
  if (!key) return reply({ error: 'FlevoPay não configurada.' }, 503, headers);
  const amount = Math.round(Number(body.amount) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) return reply({ error: 'Valor PIX inválido.' }, 400, headers);
  const reference = String(body.reference || crypto.randomUUID());
  const address = body.address || {};
  const docDigits = String(body.document || '').replace(/\D/g, '');
  const document = [11, 14].includes(docDigits.length) ? docDigits : gerarCpfAleatorio();
  const payload = {
    amount,
    description: String(body.productName || 'Pedido GOKOCO').slice(0, 255),
    reference,
    ...(env.FLEVOPAY_PRODUCT_HASH ? { productHash: env.FLEVOPAY_PRODUCT_HASH } : { source: 'api_externa' }),
    customer: {
      name: String(body.name || '').trim(), email: String(body.email || '').trim(),
      document,
      phone: String(body.phone || '').replace(/\D/g, ''),
    },
    address: {
      street: String(address.street || ''), number: String(address.number || ''),
      complement: String(address.complement || ''), neighborhood: String(address.neighborhood || ''),
      city: String(address.city || ''), state: String(address.state || ''),
      zipcode: String(address.zipCode || address.zipcode || '').replace(/\D/g, ''),
    },
  };
  if (request?.url) {
    const prefix = new URL(request.url).pathname.startsWith('/video/') ? '/video' : '';
    payload.postback_url = new URL(`${prefix}/api/pix/webhook`, request.url).toString();
  }
  let response;
  try {
    response = await fetch(`${BASE}/transaction`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify(payload),
    });
  } catch {
    return reply({ error: 'Falha de comunicação com a FlevoPay.' }, 502, headers);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return reply({ error: 'FlevoPay recusou a cobrança.', upstreamStatus: response.status }, 502, headers);
  const transactionId = data.transaction_id ?? data.id;
  const pixCode = data.qr_code || data.pix_code;
  if (!transactionId || !pixCode) return reply({ error: 'Resposta incompleta da FlevoPay.' }, 502, headers);
  return reply({
    transactionId: String(transactionId), gateway: 'flevopay', status: 'pending',
    pixCode: String(pixCode), qrCodeBase64: data.qr_code_base64 || null,
  }, 200, headers);
}

export async function statusPixFlevopay({ env }, headers, transactionId) {
  const key = String(env.FLEVOPAY_API_KEY || '').trim();
  if (!key) return reply({ error: 'FlevoPay não configurada.' }, 503, headers);
  let response;
  try {
    const url = new URL(`${BASE}/query`);
    url.searchParams.set('action', 'get_transaction');
    url.searchParams.set('id', String(transactionId));
    response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'X-API-Key': key } });
  } catch {
    return reply({ error: 'Falha ao consultar a FlevoPay.' }, 502, headers);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return reply({ error: 'FlevoPay não confirmou a transação.', upstreamStatus: response.status }, 502, headers);
  const status = String(data.status || data.transaction?.status || '').toLowerCase();
  if (!status) return reply({ error: 'Status ausente na resposta da FlevoPay.' }, 502, headers);
  return reply({
    transactionId: String(transactionId), gateway: 'flevopay', status,
    isPaid: status === 'approved' || status === 'paid',
    isRefunded: status === 'refunded',
    isExpired: ['failed', 'expired', 'cancelled', 'canceled'].includes(status),
    paidAt: data.paid_at || data.payed_at || null,
  }, 200, headers);
}
