// Cloudflare Pages Function — /api/card/status?id=<transactionId>
//
// Consulta o status de uma transação de CARTÃO no Supabase (tabela leads).
// A Venus Pay não expõe endpoint público de consulta de status; usamos a
// abordagem síncrona: o status é salvo na tabela leads no momento da criação
// (checkout.tsx) e aqui apenas lemos o valor já persistido.
//
// Mapeamento de status da tabela leads → resposta padrão do site:
//   pago                → paid
//   cartao_processando  → pending
//   cartao_recusado     → declined
//   (qualquer outro)    → pending  (fallback conservador enquanto atualiza)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const id  = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "id obrigatório" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // ── Credenciais Supabase ─────────────────────────────────────────────────────
  const supabaseUrl = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !supabaseKey) {
    // Supabase não configurado — responde pending para o polling continuar
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Busca a lead pelo transaction_id
    const res = await fetch(
      `${supabaseUrl}/rest/v1/leads?transaction_id=eq.${encodeURIComponent(id)}&select=status&limit=1`,
      {
        headers: {
          "apikey":        supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!res.ok) {
      // Falha de rede ou erro do Supabase — fallback conservador
      return new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const leads = await res.json();
    const leadStatus = Array.isArray(leads) && leads.length > 0
      ? String(leads[0].status || "")
      : "";

    // ── Mapeia status do Supabase para o formato esperado pelo checkout.tsx ──
    let status;
    if (leadStatus === "pago") {
      status = "paid";
    } else if (leadStatus === "cartao_recusado") {
      status = "declined";
    } else {
      // cartao_processando ou ainda não atualizado → continua polling
      status = "pending";
    }

    console.log(JSON.stringify({
      event:       "VENUS_PAY_CARD_STATUS_CHECK",
      transactionId: id,
      leadStatus,
      mappedStatus: status,
    }));

    return new Response(JSON.stringify({ status, rawStatus: leadStatus }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch {
    // Qualquer exceção → responde pending (o polling tenta novamente em 5s)
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: corsHeaders,
    });
  }
}
