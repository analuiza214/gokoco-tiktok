import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw, AlertCircle, X } from "lucide-react";
import type { PaymentGateway, PaymentGatewayMethod } from "@/lib/payment-gateways";
import { GATEWAY_METHOD_LABELS } from "@/lib/payment-gateways";

const ADMIN_TOKEN_KEY = "adm_token";

/** Valores de recuperação, usados apenas quando a tabela ainda não foi criada. */
const DEFAULT_GATEWAYS: PaymentGateway[] = [
  { id: "ironpay", name: "IronPay", method: "pix", enabled: true, configured: true },
  { id: "masterfy", name: "MasterFy", method: "pix", enabled: false, configured: true },
  { id: "umbrellapag", name: "UmbrellaPag", method: "pix", enabled: false, configured: true },
  { id: "venuspay", name: "Venus Pay", method: "card", enabled: true, configured: true },
  { id: "venuspay_pix", name: "Venus Pay", method: "pix", enabled: false, configured: true },
];

/** Ordem dos métodos dentro de cada gateway: Cartão primeiro, depois PIX */
const METHOD_ORDER: PaymentGatewayMethod[] = ["card", "pix"];

/**
 * Interruptor deslizante (estilo Facebook/celular).
 * Verde = ativado · Cinza = desativado
 */
function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400"
      style={{ width: 48, height: 28, background: checked ? "#22c55e" : "#d1d5db" }}
    >
      <span
        className="absolute rounded-full bg-white shadow-md transition-transform"
        style={{
          width: 22,
          height: 22,
          top: 3,
          left: 3,
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

/**
 * Botão "Gateways" (fica no topo do admin, ao lado de Atualizar).
 * Ao clicar, abre a janela de gerenciamento dos gateways de pagamento.
 */
export function PaymentGatewaysButton() {
  const [open, setOpen] = useState(false);

  // Fecha a janela com a tecla Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 shrink-0"
        style={{ background: "#15803d" }}
      >
        <CreditCard className="h-3.5 w-3.5 shrink-0" />
        Gateways
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8"
            onClick={e => e.stopPropagation()}
          >
            <PaymentGatewaysSection onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Conteúdo da janela de gateways: lista agrupada por gateway, com um
 * interruptor para cada método (Cartão / PIX).
 * Também pode ser usado solto na página, sem a prop onClose.
 */
export function PaymentGatewaysSection({ onClose }: { onClose?: () => void }) {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSql, setNeedsSql] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const applyGateways = useCallback((list: PaymentGateway[]) => {
    setGateways(list);
  }, []);

  function adminHeaders(): HeadersInit {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
  }

  function mapGatewayRows(list: PaymentGateway[]): PaymentGateway[] {
    return list.map(row => ({
      id: row.id,
      name: row.name,
      method: row.method === "card" ? "card" : "pix",
      enabled: !!row.enabled,
      configured: row.configured !== false,
      updated_at: row.updated_at ?? null,
    }));
  }

  const fetchGateways = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsSql(false);

    try {
      const res = await fetch(import.meta.env.BASE_URL + "api/admin-gateways", { headers: adminHeaders() });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        throw new Error("Sessão expirada. Saia e entre novamente no admin.");
      }
      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar gateways.");
      }

      const list = Array.isArray(data.gateways) ? data.gateways : [];
      if (list.length === 0) {
        setNeedsSql(true);
        applyGateways([]);
        setError("Nenhum gateway encontrado. Execute supabase/payment_gateways.sql no Supabase.");
        return;
      }

      applyGateways(mapGatewayRows(list));
    } catch (err) {
      applyGateways([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar gateways.");
    } finally {
      setLoading(false);
    }
  }, [applyGateways]);

  useEffect(() => { fetchGateways(); }, [fetchGateways]);

  async function toggleGateway(id: string, enabled: boolean) {
    if (needsSql) {
      setError("Execute primeiro o SQL supabase/payment_gateways.sql no Supabase para salvar alterações.");
      return;
    }

    const target = gateways.find(g => g.id === id);
    if (!target) return;

    setUpdatingId(id);
    setError(null);

    // Atualiza na hora na tela — evita o interruptor voltar sozinho após o clique
    setGateways(prev =>
      prev.map(g => {
        if (g.id === id) return { ...g, enabled };
        if (enabled && target.method === "pix" && g.method === "pix" && g.id !== id) {
          return { ...g, enabled: false };
        }
        return g;
      })
    );

    try {
      const res = await fetch(import.meta.env.BASE_URL + "api/admin-gateways", {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ id, enabled }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        throw new Error("Sessão expirada. Saia e entre novamente no admin.");
      }
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar gateway.");
      }

      if (Array.isArray(data.gateways)) {
        applyGateways(mapGatewayRows(data.gateways));
      } else {
        await fetchGateways();
      }
    } catch (err) {
      await fetchGateways();
      setError(err instanceof Error ? err.message : "Erro ao atualizar gateway.");
    } finally {
      setUpdatingId(null);
    }
  }

  // Agrupa por nome do gateway — a Venus Pay aparece uma vez, com Cartão e PIX
  const grupos = Array.from(
    gateways.reduce((map, g) => {
      const list = map.get(g.name) ?? [];
      list.push(g);
      map.set(g.name, list);
      return map;
    }, new Map<string, PaymentGateway[]>())
  )
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([name, list]) => [
      name,
      [...list].sort(
        (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
      ),
    ] as [string, PaymentGateway[]]);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#15803d" }}>
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-black text-gray-900 text-sm">Gateways de Pagamento</h2>
            <p className="text-xs text-gray-400">
              Apenas um gateway PIX pode ficar ativo por vez.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchGateways}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-xl text-xs leading-snug" style={{ background: "#fee2e2", color: "#991b1b" }}>
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        {loading && gateways.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando configuração dos gateways...
          </div>
        ) : grupos.map(([name, list]) => (
          <div key={name} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-sm text-gray-900">{name}</span>
              {list.length > 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500">
                  Cartão e PIX
                </span>
              )}
            </div>

            <div className="space-y-2">
              {list.map(gateway => {
                const isUpdating = updatingId === gateway.id;
                return (
                  <div key={gateway.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                          {GATEWAY_METHOD_LABELS[gateway.method]}
                        </span>
                        <span
                          className="text-xs font-bold"
                          style={{ color: gateway.enabled ? "#166534" : "#9ca3af" }}
                        >
                          {isUpdating ? "Salvando..." : gateway.enabled ? "Ativado" : "Desativado"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {gateway.method === "pix"
                          ? "Usado na opção PIX do checkout"
                          : "Usado na opção Cartão do checkout"}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={gateway.enabled}
                      disabled={loading || updatingId !== null || needsSql}
                      onChange={() => toggleGateway(gateway.id, !gateway.enabled)}
                      label={`${name} ${GATEWAY_METHOD_LABELS[gateway.method]}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
