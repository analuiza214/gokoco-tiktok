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
  return `https://wa.me/${number}?text=${encodeURIComponent(`Olá ${firstName}! Vi seu pedido na GOKOCO. Posso ajudar com alguma dúvida?`)}`;
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
    const gateway = gatewayNames[order.gateway] || order.gateway || 'PIX';
    const delivery = order.purchase || {};
    const destination = delivery.destination === 'utmify' ? 'UTMify' : 'Meta';
    const deliveryLabels = {sent: 'Compra enviada à '+destination, sending: 'Enviando compra à '+destination, pending: 'Compra aguardando envio à '+destination, failed: 'Falha no envio à '+destination, not_configured: 'Envio de compras não configurado'};
    const purchaseLine = order.status === 'paid' ? '<div class="order-detail" style="color:'+(delivery.state === 'sent' ? '#166534' : '#92400e')+'" title="'+esc(delivery.error || '')+'">'+esc(deliveryLabels[delivery.state] || 'Compra aguardando envio')+'</div>' : '';
    const tx = order.transaction_id ? `<div class="tx-line">Transação: ${esc(order.transaction_id)}</div>` : '';
    return `<article class="order-card"><div class="order-layout"><div class="order-main"><div class="avatar" style="background:hsl(${avatarHue},55%,45%)">${esc(initials)}</div><div class="order-info"><div class="name-line"><span class="customer-name">${esc(order.name)}</span><span class="status-pill" style="color:${status.fg};background:${status.bg}">${esc(status.label)}</span></div><div class="order-detail"><span class="detail-icon">☎</span><span>${esc(formatPhone(order.phone))}</span></div><div class="order-detail"><span class="detail-icon">✉</span><span>${esc(order.email)}</span></div><div class="order-detail"><span class="detail-icon">▧</span><span>${esc(products)}</span></div><div class="order-detail amount-line"><span class="detail-icon">R$</span><span>${esc(cash(order.amount))} · PIX <span class="gateway-tag">${esc(gateway)}</span></span></div><div class="order-date">${esc(formatDate(order.created_at))}</div>${tx}${purchaseLine}</div></div><div class="order-actions"><a class="whatsapp" href="${esc(whatsapp(order))}" target="_blank" rel="noopener noreferrer"><span>◉</span> Chamar no WhatsApp</a></div></div></article>`;
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
