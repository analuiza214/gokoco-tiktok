const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function settings(env) {
  return {
    url: String(env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}

async function request(env, path, options = {}) {
  const { url, key } = settings(env);
  if (!url || !key) throw new Error("Rastreamento não configurado.");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Banco respondeu ${response.status}.`);
  return response;
}

function validCode(value) {
  return /^BM[A-Z0-9]{6,10}$/.test(String(value || "").trim().toUpperCase().replace(/[-\s]/g, ""));
}

export async function onRequest({ request: incoming, env }) {
  try {
    if (incoming.method === "GET") {
      const codigo = new URL(incoming.url).searchParams.get("codigo")?.trim().toUpperCase().replace(/[-\s]/g, "") || "";
      if (!validCode(codigo)) return new Response(JSON.stringify({ error: "Código inválido." }), { status: 400, headers: HEADERS });
      const [originResponse, leadResponse] = await Promise.all([
        request(env, `/rest/v1/rastreio_origem?codigo=eq.${encodeURIComponent(codigo)}&select=origem_at&limit=1`),
        request(env, `/rest/v1/leads?codigo_rastreio=eq.${encodeURIComponent(codigo)}&select=nome,cidade,estado,cep,rua,numero,complemento,bairro&limit=1`),
      ]);
      const [origins, leads] = await Promise.all([originResponse.json(), leadResponse.json()]);
      if (!origins?.[0]?.origem_at) return new Response(JSON.stringify({ found: false }), { headers: HEADERS });
      return new Response(JSON.stringify({ found: true, origem_at: origins[0].origem_at, ...(leads?.[0] || {}) }), { headers: HEADERS });
    }

    if (incoming.method === "POST") {
      const form = await incoming.formData();
      const codigo = String(form.get("codigo") || "").trim().toUpperCase().replace(/[-\s]/g, "");
      const file = form.get("file");
      if (!validCode(codigo) || !(file instanceof File) || file.size > 8 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Comprovante inválido." }), { status: 400, headers: HEADERS });
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${codigo}/${Date.now()}-${safeName}`;
      const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
      const { url } = settings(env);
      await request(env, `/storage/v1/object/comprovantes/${encodedPath}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: file,
      });
      const publicUrl = `${url}/storage/v1/object/public/comprovantes/${encodedPath}`;
      await request(env, "/rest/v1/comprovantes_taxa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ tracking_code: codigo, file_url: publicUrl, file_name: file.name }),
      });
      return new Response(JSON.stringify({ ok: true }), { headers: HEADERS });
    }
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Erro no rastreamento." }), { status: 500, headers: HEADERS });
  }
}
