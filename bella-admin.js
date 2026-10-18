(() => {
  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let orders = [];

  async function api(path, options = {}) {
    const token = sessionStorage.getItem('gokoco_admin_token');
    if (!token) throw new Error('Entre no painel GOKOCO para ver a Bella Mix.');
    const response = await fetch(`/api/admin/bella-${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Erro ao consultar a Bella Mix.');
    return data;
  }

  function showError(message) {
    byId('bella-error').textContent = message;
    byId('bella-error').hidden = !message;
  }

  function renderOrders() {
    const term = byId('bella-search').value.trim().toLocaleLowerCase('pt-BR');
    const visible = orders.filter((order) => [order.nome, order.email, order.telefone, order.produtos, order.transaction_id].join(' ').toLocaleLowerCase('pt-BR').includes(term));
    byId('bella-count').textContent = `${visible.length} pedido${visible.length === 1 ? '' : 's'} Bella Mix`;
    byId('bella-orders').innerHTML = visible.map((order) => `
      <article class="order-card" data-id="${escape(order.id)}">
        <div class="order-layout"><div class="order-main"><div class="order-info">
          <div class="name-line"><strong class="customer-name">${escape(order.nome)}</strong><span class="status-pill">${escape(order.status)}</span></div>
          <div class="order-detail">${escape(order.email)} · ${escape(order.telefone)}</div>
          <div class="order-detail">${escape(order.produtos)}</div>
          <div class="order-detail amount-line">${escape(money(order.valor))} · ${escape((order.metodo_pagamento || '').toUpperCase())} · ${escape(order.gateway || '')}</div>
          <div class="order-detail">${escape(order.cidade || '')}${order.estado ? `/${escape(order.estado)}` : ''} · ${escape(new Date(order.created_at).toLocaleString('pt-BR'))}</div>
          ${order.transaction_id ? `<div class="order-detail">Transação: ${escape(order.transaction_id)}</div>` : ''}
        </div></div><div class="order-actions"><label>Código de rastreio<input class="bella-tracking" value="${escape(order.codigo_rastreio || '')}" maxlength="50" placeholder="Código de rastreio"></label><button class="button outline bella-save" type="button">Salvar rastreio</button><button class="button outline bella-email" type="button" ${order.codigo_rastreio ? '' : 'disabled'}>Enviar rastreio por e-mail</button></div></div>
      </article>`).join('') || '<div class="empty-state">Nenhum pedido Bella Mix encontrado.</div>';
  }

  function renderGateways(gateways) {
    byId('bella-gateways').innerHTML = gateways.map((gateway) => `<label style="display:inline-flex;align-items:center;gap:8px;margin:8px 18px 8px 0"><input type="checkbox" data-gateway="${escape(gateway.id)}" ${gateway.enabled ? 'checked' : ''} ${gateway.configured ? '' : 'disabled'}> ${escape(gateway.name)} (${escape(gateway.method)})${gateway.configured ? '' : ' — sem chave'}</label>`).join('');
  }

  async function load() {
    showError('');
    try {
      const [orderData, gatewayData] = await Promise.all([api('orders'), api('gateways')]);
      orders = orderData.orders || [];
      while (orders.length && orders.length % 500 === 0) {
        const next = (await api(`orders?offset=${orders.length}`)).orders || [];
        orders.push(...next);
        if (next.length < 500) break;
      }
      renderOrders();
      renderGateways(gatewayData.gateways || []);
    } catch (error) { showError(error.message); }
  }

  byId('bella-open').addEventListener('click', () => {
    const opening = byId('bella-content').hidden;
    byId('bella-content').hidden = !opening;
    byId('gokoco-content').hidden = opening;
    byId('bella-open').textContent = opening ? 'Ver GOKOCO' : 'Bella Mix';
    if (opening) void load();
  });
  byId('bella-refresh').addEventListener('click', () => { void load(); });
  byId('bella-search').addEventListener('input', renderOrders);
  byId('bella-gateways').addEventListener('change', async (event) => {
    const input = event.target.closest('[data-gateway]');
    if (!input) return;
    input.disabled = true;
    try {
      const data = await api('gateways', { method: 'PATCH', body: JSON.stringify({ id: input.dataset.gateway, enabled: input.checked }) });
      renderGateways(data.gateways || []);
      showError('');
    } catch (error) { input.checked = !input.checked; input.disabled = false; showError(error.message); }
  });
  byId('bella-orders').addEventListener('click', async (event) => {
    const button = event.target.closest('.bella-save,.bella-email');
    if (!button) return;
    const card = button.closest('[data-id]');
    const code = card.querySelector('.bella-tracking').value.trim();
    button.disabled = true;
    try {
      if (button.classList.contains('bella-email')) {
        await api('tracking-email', { method: 'POST', body: JSON.stringify({ id: card.dataset.id }) });
        button.textContent = 'E-mail enviado';
      } else {
        await api('orders', { method: 'PATCH', body: JSON.stringify({ id: card.dataset.id, codigo_rastreio: code }) });
        const order = orders.find((item) => item.id === card.dataset.id);
        if (order) order.codigo_rastreio = code.toUpperCase();
        card.querySelector('.bella-email').disabled = false;
        button.textContent = 'Salvo';
      }
      showError('');
    } catch (error) { showError(error.message); }
    finally { button.disabled = false; }
  });
})();
