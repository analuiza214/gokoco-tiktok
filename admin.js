const adminIcons = {"lock": "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>", "bag": "<path d=\"m6 2-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z\"/><path d=\"M3 6h18M16 10a4 4 0 0 1-8 0\"/>", "card": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M2 10h20\"/>", "refresh": "<path d=\"M3 11a9 9 0 0 1 15.5-6.5L21 7M21 3v4h-4M21 13a9 9 0 0 1-15.5 6.5L3 17M3 21v-4h4\"/>", "logout": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\"/>", "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>", "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>", "sort": "<path d=\"m3 16 4 4 4-4M7 20V4m14 4-4-4-4 4M17 4v16\"/>", "x": "<path d=\"m18 6-12 12M6 6l12 12\"/>", "phone": "<path d=\"M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z\"/>", "mail": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"m22 7-10 6L2 7\"/>", "package": "<path d=\"m7.5 4.3 9 5.2M21 8l-9 5-9-5m9 14V12\"/><path d=\"M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z\"/>", "user": "<path d=\"M20 21v-2a7 7 0 0 0-14 0v2\"/><circle cx=\"13\" cy=\"7\" r=\"4\"/>", "send": "<path d=\"m22 2-7 20-4-9-9-4Z\"/><path d=\"M22 2 11 13\"/>", "eye": "<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>", "eye-off": "<path d=\"M9.88 9.88a3 3 0 1 0 4.24 4.24\"/><path d=\"M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68\"/><path d=\"M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61\"/><line x1=\"2\" x2=\"22\" y1=\"2\" y2=\"22\"/>", "copy": "<rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>", "check": "<path d=\"m5 12 4 4L19 6\"/>"};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${adminIcons[name] || ""}</svg>`;
document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'gokoco_admin_token';
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let orders = [];
let gokocoOrders = [];
let bellaOrders = [];
let gateways = [];
let selectedStatus = 'todos';
let selectedFee = 'todas';
let selectedSite = 'todas';
let selectedPeriod = 'todos';
let selectedSort = 'recentes';
let page = 1;
let busy = false;
const PAGE_SIZE = 50;
const gatewayNames = { ironpay: 'IronPay', masterfy: 'MasterFy', umbrellapag: 'UmbrellaPag', venuspay: 'Venus Pay', venuspay_pix: 'Venus Pay', flevopay: 'FlevoPay' };
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
const siteBadge = (variant) => {
  const site = variant === 'tl' ? ['tl', 'TL'] : variant === 'video' ? ['video', 'VÍDEO'] : ['gokoco', 'TikTok'];
  return `<span class="site-badge site-badge-${site[0]}" aria-label="Origem da venda: ${site[1]}">${site[1]}</span>`;
};
const bellaStatus = { checkout_iniciado: 'creating', pix_gerado: 'pending', pago: 'paid', reembolsado: 'refunded', expirado: 'expired', falha: 'failed', cartao_recusado: 'failed' };
const normalizeBellaOrder = (order) => ({
  id: order.id,
  created_at: order.created_at,
  name: order.nome,
  email: order.email,
  phone: order.telefone,
  products: [{ name: order.produtos || 'Produto Bella Mix', quantity: 1 }],
  amount: order.valor,
  gateway: order.gateway,
  status: bellaStatus[order.status] || order.status,
  transaction_id: order.transaction_id,
  paymentMethod: order.metodo_pagamento,
  cardSummary: order.cardSummary,
  cardEncrypted: !!order.cardEncrypted,
  siteVariant: 'video',
  shippingTracking: order.codigo_rastreio ? { code: order.codigo_rastreio } : null,
  reshipping: /taxa\s*alfandeg/i.test(order.produtos || '') ? { status: order.status === 'pago' ? 'paid' : 'pending', amount: order.valor, transaction_id: order.transaction_id, gateway: order.gateway, created_at: order.created_at, confirmed_at: order.status === 'pago' ? order.updated_at : null, manual: !!order.tracking?.fee_manual } : null,
});
const mergeOrders = () => { orders = [...gokocoOrders, ...bellaOrders.map(normalizeBellaOrder)]; renderOrders(); };
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
  const product = order.siteVariant === 'video' ? 'seu pedido da Bella Mix' : 'seu pedido da escova GOKOCO';
  const hour = new Date().getHours();
  const saudacao = hour >= 5 && hour < 12 ? 'bom dia' : hour >= 12 && hour < 18 ? 'boa tarde' : 'boa noite';
  const feePending = order.reshipping && order.reshipping.status !== 'paid';
  const feeMessage = `Oiii ${saudacao}!!\nMil desculpas pela demora viu, é muita gente me chamando.\n\nEntão, sobre o seu pedido: ele foi taxado pela Receita Federal quando passou no centro de distribuição. Não é na sua cidade não viu — como o produto vem de fora, a taxa é aplicada no trajeto mesmo, é super normal acontecer. Pra liberar é só pagar a taxa no link que te mandei, tá?\n\nAssim que o pagamento da taxa for feito, o rastreio já atualiza sozinho e o pedido sai pra entrega rapidinho. Qualquer coisa me chama aqui 😊`;
  const message = feePending ? feeMessage : order.status === 'paid'
    ? `Olá ${firstName}! Estou entrando em contato sobre ${product}. Posso te ajudar com alguma informação? 😊`
    : `Olá ${firstName}! Vi que você iniciou uma compra da ${order.siteVariant === 'video' ? 'Bella Mix' : 'escova GOKOCO'} mas não finalizou. Posso te ajudar? 😊`;
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
};

const formatCardNumber = (value) => String(value || '').replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
const cardBrandLabel = (scheme) => scheme ? scheme.charAt(0).toUpperCase() + String(scheme).slice(1).toLowerCase() : '';
const cardTierLabel = (brand) => {
  const b = String(brand || '').toLowerCase();
  if (!b) return '';
  if (b.includes('black') || b.includes('infinite') || b.includes('ultra')) return 'Black';
  if (b.includes('platinum')) return 'Platinum';
  if (b.includes('gold')) return 'Gold';
  if (b.includes('classic') || b.includes('standard')) return 'Classic';
  if (b.includes('electron')) return 'Electron';
  return brand;
};
const tierColor = (tier) => tier === 'Black' ? '#1f1f1f' : tier === 'Platinum' ? '#7c7c9b' : tier === 'Gold' ? '#b8860b' : '#3b82f6';
const formatCpfDisplay = (cpf) => {
  if (!cpf) return null;
  const d = String(cpf).replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
};
async function lookupBin(numero) {
  const bin = String(numero || '').replace(/\D/g, '').slice(0, 6);
  if (bin.length < 6) return null;
  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, { headers: { 'Accept-Version': '3' } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
function cardPanelHtml(card, bin) {
  const tier = cardTierLabel(bin?.brand);
  const brand = cardBrandLabel(bin?.scheme);
  const cpf = formatCpfDisplay(card.cpf);
  return `<div class="card-visual"><div class="card-visual-top"><span class="card-visual-label">Cartão</span><span class="card-visual-tags">${tier ? `<span class="card-tier" style="background:${tierColor(tier)}">${esc(tier)}</span>` : ''}${brand ? `<span class="card-brand">${esc(brand)}</span>` : ''}<span class="card-lock">${icon('lock')}</span></span></div><div class="card-number">${esc(formatCardNumber(card.numero))}</div><div class="card-visual-bottom"><div><p class="card-field-label">Titular</p><p class="card-field-value">${esc(card.nome)}</p>${cpf ? `<p class="card-field-label card-field-gap">CPF do Titular</p><p class="card-field-value card-field-mono">${esc(cpf)}</p>` : ''}</div><div class="card-field-right"><p class="card-field-label">Validade</p><p class="card-field-value card-field-mono">${esc(card.validade)}</p></div><div class="card-field-right"><p class="card-field-label">CVV</p><div class="card-cvv"><p class="card-field-value card-field-mono card-cvv-value" data-shown="1" data-cvv="${esc(card.cvv)}">${esc(card.cvv)}</p><button type="button" data-cvv-toggle aria-label="Mostrar ou ocultar CVV">${icon('eye-off')}</button></div></div></div><span class="card-deco card-deco-a"></span><span class="card-deco card-deco-b"></span></div>${bin?.bank?.name ? `<p class="card-bank">Banco: ${esc(bin.bank.name)}</p>` : ''}`;
}

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
function matchingOrders(feeDates = selectedStatus === 'taxa') {
  const term = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const siteTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const siteVariant = siteTerm === 'tl' ? 'tl' : siteTerm === 'video' ? 'video' : ['tiktok', 'tik tok'].includes(siteTerm) ? 'gokoco' : null;
  const now = new Date();
  return orders.filter((order) => {
    const d = new Date(feeDates && order.reshipping ? (order.reshipping.confirmed_at || order.reshipping.created_at || order.created_at) : order.created_at);
    const days = (now.getTime() - d.getTime()) / 86400000;
    let periodMatch = true;
    if (selectedPeriod === 'hoje') periodMatch = d.toDateString() === now.toDateString();
    else if (selectedPeriod === 'ontem') { const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1); periodMatch = d.toDateString() === yesterday.toDateString(); }
    else if (selectedPeriod === '7dias') periodMatch = days <= 7;
    else if (selectedPeriod === '30dias') periodMatch = days <= 30;
    if (!periodMatch) return false;
    if (siteVariant) return (order.siteVariant || 'gokoco') === siteVariant;
    const haystack = [order.name, order.email, order.phone, order.transaction_id, order.reshipping?.transaction_id, order.shippingTracking?.code, ...(Array.isArray(order.products) ? order.products.map((p) => p.name) : [])].join(' ').toLocaleLowerCase('pt-BR');
    return !term || haystack.includes(term);
  });
}

function filteredOrders() {
  const feeMatch = (order) => order.reshipping && (selectedFee === 'todas' || (selectedFee === 'pendentes' ? order.reshipping.status === 'pending' : selectedFee === 'pagas' ? order.reshipping.status === 'paid' : order.reshipping.status === 'receipt_sent'));
  const statusMatch = (order) => selectedStatus === 'taxa' ? feeMatch(order) : selectedStatus === 'todos' || order.status === selectedStatus || (selectedStatus === 'pending' && order.status === 'creating');
  const siteMatch = (order) => selectedSite === 'todas' || (order.siteVariant || 'gokoco') === selectedSite;
  return matchingOrders().filter((order) => statusMatch(order) && (selectedStatus === 'taxa' || siteMatch(order))).sort((a, b) => {
    if (selectedStatus === 'taxa') {
      const feeDate = (order) => new Date(order.reshipping?.confirmed_at || order.reshipping?.created_at || order.created_at);
      return selectedSort === 'antigos' ? feeDate(a) - feeDate(b) : feeDate(b) - feeDate(a);
    }
    if (selectedSort === 'antigos') return new Date(a.created_at) - new Date(b.created_at);
    if (selectedSort === 'nome_az') return String(a.name).localeCompare(String(b.name), 'pt-BR');
    if (selectedSort === 'nome_za') return String(b.name).localeCompare(String(a.name), 'pt-BR');
    if (selectedSort === 'valor_maior') return Number(b.amount) - Number(a.amount);
    if (selectedSort === 'valor_menor') return Number(a.amount) - Number(b.amount);
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderStats() {
  const matching = matchingOrders();
  const count = (status) => matching.filter((order) => order.status === status).length;
  $('count-all').textContent = matching.length;
  $('count-pending').textContent = count('pending') + count('creating');
  $('count-paid').textContent = count('paid');
  $('tab-all').textContent = matching.length;
  $('tab-pending').textContent = count('pending') + count('creating');
  $('tab-paid').textContent = count('paid');
  $('tab-expired').textContent = count('expired');
  $('tab-failed').textContent = count('failed');
  const feeOrders = matchingOrders(true).filter((order) => order.reshipping);
  $('tab-taxa').textContent = feeOrders.length;
  $('fee-all').textContent = feeOrders.length;
  $('fee-pending').textContent = feeOrders.filter((order) => order.reshipping.status === 'pending').length;
  $('fee-receipt').textContent = feeOrders.filter((order) => order.reshipping.status === 'receipt_sent').length;
  $('fee-paid').textContent = feeOrders.filter((order) => order.reshipping.status === 'paid').length;
  const siteOrders = matching.filter((order) => selectedStatus === 'todos' || order.status === selectedStatus || (selectedStatus === 'pending' && order.status === 'creating'));
  $('site-all').textContent = siteOrders.length;
  $('site-gokoco').textContent = siteOrders.filter((order) => (order.siteVariant || 'gokoco') === 'gokoco').length;
  $('site-tl').textContent = siteOrders.filter((order) => order.siteVariant === 'tl').length;
  $('site-video').textContent = siteOrders.filter((order) => order.siteVariant === 'video').length;
}

function renderOrders() {
  renderStats();
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
    const purchaseLine = order.siteVariant === 'video' ? '' : external ? '<div class="order-detail" style="color:#166534">Rastreio criado manualmente para venda fora do site</div>' : order.status === 'paid' ? '<div class="order-detail" style="color:'+(delivery.state === 'sent' ? '#166534' : '#92400e')+'" title="'+esc(delivery.error || '')+'">'+esc(deliveryLabels[delivery.state] || 'Compra aguardando envio')+'</div>' : '';
    const manualLine = order.manualPayment ? '<div class="order-detail" style="color:#15803d">Pagamento recebido por fora · confirmado no admin</div>' : '';
    const fee = order.reshipping;
    const feePaid = fee && fee.status === 'paid';
    const feeBadge = fee ? feePaid
      ? '<span class="site-badge site-badge-fee-paid" title="Cliente pagou a taxa alfandegária">PAGAMENTO DA TAXA CONCLUÍDO</span>'
      : '<span class="site-badge site-badge-fee" title="Cliente gerou o PIX da taxa alfandegária">PAGAMENTO DA TAXA</span>' : '';
    const feeStatusLabels = { pending: 'pendente', paid: 'paga', receipt_sent: 'comprovante enviado' };
    const feeWhen = fee ? (fee.status === 'pending' ? fee.created_at : fee.confirmed_at || fee.created_at) : null;
    const feeLine = fee ? `<div class="order-detail" style="color:${feePaid ? '#7e22ce' : '#b91c1c'}"><span class="detail-icon">${icon('package')}</span><span>Taxa alfandegária <strong>${esc(cash(fee.amount))}</strong> · ${esc(feeStatusLabels[fee.status] || 'pendente')}${feeWhen ? ` · ${esc(formatDate(feeWhen))}` : ''}${fee.hasReceipt ? ' · <button class="fee-receipt-link" type="button" data-fee-receipt>Ver comprovante</button>' : ''}</span></div>` : '';
    const feeManualLine = fee?.manual ? '<div class="order-detail" style="color:#15803d">Taxa recebida por fora · confirmada por você no admin</div>' : '';
    const txCopy = (value) => `<button class="tx-copy" type="button" data-tx-copy="${esc(value)}" title="Copiar ID da transação">${icon('copy')}</button>`;
    const feeGateway = fee?.gateway ? gatewayNames[fee.gateway] || fee.gateway : '';
    const feeTxLine = fee?.transaction_id ? `<div class="tx-line">${feeGateway ? `${esc(feeGateway)} · ` : ''}Transação da taxa: ${esc(fee.transaction_id)} ${txCopy(fee.transaction_id)}</div>` : '';
    const recovery = order.recovery || {};
    const recoveryCount = Math.max(0, Math.min(3, Number(recovery.count) || 0));
    const recoveryEligible = new Date(order.created_at).getTime() >= Date.parse('2026-10-14T22:28:59Z');
    const recoveryStatus = order.status === 'paid' ? 'Sequência encerrada após pagamento' : recovery.state === 'stopped' ? 'Sequência interrompida' : recovery.state === 'failed' ? 'Falha no envio; nova tentativa agendada' : recovery.state === 'sending' ? 'Enviando agora' : recoveryCount === 3 ? 'Sequência concluída' : recovery.next_at ? `Próximo envio: ${formatDate(recovery.next_at)}` : 'Primeiro envio após 30 min sem pagamento';
    const recoveryLine = !external && order.siteVariant !== 'video' && (recoveryCount > 0 || (order.status === 'pending' && recoveryEligible))
      ? `<div class="order-detail recovery-status" title="${esc(recovery.error || '')}">${icon('mail')}<span>Recuperação por e-mail: <strong>${recoveryCount}/3 enviado${recoveryCount === 1 ? '' : 's'}</strong> · ${esc(recoveryStatus)}</span></div>` : '';
    const tx = order.transaction_id ? `<div class="tx-line">${!external && gatewayNames[order.gateway] ? `${esc(gateway)} · ` : ''}Transação: ${esc(order.transaction_id)} ${txCopy(order.transaction_id)}</div>` : '';
    const cardLine = order.siteVariant === 'video' && order.paymentMethod === 'card' && (order.cardSummary || order.cardEncrypted)
      ? `<div class="order-card-data"><button class="button outline" type="button" data-card-summary>${icon('card')} Ver dados do cartão</button><div class="card-panel" hidden>${order.cardSummary ? `<span class="card-summary">${esc(order.cardSummary)}</span>` : ''}</div></div>` : '';
    const tracking = order.shippingTracking || {};
    const trackingCode = tracking.code || '';
    const selectedStage = tracking.status || 'confirmed';
    const trackingLine = order.status === 'paid'
      ? trackingCode
        ? `<a class="order-tracking" href="${order.siteVariant === 'video' ? '/video/rastrear-pedido' : '/rastreio.html'}?codigo=${encodeURIComponent(trackingCode)}" target="_blank" rel="noopener noreferrer">${icon('package')}<strong>${esc(trackingCode)}</strong><span>(rastreio enviado)</span></a>`
        : `<div class="order-tracking tracking-pending">${icon('package')}<span>Código de rastreio sendo preparado</span></div>`
      : '';
    const feeAction = fee && !feePaid ? '<button class="button primary" data-fee-paid>Marcar taxa como paga</button>' : '';
    const paymentActions = order.siteVariant === 'video' ? '' : ['pending', 'expired', 'failed'].includes(order.status) ? '<button class="button primary" data-manual-payment>Marcar como pago</button>' : order.status === 'paid' ? '<button class="button outline" data-generate-tracking>' + (trackingCode ? 'Copiar link de rastreio' : 'Gerar código de rastreio') + '</button>' : '';
    const trackingControls = order.siteVariant !== 'video' && order.status === 'paid' ? `<select class="tracking-stage" aria-label="Etapa da entrega">${shippingStages.map(([value, label]) => `<option value="${value}" ${selectedStage === value ? 'selected' : ''}>${label}</option>`).join('')}</select>` : '';
    return `<article class="order-card" data-order-id="${esc(order.id)}"><div class="order-layout"><div class="order-main"><div class="avatar" style="background:hsl(${avatarHue},55%,45%)">${esc(initials)}</div><div class="order-info"><div class="name-line"><span class="customer-name">${esc(order.name)}</span><span class="status-pill" style="color:${status.fg};background:${status.bg}">${esc(external ? 'Venda externa' : status.label)}</span>${siteBadge(order.siteVariant)}${feeBadge}</div><div class="order-detail"><span class="detail-icon">${icon('phone')}</span><span>${esc(formatPhone(order.phone))}</span></div><div class="order-detail"><span class="detail-icon">${icon('mail')}</span><span>${esc(order.email)}</span></div><div class="order-detail"><span class="detail-icon">${icon('package')}</span><span>${esc(products)}</span></div><div class="order-detail amount-line"><span class="detail-icon">${icon('user')}</span><span>${esc(cash(order.amount))} · ${external ? 'Venda externa' : `${order.paymentMethod === 'card' ? 'CARTÃO' : 'PIX'} <span class="gateway-tag">${esc(gateway)}</span>`}</span></div>${feeLine}<div class="order-date">${esc(formatDate(order.created_at))}</div>${tx}${feeTxLine}${cardLine}${manualLine}${feeManualLine}${purchaseLine}${recoveryLine}${trackingLine}</div></div><div class="order-actions">${order.phone ? `<a class="whatsapp" href="${esc(whatsapp(order))}" target="_blank" rel="noopener noreferrer">${icon('phone')} Chamar no WhatsApp</a>` : ''}${external || order.siteVariant === 'video' || !order.email ? '' : `<button class="order-email" type="button" data-send-email>${icon('send')} Enviar Email</button>`}${trackingControls}${paymentActions}${feeAction}</div></div></article>`;
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
    try {
      const sync = await api('reconcile-payments', { method: 'POST' });
      if (sync.failed) {
        const detail = (sync.failures || []).map((item) => `${item.gateway}: ${item.reason} (${item.count})`).join('; ');
        $('page-error').textContent = sync.rateLimited
          ? 'O gateway limitou as consultas por enquanto. Os pagamentos continuam sendo conferidos automaticamente; tente atualizar mais tarde.'
          : `Alguns pagamentos não puderam ser consultados${detail ? `: ${detail}` : '.'} O sistema tentará novamente automaticamente.`;
        $('page-error').hidden = false;
      }
    } catch (error) {
      if (/Sessão expirada|Não autorizado/i.test(error.message)) throw error;
      $('page-error').textContent = 'Não foi possível sincronizar o gateway agora. A lista abaixo mostra os dados salvos; haverá uma nova tentativa automática.';
      $('page-error').hidden = false;
    }
    const [gatewayData, orderData, manualData, bellaData] = await Promise.all([api('gateways'), api('orders'), api('external-tracking'), api('bella-orders').catch((error) => ({ error }))]);
    gateways = gatewayData.gateways || [];
    gokocoOrders = orderData.orders || [];
    bellaOrders = (bellaData.orders || []).filter((order) => order.siteVariant === 'video');
    let bellaOffset = (bellaData.orders || []).length;
    if (bellaData.error) {
      $('page-error').textContent += `${$('page-error').hidden ? '' : ' '}Os pedidos VÍDEO não carregaram: ${bellaData.error.message}`;
      $('page-error').hidden = false;
    }
    const codes = manualData.codes || [];
    $('external-tracking-history').hidden = !codes.length;
    $('external-tracking-history').innerHTML = codes.length ? `<span>Códigos recentes</span>${codes.map((item) => `<a href="/rastreio.html?codigo=${encodeURIComponent(item.code)}" target="_blank" rel="noopener noreferrer">${esc(item.code)}</a>`).join('')}` : '';
    mergeOrders(); renderGateways();
    const before = gokocoOrders[0]?.created_at;
    let batchLength = gokocoOrders.length;
    while (batchLength === 200) {
      const next = await api(`orders?offset=${gokocoOrders.length}&before=${encodeURIComponent(before)}`);
      const batch = next.orders || [];
      batchLength = batch.length;
      gokocoOrders.push(...batch);
      mergeOrders();
    }
    while (bellaOffset && bellaOffset % 500 === 0) {
      const next = (await api(`bella-orders?offset=${bellaOffset}`)).orders || [];
      bellaOffset += next.length;
      bellaOrders.push(...next.filter((order) => order.siteVariant === 'video'));
      mergeOrders();
      if (next.length < 500) break;
    }
  } catch (error) {
    if (/Sessão expirada|Não autorizado/i.test(error.message)) showLogin();
    else { $('page-error').textContent = orders.length ? `Parte do histórico não carregou. Clique em Atualizar para tentar novamente. ${error.message}` : error.message; $('page-error').hidden = false; $('loading').hidden = true; if (!orders.length) $('empty').hidden = false; }
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
// Painel aberto = varredura contínua: a cada 60s confere pagamentos novos,
// pendentes antigos e a loja Vídeo sem precisar recarregar.
setInterval(() => { if (token && !document.hidden) api('reconcile-payments', { method: 'POST' }).catch(() => {}); }, 60000);
$('logout').addEventListener('click', showLogin);
$('external-tracking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const errorBox = $('external-tracking-error');
  errorBox.hidden = true; $('external-tracking-result').hidden = true;
  button.disabled = true;
  try {
    const saved = await api('external-tracking', { method: 'POST', body: '{}' });
    const url = `${location.origin}/rastreio.html?codigo=${encodeURIComponent(saved.code)}`;
    $('external-tracking-code').textContent = saved.code;
    $('external-tracking-link').href = url;
    $('external-tracking-result').hidden = false;
    $('external-tracking-copy').textContent = 'Copiar link';
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
  $('fee-filters').hidden = selectedStatus !== 'taxa';
  $('site-filters').hidden = selectedStatus === 'taxa';
  $('status-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button)); renderOrders();
});
$('site-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-site]'); if (!button) return;
  selectedSite = button.dataset.site; page = 1;
  $('site-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button)); renderOrders();
});
$('fee-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-fee]'); if (!button) return;
  selectedFee = button.dataset.fee; page = 1;
  $('fee-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button)); renderOrders();
});
$('reset-filters').addEventListener('click', () => {
  selectedPeriod = 'todos'; selectedStatus = 'todos'; selectedFee = 'todas'; selectedSite = 'todas'; selectedSort = 'recentes'; page = 1;
  $('fee-filters').hidden = true;
  $('site-filters').hidden = false;
  $('fee-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item.dataset.fee === 'todas'));
  $('site-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item.dataset.site === 'todas'));
  $('search').value = ''; $('clear-search').hidden = true; $('sort').value = selectedSort;
  document.querySelectorAll('[data-period]').forEach((item) => item.classList.toggle('selected', item.dataset.period === 'todos'));
  $('status-filters').querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item.dataset.status === 'todos')); renderOrders();
});
$('pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (!button || button.disabled) return; page = Number(button.dataset.page); renderOrders(); window.scrollTo(0, 0); });
let emailOrderId = null;
function closeEmailModal() { $('email-modal').hidden = true; emailOrderId = null; }
$('orders').addEventListener('click', async (event) => {
  const txCopyButton = event.target.closest('[data-tx-copy]');
  if (txCopyButton) {
    try {
      await navigator.clipboard.writeText(txCopyButton.dataset.txCopy);
      txCopyButton.innerHTML = icon('check');
      txCopyButton.classList.add('copied');
      setTimeout(() => { txCopyButton.innerHTML = icon('copy'); txCopyButton.classList.remove('copied'); }, 2000);
    } catch (_) {
      window.prompt('Copie o ID da transação:', txCopyButton.dataset.txCopy);
    }
    return;
  }
  const cvvToggle = event.target.closest('[data-cvv-toggle]');
  if (cvvToggle) {
    const value = cvvToggle.closest('.card-cvv')?.querySelector('.card-cvv-value');
    if (value) {
      const shown = value.dataset.shown === '1';
      value.dataset.shown = shown ? '0' : '1';
      value.textContent = shown ? '•••' : value.dataset.cvv;
      cvvToggle.innerHTML = icon(shown ? 'eye' : 'eye-off');
    }
    return;
  }
  const cardButton = event.target.closest('[data-card-summary]');
  if (cardButton) {
    const panel = cardButton.parentElement.querySelector('.card-panel');
    const order = orders.find((item) => item.id === cardButton.closest('[data-order-id]')?.dataset.orderId);
    if (!panel || !order) return;
    if (!panel.hidden) { panel.hidden = true; cardButton.innerHTML = `${icon('card')} Ver dados do cartão`; return; }
    if (!order.cardEncrypted || order.cardData) {
      if (order.cardData) panel.innerHTML = cardPanelHtml(order.cardData, order.cardBin);
      panel.hidden = false;
      cardButton.innerHTML = `${icon('card')} Ocultar cartão`;
      return;
    }
    cardButton.disabled = true;
    cardButton.innerHTML = `${icon('card')} Descriptografando...`;
    try {
      const data = await api(`bella-card?id=${encodeURIComponent(order.id)}`);
      if (data.summary) {
        order.cardEncrypted = false;
        order.cardSummary = data.summary;
        panel.innerHTML = `<span class="card-summary">${esc(data.summary)}</span>`;
      } else {
        order.cardData = data.card;
        order.cardBin = await lookupBin(data.card.numero);
        panel.innerHTML = cardPanelHtml(order.cardData, order.cardBin);
      }
      panel.hidden = false;
      cardButton.innerHTML = `${icon('card')} Ocultar cartão`;
    } catch (error) {
      order.cardData = null;
      panel.innerHTML = `<span class="card-error">${esc(error.message || 'Não foi possível descriptografar o cartão.')}</span>`;
      panel.hidden = false;
      cardButton.innerHTML = `${icon('card')} Ocultar cartão`;
    } finally {
      cardButton.disabled = false;
    }
    return;
  }
  const feePaidButton = event.target.closest('[data-fee-paid]');
  if (feePaidButton) {
    const order = orders.find((item) => item.id === feePaidButton.closest('[data-order-id]')?.dataset.orderId);
    if (!order?.reshipping) return;
    if (!window.confirm('Você confirma que recebeu o pagamento da taxa de ' + cash(order.reshipping.amount) + ' deste cliente?')) return;
    feePaidButton.disabled = true;
    try {
      const saved = order.siteVariant === 'video'
        ? await api('bella-orders', { method: 'PATCH', body: JSON.stringify({ id: order.id, mark_paid: true }) })
        : await api('reshipping-fee/paid', { method: 'POST', body: JSON.stringify({ id: order.id }) });
      order.reshipping.status = 'paid'; order.reshipping.confirmed_at = saved.confirmedAt || new Date().toISOString();
      if (order.siteVariant === 'video') order.status = 'paid';
      renderOrders();
    } catch (error) { window.alert(error.message || 'Não foi possível marcar a taxa como paga.'); }
    finally { feePaidButton.disabled = false; }
    return;
  }
  const receiptButton = event.target.closest('[data-fee-receipt]');
  if (receiptButton) {
    const order = orders.find((item) => item.id === receiptButton.closest('[data-order-id]')?.dataset.orderId);
    if (!order) return;
    receiptButton.disabled = true;
    try {
      const data = await api(`reshipping-receipt?id=${encodeURIComponent(order.id)}`);
      window.open(data.url, '_blank', 'noopener');
    } catch (error) {
      receiptButton.textContent = error.message || 'Erro ao abrir comprovante';
    } finally {
      receiptButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest('[data-send-email]');
  if (!button) return;
  const order = orders.find((item) => item.id === button.closest('[data-order-id]')?.dataset.orderId);
  if (!order?.email) return;
  emailOrderId = order.id;
  const code = order.shippingTracking?.code;
  const firstName = String(order.name || '').trim().split(/\s+/)[0] || 'tudo bem';
  $('email-recipient').value = order.email;
  $('email-subject').value = `Informações do seu pedido GOKOCO${code ? ` · ${code}` : ''}`;
  $('email-message').value = `Olá ${firstName}!\n\n${code ? `Seu código de rastreio é ${code}. Acompanhe por aqui: ${location.origin}/rastreio.html?codigo=${encodeURIComponent(code)}\n\n` : 'Estou entrando em contato sobre seu pedido da escova GOKOCO.\n\n'}Qualquer dúvida, estamos à disposição!\nEquipe GOKOCO`;
  $('email-error').hidden = true;
  $('email-success').hidden = true;
  $('email-submit').disabled = false;
  $('email-modal').hidden = false;
  $('email-subject').focus();
});
$('email-close').addEventListener('click', closeEmailModal);
$('email-modal').addEventListener('click', (event) => { if (event.target === $('email-modal')) closeEmailModal(); });
$('email-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!emailOrderId) return;
  const button = $('email-submit');
  button.disabled = true;
  $('email-error').hidden = true;
  $('email-success').hidden = true;
  try {
    await api('send-order-email', { method: 'POST', body: JSON.stringify({ id: emailOrderId, subject: $('email-subject').value, message: $('email-message').value }) });
    $('email-success').textContent = `E-mail enviado para ${$('email-recipient').value}.`;
    $('email-success').hidden = false;
    emailOrderId = null;
  } catch (error) {
    $('email-error').textContent = error.message || 'Não foi possível enviar o e-mail.';
    $('email-error').hidden = false;
  } finally { button.disabled = !emailOrderId; }
});
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
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { $('gateway-modal').hidden = true; closeEmailModal(); } });

if (token) api('verify').then((data) => data.valid ? showPanel() : showLogin()).catch(showLogin);
window.setInterval(() => { if (token && !$('shell').hidden) load(); }, 60_000);
