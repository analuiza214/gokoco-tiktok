import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export function FreteGratisBar() {
  const [location] = useLocation();
  const [cidade, setCidade] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setDeadline(`${hh}:${mm}`);

    // Cidade aproximada pelo IP: não acessa o GPS nem solicita permissão.
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Localização indisponível");
        return response.json();
      })
      .then(data => {
        if (!cancelled && typeof data.city === "string" && data.city.trim()) {
          setCidade(data.city.trim());
        }
      })
      // Se a consulta falhar, a barra continua funcionando sem exibir cidade.
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (location === "/sucesso" || location === "/rastrear-pedido") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white text-xs font-black text-center"
      style={{ background: "linear-gradient(90deg, #b91c1c 0%, #dc2626 50%, #b91c1c 100%)" }}
    >
      <span>🚚</span>
      <span>
        FRETE GRÁTIS até <strong>{deadline}</strong>
        {cidade && <> para <strong>{cidade}</strong></>}
      </span>
      <span className="ml-1 text-red-200 text-[10px] font-semibold hidden sm:inline">— Garanta o seu agora!</span>
    </div>
  );
}
