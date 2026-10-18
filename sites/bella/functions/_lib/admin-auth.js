/** Valida token Bearer emitido por /api/admin-login (mesmo formato de admin-verify). */

async function hmacSign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyAdminToken(request, env) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) return { valid: false, error: "Servidor não configurado." };

  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return { valid: false, error: "Não autorizado." };

  const dot = token.lastIndexOf(".");
  if (dot === -1) return { valid: false, error: "Token inválido." };

  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = await hmacSign(payloadB64, secret);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: "Token inválido." };
  }

  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return { valid: false, error: "Token inválido." };
  }

  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: "Sessão expirada." };
  }

  return { valid: true };
}
