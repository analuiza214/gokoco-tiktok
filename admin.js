const adminIcons = {"lock": "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>", "bag": "<path d=\"m6 2-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z\"/><path d=\"M3 6h18M16 10a4 4 0 0 1-8 0\"/>", "card": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M2 10h20\"/>", "refresh": "<path d=\"M3 11a9 9 0 0 1 15.5-6.5L21 7M21 3v4h-4M21 13a9 9 0 0 1-15.5 6.5L3 17M3 21v-4h4\"/>", "logout": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\"/>", "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>", "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>", "sort": "<path d=\"m3 16 4 4 4-4M7 20V4m14 4-4-4-4 4M17 4v16\"/>", "x": "<path d=\"m18 6-12 12M6 6l12 12\"/>", "phone": "<path d=\"M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z\"/>", "mail": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"m22 7-10 6L2 7\"/>", "package": "<path d=\"m7.5 4.3 9 5.2M21 8l-9 5-9-5m9 14V12\"/><path d=\"M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z\"/>", "user": "<path d=\"M20 21v-2a7 7 0 0 0-14 0v2\"/><circle cx=\"13\" cy=\"7\" r=\"4\"/>", "send": "<path d=\"m22 2-7 20-4-9-9-4Z\"/><path d=\"M22 2 11 13\"/>"};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${adminIcons[name] || ""}</svg>`;
document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'gokoco_admin_token';
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let orders = [];
let gateways = [];
let selectedStatus = 'todos';
let selectedPeriod = 'todos';
let selectedSort = 'recentes';
let page = 1;
let busy = false;
const PAGE_SIZE = 50;
const gatewayNames = { ironpay: 'IronPay', masterfy: 'MasterFy', umbrellapag: 'UmbrellaPag', venuspay_pix: 'Venus Pay' };
const statusInfo = {
  creating: { label: 'Criando PIX', fg: '#92400e', bg: '#fef3c7' },
  pending: { label: 'PIX gerado', fg: '#1d4ed8', bg: '#dbeafe' },
  paid: { label: 'Pago ✓', fg: '#166534', bg: '#dcfce7' },
  refunded: { label: 'Reembolsado', fg: '#7e22ce', bg: '#f3e8ff' },
  expired: { label: 'Expirado', fg: '#6b7280', bg: '#f3f4f6' },
  failed: { label: 'Falha ao gerar PIX', fg: '#b91c1c', bg: '#fee2e2' },
};
const shippingStages = [
  ['confirmed', 'Pedido confirmado'], ['preparing', 'Preparando pedido'], ['shipped', 'Pedido enviado'],
  ['out_for_delivery', 'Saiu para entrega'], ['delivered', 'Pedido entregue'],
];

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cash = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const formatPhone = (value) => {
  const d = String(value || '').replace(/\D/g, '');
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value || '—';
};
const whatsapp = (order) => {
  const digits = String(order.phone || '').replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  const firstName = String(order.name || '').trim().split(/\s+/)[0] || 'tudo bem';
  const message = order.status === 'paid'
    ? `Olá ${firstName}! Estou entrando em contato sobre seu pedido da escova GOKOCO. Posso te ajudar com alguma informação? 😊`
    : `Olá ${firstName}! Vi que você iniciou uma compra da escova GOKOCO mas não finalizou. Posso te ajudar? 😊`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};

async function api(path, options = {}) {
  const response = await fetch(`/api/admin/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('Sessão expirada. Entre novamente no painel.');
  if (!response.ok) throw new Error(data.error || data.message || 'Erro ao acessar o servidor.');
  return data;
}

function showPanel() {
  $('login').hidden = true;
  $('shell').hidden = false;
  load();
}
function showLogin() {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  $('shell').hidden = true;
  $('login').hidden = false;
}
function filteredOrders() {
  const term = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const now = new Date();
  return orders.filter((order) => {
    const statusMatch = selectedStatus === 'todos' || order.status === selectedStatus;
    const d = new Date(order.created_at);
    const days = (now.getTime() - d.getTime()) / 86400000;
    let periodMatch = true;
    if (selectedPeriod === 'hoje') periodMatch = d.toDateString() === now.toDateString();
    else if (selectedPeriod === 'ontem') { const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1); periodMatch = d.toDateString() === yesterday.toDateString(); }
    else if (selectedPeriod === '7dias') periodMatch = days <= 7;
    else if (selectedPeriod === '30dias') periodMatch = days <= 30;
    const haystack = [order.name, order.email, order.phone, order.transaction_id, ...(Array.isArray(order.products) ? order.products.map((p) => p.name) : [])].join(' ').toLocaleLowerCase('pt-BR');
    return statusMatch && periodMatch && (!term || haystack.includes(term));
  }).sort((a, b) => {
    if (selectedSort === 'antigos') return new Date(a.created_at) - new Date(b.created_at);
    if (selectedSort === 'nome_az') return String(a.name).localeCompare(String(b.name), 'pt-BR');
    if (selectedSort === 'nome_za') return String(b.name).localeCompare(String(a.name), 'pt-BR');
    if (selectedSort === 'valor_maior') return Number(b.amount) - Number(a.amount);
    if (selectedSort === 'valor_menor') return Number(a.amount) - Number(b.amount);
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderStats() {
  const count = (status) => orders.filter((order) => order.status === status).length;
  $('count-all').textContent = orders.length;
  $('count-pending').textContent = count('pending') + count('creating');
  $('count-paid').textContent = count('paid');
  $('tab-all').textContent = orders.length;
  $('tab-pending').textContent = count('pending') + count('creating');
  $('tab-paid').textContent = count('paid');
  $('tab-refunded').textContent = count('refunded');
  $('tab-expired').textContent = count('expired');
  $('tab-failed').textContent = count('failed');
}

function renderOrders() {
  const rows = filteredOrders();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $('loading').hidden = true;
  $('orders').hidden = visible.length === 0;
  $('empty').hidden = visible.length > 0;
  $('results-summary').hidden = selectedPeriod === 'todos' && !$('search').value.trim();
  $('result-count').innerHTML = `<strong>${rows.length}</strong> resultado${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'}`;
  $('orders').innerHTML = visible.map((order) => {
    const status = statusInfo[order.status] || { label: order.status || 'Pedido', fg: '#6b7280', bg: '#f3f4f6' };
    const products = Array.isArray(order.products) ? order.products.map((p) => `${p.quantity && p.quantity > 1 ? `${p.quantity}× ` : ''}${p.name || 'Produto'}`).join(', ') : 'Pedido GOKOCO';
    const initials = String(order.name || '?').trim().charAt(0).toUpperCase();
    const avatarHue = ((Number.parseInt(String(order.id).replace(/\D/g, '').slice(-4), 10) || 7) * 67) % 360;
    const external = order.gateway === 'manual_tracking';
    const gateway = gatewayNames[order.gateway] || order.gateway || 'PIX';
    const delivery = order.purchase || {};
    const destination = delivery.destination === 'utmify' ? 'UTMify' : 'Meta';
    const deliveryLabels = {sent: 'Compra enviada à '+destination, sending: 'Enviando compra à '+destination, pending: 'Compra aguardando envio à '+destination, failed: 'Falha no envio à '+destination, not_configured: 'Envio de compras não configurado'};
    const purchaseLine = external ? '<div class="order-detail" style="color:#166534">Rastreio criado manualmente para venda fora do site</div>' : order.status === 'paid' ? '<div class="order-detail" style="color:'+(delivery.state === 'sent' ? '#166534' : '#92400e')+'" title="'+esc(delivery.error || '')+'">'+esc(deliveryLabels[delivery.state] || 'Compra aguardando envio')+'</div>' : '';
    const manualLine = order.manualPayment ? '<div class="order-detail" style="color:#15803d">Pagamento recebido por fora · confirmado no admin</div>' : '';
    const tx = order.transaction_id ? `<div class="tx-line">Transação: ${esc(order.transaction_id)}</div>` : '';
    const tracking = order.shippingTracking || {};
    const trackingCode = tracking.code || '';
    const selectedStage = tracking.status || 'confirmed';
    const trackingLine = order.status === 'paid'
      ? trackingCode
        ? `<a class="order-tracking" href="/rastreio.html?codigo=${encodeURIComponent(trackingCode)}" target="_blank" rel="noopener noreferrer">${icon('package')}<strong>${esc(trackingCode)}</strong><span>(rastreio enviado)</span></a>`
        : `<div class="order-tracking tracking-pending">${icon('package')}<span>Código de rastreio sendo preparado</span></div>`
      : '';
    const mailSubject = encodeURIComponent(`Informações do seu pedido GOKOCO${trackingCode ? ` · ${trackingCode}` : ''}`);
    const trackingUrl = trackingCode ? `${location.origin}/rastreio.html?codigo=${encodeURIComponent(trackingCode)}` : '';
    const mailBody = encodeURIComponent(`Olá ${String(order.name || '').trim().split(/\s+/)[0] || 'tudo bem'}!\n\n${trackingUrl ? `Seu pedido já está com o código de rastreio ${trackingCode}. Acompanhe por aqui: ${trackingUrl}\n\n` : 'Estou entrando em contato sobre seu pedido da escova GOKOCO.\n\n'}Qualquer dúvida, estamos à disposição!`);
    const paymentActions = ['pending', 'expired', 'failed'].includes(order.status) ? '<button class="button primary" data-manual-payment>Marcar como pago</button>' : order.status === 'paid' ? '<button class="button outline" data-generate-tracking>' + (trackingCode ? 'Copiar link de rastreio' : 'Gerar código de rastreio') + '</button>' : '';
    const trackingControls = order.status === 'paid' ? `<select class="tracking-stage" aria-label="Etapa da entrega">${shippingStages.map(([value, label]) => `<option value="${value}" ${selectedStage === value ? 'selected' : ''}>${label}</option>`).join('')}</select>` : '';
    return `<article class="order-card" data-order-id="${esc(order.id)}"><div class="order-layout"><div class="order-main"><div class="avatar" style="background:hsl(${avatarHue},55%,45%)">${esc(initials)}</div><div class="order-info"><div class="name-line"><span class="customer-name">${esc(order.name)}</span><span class="status-pill" style="color:${status.fg};background:${status.bg}">${esc(external ? 'Venda externa' : status.label)}</span></div><div class="order-detail"><span class="detail-icon">${icon('phone')}</span><span>${esc(formatPhone(order.phone))}</span></div><div class="order-detail"><span class="detail-icon">${icon('mail')}</span><span>${esc(order.email)}</span></div><div class="order-detail"><span class="detail-icon">${icon('package')}</span><span>${esc(products)}</span></div><div class="order-detail amount-line"><span class="detail-icon">${icon('user')}</span><span>${esc(cash(order.amount))} · ${external ? 'Venda externa' : `PIX <span class="gateway-tag">${esc(gateway)}</span>`}</span></div><div class="order-date">${esc(formatDate(order.created_at))}</div>${tx}${manualLine}${purchaseLine}${trackingLine}</div></div><div class="order-actions">${order.phone ? `<a class="whatsapp" href="${esc(whatsapp(order))}" target="_blank" rel="noopener noreferrer">${icon('phone')} Chamar no WhatsApp</a>` : ''}${external ? '' : `<a class="order-email" href="mailto:${encodeURIComponent(order.email || '')}?subject=${mailSubject}&body=${mailBody}">${icon('send')} Enviar Email</a>`}${trackingControls}${paymentActions}</div></div></article>`;
  }).join('');
  const pagination = $('pagination');
  pagination.hidden = totalPages < 2;
  if (totalPages > 1) {
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, rows.length);
    pagination.innerHTML = `<span>${from}–${to} de ${rows.length} pedidos</span><div class="pagination-controls"><button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Anterior</button><button class="current">${page} / ${totalPages}</button><button data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Próxima →</button></div>`;
  }
}

function renderGateways() {
  const groups = new Map();
  for (const gateway of gateways) {
    const name = gateway.name.replace(/ PIX$/, '');
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(gateway);
  }
  $('gateways').innerHTML = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([name, entries]) => `
    <section class="gateway-group"><div class="gateway-group-title">${esc(name)}${entries.length > 1 ? '<span class="method-tag">Cartão e PIX</span>' : ''}</div>
      ${entries.map((gateway) => `<div class="gateway-method"><div><div class="gateway-method-label"><span class="method-tag">PIX</span><span style="color:${gateway.enabled ? '#166534' : '#9ca3af'}">${gateway.enabled ? 'Ativado' : 'Desativado'}</span></div><small>${gateway.configured ? 'Chave configurada' : 'Chave pendente nas variáveis do Cloudflare'}</small></div><button class="toggle ${gateway.enabled ? 'on' : ''}" data-gateway="${esc(gateway.id)}" aria-label="${esc(`${name} PIX`)}" aria-checked="${gateway.enabled}" role="switch" ${!gateway.configured && !gateway.enabled ? 'disabled' : ''}><i></i></button></div>`).join('')}
    </section>`).join('');
}

async function load() {
  if (busy) return;
  busy = true;
  $('refresh').disabled = true;
  $('refresh').classList.add('spinning');
  $('page-error').hidden = true;
  if (!orders.length) $('loading').hidden = false;
  try {
    const [gatewayData, orderData] = await Promise.all([api('gateways'), api('orders')]);
    gateways = gatewayData.gateways || [];
    orders = orderData.orders || [];
    renderStats(); renderGateways(); renderOrders();
  } catch (error) {
    if (/Sessão expirada|Não autorizado/i.test(error.message)) showLogin();
    else { $('page-error').textContent = error.message; $('page-error').hidden = false; $('loading').hidden = true; if (!orders.length) $('empty').hidden = false; }
  } finally {
    busy = false;
    $('refresh').disabled = false;
    $('refresh').classList.remove('spinning');
  }
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-error').textContent = '';
  const submit = $('login-form').querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Verificando...';
  try {
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: $('user').value, senha: $('pass').value }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || 'Usuário ou senha incorretos.');
    token = data.token; sessionStorage.setItem(TOKEN_KEY, token); $('pass').value = ''; showPanel();
  } catch (error) { $('login-error').textContent = error.message || 'Erro de conexão. Tente novamente.'; }
  finally { submit.disabled = false; submit.textContent = 'Entrar'; }
});
$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', showLogin);
$('external-tracking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const errorBox = $('external-tracking-error');
  errorBox.hidden = true; $('external-tracking-result').hidden = true;
  button.disabled = true;
  try {
    const fields = Object.fromEntries(new FormData(form));
    const saved = await api('external-tracking', { method: 'POST', body: JSON.stringify(fields) });
    const url = `${location.origin}/rastreio.html?codigo=${encodeURIComponent(saved.code)}`;
    $('external-tracking-code').textContent = saved.code;
    $('external-tracking-link').href = url;
    $('external-tracking-result').hidden = false;
    form.reset();
    await load();
  } catch (error) {
    errorBox.textContent = error.message || 'Não foi possível gerar o rastreio.';
    errorBox.hidden = false;
  } finally { button.disabled = false; }
});
$('external-tracking-copy').addEventListener('click', async () => {
  const url = $('external-tracking-link').href;
  try { await navigator.clipboard.writeText(url); $('external-tracking-copy').textContent = 'Link copiado!'; }
  catch (_) { window.prompt('Copie o link de rastreio:', url); }
});
$('search').addEventListener('input', () => { page = 1; $('clear-search').hidden = !$('search').value; renderOrders(); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; $('clear-search').hidden = true; page = 1; renderOrders(); });
$('sort').addEventListener('change', () => { selectedSort = $('sort').value; page = 1; renderOrders(); });
document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => {
  selectedPeriod = button.dataset.period; page = 1;
  document.querySelectorAll('[data-period]').forEach((item) => item.classList.toggle('selected', item === button)); renderOrders();
}));
$('status-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-status]'); if (!button) return;
  selectedStatus = button.dataset.status; page = 1;
  $('status-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button)); renderOrders();
});
$('reset-filters').addEventListener('click', () => {
  selectedPeriod = 'todos'; selectedStatus = 'todos'; selectedSort = 'recentes'; page = 1;
  $('search').value = ''; $('clear-search').hidden = true; $('sort').value = selectedSort;
  document.querySelectorAll('[data-period]').forEach((item) => item.classList.toggle('selected', item.dataset.period === 'todos'));
  $('status-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item.dataset.status === 'todos')); renderOrders();
});
$('pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (!button || button.disabled) return; page = Number(button.dataset.page); renderOrders(); window.scrollTo(0, 0); });
$('orders').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-manual-payment],[data-generate-tracking]');
  if (!button) return;
  const order = orders.find(item => item.id === button.closest('[data-order-id]')?.dataset.orderId);
  if (!order) return;
  const manual = button.hasAttribute('data-manual-payment');
  if (manual && !window.confirm('Você confirma que recebeu o pagamento de ' + cash(order.amount) + ' deste cliente por fora?')) return;
  button.disabled = true;
  try {
    const saved = await api(manual ? 'manual-payment' : 'generate-tracking', { method: 'POST', body: JSON.stringify({ id: order.id }) });
    order.status = 'paid'; order.shippingTracking = saved.shipping;
    const url = location.origin + '/rastreio.html?codigo=' + encodeURIComponent(saved.shipping.code);
    if (!manual) { try { await navigator.clipboard.writeText(url); window.alert('Link de rastreio copiado!'); } catch (_) { window.prompt('Copie o link de rastreio:', url); } }
    await load();
  } catch (error) { window.alert(error.message || 'Não foi possível salvar o pedido.'); }
  finally { button.disabled = false; }
});
$('orders').addEventListener('change', async (event) => {
  const select = event.target.closest('.tracking-stage');
  if (!select) return;
  const card = select.closest('[data-order-id]');
  const order = orders.find((item) => item.id === card?.dataset.orderId);
  if (!order) return;
  select.disabled = true;
  try {
    const saved = await api('order-tracking', { method: 'PATCH', body: JSON.stringify({ id: order.id, code: order.shippingTracking?.code || '', status: select.value }) });
    order.shippingTracking = saved.shipping;
    renderOrders();
  } catch (error) {
    window.alert(error.message || 'Não foi possível atualizar a etapa do pedido.');
    load();
  } finally {
    select.disabled = false;
  }
});
$('gateway-open').addEventListener('click', () => { $('gateway-modal').hidden = false; });
$('gateway-close').addEventListener('click', () => { $('gateway-modal').hidden = true; });
$('gateway-modal').addEventListener('click', (event) => { if (event.target === $('gateway-modal')) $('gateway-modal').hidden = true; });
$('gateway-refresh').addEventListener('click', load);
$('gateways').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-gateway]'); if (!button || button.disabled) return;
  button.disabled = true; $('gateway-error').hidden = true;
  const current = gateways.find((gateway) => gateway.id === button.dataset.gateway);
  try {
    const data = await api('gateways', { method: 'PATCH', body: JSON.stringify({ id: current.id, enabled: !current.enabled }) });
    gateways = data.gateways || []; renderGateways();
  } catch (error) { $('gateway-error').textContent = error.message; $('gateway-error').hidden = false; button.disabled = false; }
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') $('gateway-modal').hidden = true; });

if (token) api('verify').then((data) => data.valid ? showPanel() : showLogin()).catch(showLogin);
window.setInterval(() => { if (token && !$('shell').hidden) load(); }, 60_000);
