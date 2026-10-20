// Taxa alfandegária (mesma lógica da loja Top Mix): após o trânsito,
// o rastreio simula taxação pela alfândega, retorno ao CD e libera o
// pagamento da taxa via PIX. O pagamento é confirmado pelo gateway ou pelo
// envio do comprovante, e então o pedido é liberado em até 2 dias.

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const TRANSITO_OFFSET = 148 * HOUR + 39 * MINUTE; // Após o segundo trânsito
const FEE_AFTER_TRANSITO = 22 * HOUR + 43 * MINUTE; // +22h43m após trânsito (alfândega)
const RECEIPT_BUCKET = 'comprovantes-taxa';
const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
const RECEIPT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf' };
const CODE_PATTERN = /^GK[A-HJ-NP-Z2-9]{10}$/;

export function feeAmount(env) {
  const value = Number(String(env.RESHIPPING_FEE_AMOUNT || '').replace(',', '.'));
  return Number.isFinite(value) && value >= 1 && value <= 500 ? Math.round(value * 100) / 100 : 9;
}

export function reshippingSchedule(shipping, fallbackCreatedAt) {
  const origin = Date.parse(shipping?.created_at || fallbackCreatedAt);
  if (!Number.isFinite(origin) || shipping?.status === 'delivered') return null;
  const events = Array.isArray(shipping?.events) ? shipping.events : [];
  const manualTransito = Date.parse(events.find((event) => event?.status === 'in_transit_2')?.at || '');
  const transitoAt = Number.isFinite(manualTransito) ? manualTransito : origin + TRANSITO_OFFSET;
  return { outForDeliveryAt: new Date(transitoAt).toISOString(), feeAt: new Date(transitoAt + FEE_AFTER_TRANSITO).toISOString() };
}

export function publicReshipping(env, order) {
  const shipping = order?.tracking?.shipping;
  const schedule = reshippingSchedule(shipping, order?.created_at);
  if (!schedule) return null;
  const saved = order.tracking?.reshipping || {};
  const confirmed = saved.status === 'paid' || saved.status === 'receipt_sent';
  return {
    ...schedule,
    amount: Number(saved.amount) || feeAmount(env),
    available: Date.now() >= Date.parse(schedule.feeAt),
    status: confirmed ? saved.status : saved.pix_code ? 'pending' : 'none',
    confirmedAt: confirmed ? saved.confirmed_at : null,
  };
}

async function loadOrder(deps, env, code) {
  if (!CODE_PATTERN.test(code)) return { error: deps.json({ error: 'Código de rastreio inválido.' }, 400) };
  const rows = await deps.db(env, 'gokoco_orders', `?tracking->shipping->>code=eq.${encodeURIComponent(code)}&select=id,name,email,phone,document,status,created_at,shipping,tracking&limit=1`);
  const order = rows[0];
  if (!order || (order.status !== 'paid' && !(order.status === 'tracking_only' && order.tracking?.manualExternal))) return { error: deps.json({ error: 'Pedido não encontrado.' }, 404) };
  const schedule = reshippingSchedule(order.tracking?.shipping, order.created_at);
  if (!schedule || Date.now() < Date.parse(schedule.feeAt)) return { error: deps.json({ error: 'A taxa alfandegária ainda não está disponível para este pedido.' }, 409) };
  return { order };
}

async function saveReshipping(deps, env, order, reshipping) {
  const tracking = { ...(order.tracking || {}), reshipping };
  const saved = await deps.db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(order.id)}&tracking=eq.${encodeURIComponent(JSON.stringify(order.tracking || {}))}&select=id`, 'PATCH', { tracking, updated_at: new Date().toISOString() });
  return saved.length > 0;
}

function pixResponse(reshipping) {
  return { pixCode: reshipping.pix_code, qrCode: reshipping.qr_code || null, amount: Number(reshipping.amount), status: reshipping.status };
}

async function createFeePix(request, env, deps) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || '').trim().toUpperCase();
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping;
  if (current?.status === 'paid' || current?.status === 'receipt_sent') return deps.json(pixResponse(current));
  const createdAt = Date.parse(current?.created_at || '');
  if (current?.pix_code && Date.now() - createdAt < 50 * MINUTE) return deps.json(pixResponse(current));

  const active = (await deps.listGateways(env)).filter((gateway) => gateway.enabled);
  if (active.length !== 1 || !active[0].configured) return deps.json({ error: 'Pagamento PIX indisponível no momento. Fale com o atendimento.' }, 503);
  const shipping = order.shipping || {};
  const amount = feeAmount(env);
  const payload = {
    amount,
    name: String(order.name || '').trim().length >= 3 && !order.tracking?.manualExternal ? order.name : 'Cliente GOKOCO',
    email: order.email, phone: order.phone, document: order.document,
    productName: `Taxa Alfandegária - ${code}`,
    address: { street: shipping.logradouro, number: shipping.numero, complement: shipping.complemento, neighborhood: shipping.bairro, city: shipping.cidade, state: shipping.uf, zipCode: shipping.cep },
  };
  const provider = deps.providers[active[0].id] || deps.providers.ironpay;
  const result = await provider({ request, env }, { 'Content-Type': 'application/json' }, payload);
  const payment = await result.json().catch(() => ({}));
  if (!result.ok || !payment.pixCode || !payment.transactionId) {
    console.error('[reshipping/pix]', code, result.status, payment?.error || payment?.message);
    return deps.json({ error: 'Não foi possível gerar o PIX da taxa. Tente novamente em instantes.' }, 502);
  }
  const reshipping = {
    status: 'pending', amount, gateway: active[0].id, transaction_id: String(payment.transactionId),
    pix_code: payment.pixCode, qr_code: payment.qrCodeBase64 || payment.qrCodeImage || null, created_at: new Date().toISOString(),
  };
  if (!(await saveReshipping(deps, env, order, reshipping))) return deps.json({ error: 'O pedido foi atualizado. Tente novamente.' }, 409);
  return deps.json(pixResponse(reshipping));
}

async function feeStatus(request, env, deps) {
  const code = String(new URL(request.url).searchParams.get('code') || '').trim().toUpperCase();
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping;
  if (!current?.transaction_id) return deps.json({ status: 'none' });
  if (current.status !== 'pending') return deps.json({ status: current.status, confirmedAt: current.confirmed_at });
  const result = await deps.queryPixGatewayStatus(env, current.transaction_id, current.gateway).catch(() => ({}));
  if (!result?.isPaid) return deps.json({ status: 'pending' });
  const confirmedAt = result.paidAt || new Date().toISOString();
  await saveReshipping(deps, env, order, { ...current, status: 'paid', confirmed_at: confirmedAt });
  return deps.json({ status: 'paid', confirmedAt });
}

async function storageRequest(env, path, init) {
  const base = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return fetch(`${base}/storage/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) } });
}

async function uploadReceipt(env, path, file) {
  const upload = () => storageRequest(env, `object/${RECEIPT_BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
  let response = await upload();
  if (response.status === 400 || response.status === 404) {
    const text = await response.text().catch(() => '');
    if (!/bucket not found|not found/i.test(text)) throw new Error(`Storage respondeu ${response.status}`);
    await storageRequest(env, 'bucket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: RECEIPT_BUCKET, name: RECEIPT_BUCKET, public: false }) });
    response = await upload();
  }
  if (!response.ok) throw new Error(`Storage respondeu ${response.status}`);
}

async function sendReceipt(request, env, deps) {
  const form = await request.formData().catch(() => null);
  const code = String(form?.get('code') || '').trim().toUpperCase();
  const file = form?.get('file');
  if (!file || typeof file === 'string' || !file.size) return deps.json({ error: 'Anexe o comprovante do PIX.' }, 400);
  if (file.size > RECEIPT_MAX_BYTES) return deps.json({ error: 'O arquivo deve ter no máximo 8 MB.' }, 413);
  const extension = RECEIPT_TYPES[file.type];
  if (!extension) return deps.json({ error: 'Envie uma imagem (JPG, PNG, WEBP) ou um PDF.' }, 415);
  const { order, error } = await loadOrder(deps, env, code);
  if (error) return error;
  const current = order.tracking?.reshipping || {};
  if (current.status === 'paid' || current.status === 'receipt_sent') return deps.json({ status: current.status, confirmedAt: current.confirmed_at });
  if (!current.pix_code) return deps.json({ error: 'Gere o PIX da taxa antes de enviar o comprovante.' }, 409);
  const path = `${code}/${Date.now()}.${extension}`;
  try {
    await uploadReceipt(env, path, file);
  } catch (uploadError) {
    console.error('[reshipping/receipt]', code, uploadError.message);
    return deps.json({ error: 'Não foi possível enviar o comprovante. Tente novamente.' }, 502);
  }
  const confirmedAt = new Date().toISOString();
  const reshipping = { ...current, status: 'receipt_sent', confirmed_at: confirmedAt, receipt: { path, name: String(file.name || '').slice(0, 120), type: file.type, size: file.size, uploaded_at: confirmedAt } };
  if (!(await saveReshipping(deps, env, order, reshipping))) return deps.json({ error: 'O pedido foi atualizado. Tente novamente.' }, 409);
  return deps.json({ status: 'receipt_sent', confirmedAt });
}

async function adminReceiptUrl(request, env, deps) {
  const denied = await deps.requireAdmin(request, env); if (denied) return denied;
  const id = String(new URL(request.url).searchParams.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return deps.json({ error: 'Pedido inválido.' }, 400);
  const rows = await deps.db(env, 'gokoco_orders', `?id=eq.${encodeURIComponent(id)}&select=tracking&limit=1`);
  const path = rows[0]?.tracking?.reshipping?.receipt?.path;
  if (!path) return deps.json({ error: 'Comprovante não encontrado.' }, 404);
  const response = await storageRequest(env, `object/sign/${RECEIPT_BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
  const signed = await response.json().catch(() => ({}));
  if (!response.ok || !signed.signedURL) return deps.json({ error: 'Não foi possível abrir o comprovante.' }, 502);
  const base = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return deps.json({ url: `${base}/storage/v1${signed.signedURL}` });
}

export async function handleReshippingRoute(path, request, env, deps) {
  if (path === '/api/public/reshipping-fee/pix' && request.method === 'POST') return createFeePix(request, env, deps);
  if (path === '/api/public/reshipping-fee/status' && request.method === 'GET') return feeStatus(request, env, deps);
  if (path === '/api/public/reshipping-fee/receipt' && request.method === 'POST') return sendReceipt(request, env, deps);
  if (path === '/api/admin/reshipping-receipt' && request.method === 'GET') return adminReceiptUrl(request, env, deps);
  return null;
}
