// InvictusPay seller API v1. Credentials stay exclusively in the Worker.
const BASE = 'https://api.invictuspayv2.com.br/api/v1';
const reply = (value, status, headers) => new Response(JSON.stringify(value), { status, headers });
const digits = value => String(value || '').replace(/\D/g, '');
const STATUSES = new Set(['pending', 'processing', 'antifraud', 'paid', 'failed', 'refused', 'expired', 'cancelled', 'refunded', 'in_dispute', 'pre_chargeback', 'chargeback']);

async function call(env, path, payload) {
  const key = String(env.INVICTUSPAY_API_KEY || '').trim();
  if (!key) return { error: 'InvictusPay não configurada.', status: 503 };
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': key },
      signal: AbortSignal.timeout(15000),
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) {
      return { error: 'InvictusPay não confirmou a operação.', status: 502, upstreamStatus: response.status };
    }
    return { data };
  } catch {
    return { error: 'Falha de comunicação com a InvictusPay.', status: 502 };
  }
}

// The public docs omit response examples. Accept common envelopes, but fail
// closed when transaction identifiers, PIX content or status are missing.
function transaction(data) { return data.data?.transaction || data.transaction || data.data || data; }

export async function createPixInvictuspay({ request, env }, headers, body) {
  const amount = Math.round(Number(body.amount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) return reply({ error: 'Valor PIX inválido.' }, 400, headers);
  const document = digits(body.document);
  const phone = digits(body.phone);
  if (![11, 14].includes(document.length) || ![10, 11, 12, 13].includes(phone.length) || !String(body.email || '').includes('@')) {
    return reply({ error: 'Informe CPF/CNPJ, e-mail e telefone válidos para a InvictusPay.' }, 400, headers);
  }
  const payload = {
    amount, paymentMethod: 'pix',
    customer: { name: String(body.name || '').trim(), email: String(body.email || '').trim(), document, phone },
    items: [{ description: String(body.productName || 'Pedido GOKOCO').slice(0, 255), quantity: 1, amount,
      ...(body.reference ? { externalRef: String(body.reference) } : {}) }],
    pix: { expirationInSeconds: 1800 },
  };
  if (request?.url) {
    const prefix = new URL(request.url).pathname.startsWith('/video/') ? '/video' : '';
    const url = new URL(`${prefix}/api/pix/webhook`, request.url);
    if (url.protocol === 'https:') payload.postbackUrl = url.toString();
  }
  const result = await call(env, '/transactions', payload);
  if (result.error) return reply(result, result.status, headers);
  const tx = transaction(result.data);
  const id = tx.id || tx.transactionId;
  const pixCode = tx.pix?.qrcode || tx.pix?.qrCode || tx.pix?.copyPaste || tx.pix?.code || tx.pix_code || tx.qr_code;
  if (!id || typeof pixCode !== 'string' || !pixCode.startsWith('000201')) {
    return reply({ error: 'Resposta PIX da InvictusPay sem identificador ou código válido. Confira o contrato da API antes de tentar novamente.' }, 502, headers);
  }
  return reply({ transactionId: String(id), gateway: 'invictuspay', status: 'pending', pixCode,
    qrCodeBase64: tx.pix?.qrCodeBase64 || tx.qr_code_base64 || null }, 200, headers);
}

export async function statusPixInvictuspay({ env }, headers, transactionId) {
  const result = await call(env, `/transactions/${encodeURIComponent(String(transactionId))}`);
  if (result.error) return reply(result, result.status, headers);
  const tx = transaction(result.data);
  const status = String(tx.status || '').toLowerCase();
  if (String(tx.id || '') !== String(transactionId) || !STATUSES.has(status)) {
    return reply({ error: 'Resposta de consulta inválida da InvictusPay.' }, 502, headers);
  }
  return reply({ transactionId: String(transactionId), gateway: 'invictuspay', status,
    isPaid: status === 'paid', isRefunded: status === 'refunded',
    isExpired: ['failed', 'refused', 'expired', 'cancelled'].includes(status), paidAt: tx.paid_at || null }, 200, headers);
}
