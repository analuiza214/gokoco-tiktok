// GET /api/card/config — expõe ao frontend qual gateway de cartão está ativo
// e a chave de tokenização PÚBLICA (MasterFy) quando for o gateway ativo.
// A chave de tokenização é publicável; a chave de API jamais aparece aqui.

import { listGateways } from "../../_lib/gateway-config.js";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

  try {
    const gateways = await listGateways(env);
    const cardGw = gateways.find((g) => g.method === 'card' && g.enabled) || null;
    if (!cardGw) {
      return new Response(JSON.stringify({ gateway: null }), { status: 200, headers: corsHeaders });
    }
    const tokenizationKey = cardGw.id === 'masterfy_card' ? String(env.MASTERFY_TOKENIZATION_KEY || '') : '';
    return new Response(JSON.stringify({ gateway: cardGw.id, tokenizationKey }), { status: 200, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({ gateway: null }), { status: 200, headers: corsHeaders });
  }
}
