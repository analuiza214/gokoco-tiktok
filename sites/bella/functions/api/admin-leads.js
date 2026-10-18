import { verifyAdminToken } from "../_lib/admin-auth.js";

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const ALLOWED_CHANGES = new Set([
  "status", "codigo_rastreio", "recovery_count", "recovery_next_at", "updated_at",
]);

function config(env) {
  return {
    url: String(env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}

async function supabase(env, path, options = {}) {
  const { url, key } = config(env);
  if (!url || !key) throw new Error("Banco de dados da Bella Mix não configurado.");
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function jsonResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Banco respondeu ${response.status}.`);
  return data;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: HEADERS });
  const auth = await verifyAdminToken(request, env);
  if (!auth.valid) return new Response(JSON.stringify({ error: auth.error }), { status: 401, headers: HEADERS });

  try {
    if (request.method === "GET") {
      const leadId = new URL(request.url).searchParams.get("id");
      const query = leadId
        ? `leads?id=eq.${encodeURIComponent(leadId)}&produtos=ilike.*Escova*&select=*&limit=1`
        : "leads?produtos=ilike.*Escova*&select=*&order=created_at.desc";
      const rows = await jsonResponse(await supabase(env, query));
      return new Response(JSON.stringify(leadId ? (rows?.[0] || null) : (rows || [])), { headers: HEADERS });
    }

    const body = await request.json();
    if (request.method === "PATCH") {
      if (!body?.id || !body?.changes || typeof body.changes !== "object") {
        return new Response(JSON.stringify({ error: "Pedido e alterações são obrigatórios." }), { status: 400, headers: HEADERS });
      }
      const changes = Object.fromEntries(
        Object.entries(body.changes).filter(([key]) => ALLOWED_CHANGES.has(key)),
      );
      changes.updated_at = new Date().toISOString();
      const rows = await jsonResponse(await supabase(env, `leads?id=eq.${encodeURIComponent(body.id)}&produtos=ilike.*Escova*&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(changes),
      }));
      return new Response(JSON.stringify({ ok: true, lead: rows?.[0] || null }), { headers: HEADERS });
    }

    if (request.method === "POST" && body?.action === "register_tracking") {
      const codigo = String(body.codigo || "").trim().toUpperCase();
      if (!codigo) return new Response(JSON.stringify({ error: "Código obrigatório." }), { status: 400, headers: HEADERS });
      await jsonResponse(await supabase(env, "rastreio_origem?on_conflict=codigo", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ codigo, origem_at: new Date().toISOString(), nome_cliente: body.nomeCliente || null }),
      }));
      return new Response(JSON.stringify({ ok: true }), { headers: HEADERS });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Erro ao acessar os pedidos." }), { status: 500, headers: HEADERS });
  }
}
