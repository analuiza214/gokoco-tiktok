// Cloudflare Pages Function — /api/admin-gateways
// Lista e gerencia gateways de pagamento (ativar/desativar).

import { verifyAdminToken } from "../_lib/admin-auth.js";
import { listGateways, setGatewayEnabled } from "../_lib/gateway-config.js";

const CORS = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }

  const auth = await verifyAdminToken(request, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: CORS });
  }

  if (request.method === "GET") {
    try {
      const gateways = await listGateways(env);
      const activePix = gateways.find((g) => g.method === "pix" && g.enabled);
      return new Response(
        JSON.stringify({ gateways, activePixGateway: activePix?.id || null }),
        { status: 200, headers: CORS }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Erro ao listar gateways." }), { status: 500, headers: CORS });
    }
  }

  if (request.method === "PATCH") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido." }), { status: 400, headers: CORS });
    }

    const { id, enabled } = body ?? {};
    if (!id || typeof enabled !== "boolean") {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: id, enabled (boolean)." }), { status: 400, headers: CORS });
    }

    try {
      const gateways = await setGatewayEnabled(env, id, enabled);
      const activePix = gateways.find((g) => g.method === "pix" && g.enabled);
      return new Response(
        JSON.stringify({ ok: true, gateways, activePixGateway: activePix?.id || null }),
        { status: 200, headers: CORS }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Erro ao atualizar gateway." }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
}
