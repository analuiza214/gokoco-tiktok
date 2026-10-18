import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, CreditCard } from "lucide-react";

type Phase = "attention" | "declined" | "expand" | "content";

export default function CardDeclinedPage() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("attention");
  const [expanding, setExpanding] = useState(false);

  const rawCard = typeof window !== "undefined" ? sessionStorage.getItem("cardData") : null;
  const card = rawCard
    ? (() => { try { return JSON.parse(rawCard); } catch { return null; } })()
    : null;
  const bankName = card?.bank?.name || "Cartão";
  const last4 = card?.last4 || "****";

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("declined"), 1800);
    const t2 = setTimeout(() => setExpanding(true), 2800);
    const t3 = setTimeout(() => setPhase("content"), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  /* ── Attention phase: orange animated dots ── */
  if (phase === "attention") {
    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-8">
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            border: "3px solid #FF6200",
            background: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <style>{`
              @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
              .dot1{animation:blink 1.2s infinite 0s}
              .dot2{animation:blink 1.2s infinite 0.2s}
              .dot3{animation:blink 1.2s infinite 0.4s}
            `}</style>
            <div style={{ display: "flex", gap: 4 }}>
              <div className="dot1" style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6200" }} />
              <div className="dot2" style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6200" }} />
              <div className="dot3" style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF6200" }} />
            </div>
          </div>
          <p className="text-[18px] font-semibold text-gray-800">Verificando pagamento...</p>
        </div>
      </div>
    );
  }

  /* ── Declined + Expand phases: red dot expanding ── */
  if (phase === "declined" || phase === "expand") {
    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex flex-col items-center justify-center overflow-hidden">
        <div style={{
          width: expanding ? "300vmax" : 64,
          height: expanding ? "300vmax" : 64,
          borderRadius: "50%",
          background: "#D32F2F",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: expanding ? "width 0.9s ease-in, height 0.9s ease-in" : "none",
          position: "absolute",
        }}>
          {!expanding && (
            <X className="w-7 h-7 text-white" strokeWidth={3} />
          )}
        </div>
      </div>
    );
  }

  /* ── Content ── */
  return (
    <div className="fixed inset-0 max-w-[480px] mx-auto flex flex-col bg-[#EBEBEB] overflow-y-auto">
      <div className="bg-[#D32F2F] h-2 shrink-0" />

      <div className="bg-white shadow-sm relative">
        <button
          onClick={() => navigate("/")}
          className="absolute top-3 right-3 p-1 text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-[#D32F2F] flex items-center justify-center bg-white">
              <CreditCard className="w-8 h-8 text-[#D32F2F]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#D32F2F] flex items-center justify-center border-2 border-white">
              <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-1">Pagamento não autorizado</p>
          <h1 className="text-xl font-bold text-gray-900 leading-snug">
            O pagamento de R$ 37,90 não pôde ser autorizado pelo banco
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {bankName} **** {last4}
          </p>
        </div>
      </div>

      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          O que fazer agora?
        </h2>

        <ol className="space-y-3 mb-6">
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">1.</span>
            <span>Entre em contato com seu banco para liberar o pagamento.</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">2.</span>
            <span>Verifique se o limite do cartão é suficiente para esta compra.</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">3.</span>
            <span>Ou pague agora via Pix — instantâneo e sem necessidade de autorização.</span>
          </li>
        </ol>

        <button
          onClick={() => navigate("/success?payment=pix&from=declined")}
          className="w-full h-12 rounded-xl bg-[#3483FA] text-white font-semibold text-base active:opacity-80 mb-3"
        >
          Pagar via Pix
        </button>

        <button
          onClick={() => navigate("/cep")}
          className="w-full text-[#3483FA] font-medium text-sm text-center py-2"
        >
          Inserir outro cartão
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}
