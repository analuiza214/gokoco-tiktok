const PRODUCTS = new Map([
  ["bella-escova-branca", { name: "Kit Escova 3 em 1 Branca", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-preta", { name: "Kit Escova 3 em 1 Preta", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-rose", { name: "Kit Escova 3 em 1 Rosê", price: 37.9, pixPrice: 34.11 }],
  ["bella-kit-7-em-1-bege", { name: "Kit 7 em 1 Escova Secadora Bege Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-branca", { name: "Kit 7 em 1 Escova Secadora Branca Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-preta", { name: "Kit 7 em 1 Escova Secadora Preta Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  // Compatibilidade legada
  ["bella-escova-azul-ceu", { name: "Escova Modeladora Azul Céu Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-verde", { name: "Escova Modeladora Verde Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-lilas", { name: "Escova Modeladora Lilás Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-escova-dourada", { name: "Escova Modeladora Dourada Bivolt com Luva, Caixa e 2 Prendedores", price: 37.9, pixPrice: 34.11 }],
  ["bella-kit-7-em-1-azul-ceu", { name: "Kit 7 em 1 Escova Secadora Azul Céu Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-lilas", { name: "Kit 7 em 1 Escova Secadora Lilás Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-rose", { name: "Kit 7 em 1 Escova Secadora Rosê Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
  ["bella-kit-7-em-1-verde", { name: "Kit 7 em 1 Escova Secadora Verde Bivolt com Caixa e 7 Acessórios", price: 69.9, pixPrice: 62.91 }],
]);

export function validateCartItems(rawItems, method) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Carrinho não informado.");
  }
  const normalized = rawItems.map((raw) => {
    const product = PRODUCTS.get(String(raw?.id || ""));
    const quantity = Number(raw?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("O carrinho contém um produto ou quantidade inválida.");
    }
    return { ...product, id: String(raw.id), quantity };
  });
  const priceKey = method === "pix" ? "pixPrice" : "price";
  const amount = Number(normalized.reduce((sum, item) => sum + item[priceKey] * item.quantity, 0).toFixed(2));
  const products = normalized.map((item) => `${item.name} (x${item.quantity})`).join(", ");
  const productName = normalized.map((item) => item.name).join(", ");
  return { amount, products, productName };
}

export function cardAmount(baseAmount, installments) {
  const count = Math.max(1, Math.min(12, Number.parseInt(String(installments || 1), 10) || 1));
  const total = count <= 5 ? Number(baseAmount) : Number(baseAmount) * Math.pow(1 + 0.0299, count);
  return Number(total.toFixed(2));
}
