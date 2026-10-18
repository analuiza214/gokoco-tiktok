import { getActivePixGateway, listGateways } from "../_lib/gateway-config.js";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  const requiredServerConfig = {
    supabaseUrl: !!String(env.SUPABASE_URL || "").trim(),
    supabaseServiceRole: !!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    siteUrl: !!String(env.SITE_URL || "").trim(),
    pixRateLimit: !!env.PIX_RATELIMIT,
  };
  let databaseProject = null;
  try {
    databaseProject = new URL(String(env.SUPABASE_URL || "")).hostname.split(".")[0] || null;
  } catch { /* URL ausente ou inválida */ }

  let gateways = [];
  let activePixGateway = null;
  let gatewayError = null;
  try {
    gateways = await listGateways(env);
    activePixGateway = await getActivePixGateway(env);
  } catch (error) {
    gatewayError = error instanceof Error ? error.message : "Falha ao consultar gateways.";
  }

  const pixGateways = gateways
    .filter((gateway) => gateway.method === "pix")
    .map(({ id, name, enabled, configured }) => ({ id, name, enabled, configured }));
  const ok = requiredServerConfig.supabaseUrl &&
    requiredServerConfig.supabaseServiceRole &&
    !!activePixGateway &&
    !gatewayError;

  return new Response(JSON.stringify({
    ok,
    store: "Bella Mix",
    databaseProject,
    requiredServerConfig,
    activePixGateway,
    pixGateways,
    gatewayError,
  }), { status: ok ? 200 : 503, headers });
}
