(() => {
  const dialog = document.getElementById('pricing-dialog');
  const form = document.getElementById('pricing-form');
  const select = document.getElementById('pricing-product');
  const message = document.getElementById('pricing-message');
  const fields = ['originalPrice', 'salePrice', 'pixDiscountPercent', 'recoveryDiscountPercent'];
  let products = [], ready = false;
  async function api(method = 'GET', body) {
    const response = await fetch('/api/admin/product-prices', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível acessar os preços.');
    return data;
  }
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function preview() {
    const original = Number(form.elements.originalPrice.value), sale = Number(form.elements.salePrice.value);
    const pix = Math.round(sale * (1 - Number(form.elements.pixDiscountPercent.value) / 100) * 100) / 100;
    const recovery = Math.round(pix * (1 - Number(form.elements.recoveryDiscountPercent.value) / 100) * 100) / 100;
    document.getElementById('pricing-preview').textContent = original > 0 && sale > 0 && sale <= original
      ? `${Math.round((1 - sale / original) * 100)}% de desconto · Venda ${money(sale)} · Pix ${money(pix)} · Pix com recuperação ${money(recovery)} (antes de frete e complementos)` : 'O preço original deve ser maior ou igual ao preço de venda.';
  }
  function fill() {
    const p = products.find(p => p.id === select.value); if (!p) return;
    fields.forEach(key => { form.elements[key].value = p[key].toFixed(2); });
    preview();
  }
  async function load() {
    message.textContent = 'Carregando preços…';
    document.getElementById('pricing-save').disabled = true;
    const data = await api(); products = data.products; ready = data.ready;
    select.replaceChildren(...products.map(p => { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; return option; }));
    const chosen = document.getElementById('product-select').value;
    if (chosen.startsWith('forja:')) select.value = chosen;
    else if (chosen === 'forja') select.value = 'forja:soarfly-kit-ferramentas-4-em-1-48vf';
    fill(); message.textContent = ready ? '' : 'A edição ainda não está ativada no banco. A tabela de preços precisa ser instalada antes de salvar.';
    document.getElementById('pricing-save').disabled = !ready;
  }
  document.getElementById('pricing-open').addEventListener('click', async () => {
    dialog.showModal();
    try { await load(); } catch (error) { message.textContent = error.message; }
  });
  document.getElementById('pricing-close').addEventListener('click', () => dialog.close());
  select.addEventListener('change', () => { message.textContent = ready ? '' : message.textContent; fill(); });
  form.addEventListener('input', preview);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('pricing-save'); button.disabled = true; message.textContent = 'Salvando…';
    const old = products.find(p => p.id === select.value);
    try {
      const data = await api('PATCH', { id: old.id, version: old.version, ...Object.fromEntries(fields.map(key => [key, Number(form.elements[key].value)])) });
      products = products.map(p => p.id === old.id ? data.product : p);
      message.textContent = 'Preço salvo. As páginas passam a usar os novos valores; pedidos e Pix existentes mantêm o valor original.';
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = !ready; }
  });
})();
