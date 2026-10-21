/** Configuração de gateways — mesma tabela do admin (gokoco_gateways) com fallback padrão. */

const DEFAULT_GATEWAYS = [
  { id: "ironpay", name: "IronPay", method: "pix", enabled: false },
  { id: "masterfy", name: "MasterFy", method: "pix", enabled: false },
  { id: "umbrellapag", name: "UmbrellaPag", method: "pix", enabled: false },
  { id: "venuspay", name: "Venus Pay", method: "card", enabled: true },
  { id: "venuspay_pix", name: "Venus Pay", method: "pix", enabled: false },
  { id: "flevopay", name: "FlevoPay", method: "pix", enabled: false },
];

async function supabaseFetch(env, path) {
  const url = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Banco de gateways não configurado.");

  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!res.ok) throw new Error("Não foi possível consultar a configuração dos gateways.");
  try {
    return await res.json();
  } catch {
    throw new Error("Resposta inválida ao consultar gateways.");
  }
}

export function gatewayConfigured(env, id) {
  if (id === "ironpay") {
    return [env.IRONPAY_API_TOKEN, env.IRONPAY_OFFER_HASH, env.IRONPAY_PRODUCT_HASH]
      .every((value) => String(value || "").trim());
  }
  if (id === "masterfy") {
    return !!String(env.MASTERFY_API_KEY || "").trim();
  }
  if (id === "umbrellapag") {
    return !!String(env.UMBRELLAPAG_API_KEY || "").trim();
  }
  if (id === "flevopay") {
    return !!String(env.FLEVOPAY_API_KEY || "").trim();
  }
  // Cartão e PIX da Venus Pay usam a mesma credencial
  if (id === "venuspay" || id === "venuspay_pix") {
    return !!String(env.VENUS_PAY_SECRET_KEY || "").trim();
  }
  return false;
}

export async function listGateways(env) {
  const rows = await supabaseFetch(env, "/rest/v1/gokoco_gateways?select=id,enabled,updated_at");
  const saved = Array.isArray(rows) ? rows : [];
  const savedById = new Map(saved.map((gateway) => [gateway.id, gateway]));

  return DEFAULT_GATEWAYS.map((g) => {
    const row = savedById.get(g.id);
    // Sem registro salvo vale o padrão (cartão Venus Pay ligado); salvo sempre vence.
    return {
      ...g,
      enabled: row ? !!row.enabled : g.enabled,
      configured: gatewayConfigured(env, g.id),
      updated_at: row?.updated_at || null,
    };
  });
}

export async function getActivePixGateway(env) {
  const gateways = await listGateways(env);
  const active = gateways.filter((g) => g.method === "pix" && g.enabled);
  if (active.length > 1) throw new Error("Mais de um gateway PIX ativo. Salve novamente a escolha no painel.");
  if (!active.length) return null;
  if (!active[0].configured) throw new Error("O gateway PIX selecionado está sem credenciais completas.");
  return active[0].id;
}
