import catalog from '../sites/forja/catalogo-forja.json' with { type: 'json' };

export const forjaProducts = new Map(catalog.map(product => [product.id, product]));
export const FORJA_KIT = 'soarfly-kit-ferramentas-4-em-1-48vf';
const shippingPrices = { 'Frete Grátis': 0, JADLOG: 18.47, 'SEDEX 12': 33.40 };

// Preços e identidade vêm do catálogo do servidor, nunca do nome enviado pelo navegador.
export function forjaCart(cart, pricing = null) {
  const product = forjaProducts.get(cart?.sku);
  if (!product || !Number.isInteger(cart.qty) || cart.qty < 1 || cart.qty > 10) return null;
  if (!Object.hasOwn(shippingPrices, cart.shipping)) return null;
  const recovery = pricing?.version ? 1 - pricing.recoveryDiscountPercent / 100 : 0.5;
  if (!Array.isArray(cart.bumps) || cart.bumps.length || ![1, recovery].includes(cart.discount) || ![0, 5].includes(cart.bonus)) return null;
  if (!Array.isArray(cart.colors)) return null;
  if (cart.colors.length && (product.id !== FORJA_KIT || cart.colors.length > 3
    || cart.colors.some(color => !['Preta', 'Branca', 'Rosa'].includes(color.label) || !Number.isInteger(color.quantity) || color.quantity < 1)
    || cart.colors.reduce((sum, color) => sum + color.quantity, 0) !== cart.qty)) return null;
  const unit = pricing?.version ? Math.round(pricing.salePrice * (1 - pricing.pixDiscountPercent / 100) * 100) / 100 : product.price;
  const amount = (Math.round(unit * cart.qty * cart.discount * 100)
    + Math.round(shippingPrices[cart.shipping] * cart.discount * 100) - cart.bonus * 100) / 100;
  return {
    amount: Math.max(0.01, amount),
    productId: product.id,
    products: [{ id: product.id, name: product.title, quantity: cart.qty, image: `/forja${product.image}` }],
  };
}

export function orderStore(order) {
  return order?.tracking?.store_id === 'forja' || order?.tracking?.site_variant === 'forja' ? 'forja' : 'gokoco';
}

export function orderSite(env, order) {
  const base = String(env.SITE_URL || '').replace(/\/+$/, '');
  return orderStore(order) === 'forja' ? `${base}/forja` : base;
}
