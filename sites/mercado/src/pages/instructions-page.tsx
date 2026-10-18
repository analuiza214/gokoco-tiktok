import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, CheckCircle2, Smartphone, ScanLine, ShieldCheck, Bell, RefreshCw } from "lucide-react";
import { img } from "@/lib/img";

interface PixData {
  transactionId?: string;
  pixCode?: string;
  qrCodeBase64?: string;
  qrCodeImage?: string;
}

const STEPS = [
  {
    icon: Smartphone,
    title: "Abra o app do seu banco",
    desc: "Acesse o Internet Banking ou qualquer carteira digital que suporte Pix (Nubank, Inter, Itaú, Bradesco, Caixa, etc.).",
  },
  {
    icon: ScanLine,
    title: "Escolha a opção Pix → Pagar",
    desc: "Dentro do app, vá em Pix e selecione \"Pagar\". Você pode escanear o QR Code abaixo ou usar a opção \"Pix Copia e Cola\".",
  },
  {
    icon: CheckCircle2,
    title: "Confirme os dados antes de pagar",
    desc: "Verifique o nome do recebedor, o valor de R$ 37,90 e a instituição. Só finalize quando os dados estiverem corretos.",
  },
  {
    icon: ShieldCheck,
    title: "Aprovação instantânea",
    desc: "O Pix é processado em segundos, 24 horas por dia, 7 dias por semana — inclusive fins de semana e feriados.",
  },
  {
    icon: Bell,
    title: "Você será notificado",
    desc: "Assim que o pagamento for confirmado, você receberá uma notificação e o prazo de entrega será atualizado automaticamente.",
  },
];

async function callPixApi(checkoutData: {
  name: string; email: string; phone?: string; document?: string;
  address: { city: string; street: string; neighborhood: string; number: string; zipCode?: string; state?: string };
  amount: number;
  checkoutId: string; quantity: number; color?: string;
}): Promise<PixData> {
  const res = await fetch("/api/market/pix/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: checkoutData.amount,
      checkoutId: checkoutData.checkoutId,
      quantity: checkoutData.quantity,
      color: checkoutData.color,
      name: checkoutData.name,
      email: checkoutData.email,
      phone: checkoutData.phone,
      document: checkoutData.document,
      address: checkoutData.address,
      productName: "Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt",
    }),
  });
  const data = await res.json() as { transactionId?: string; pixCode?: string; qrCodeBase64?: string; qrCodeImage?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

type RetryPhase = "idle" | "loading" | "dots" | "expand";

export default function InstructionsPage() {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);

  const [retryPhase, setRetryPhase] = useState<RetryPhase>("idle");
  const [retryExpanding, setRetryExpanding] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pixData");
    if (raw) {
      try { setPixData(JSON.parse(raw)); } catch { /* ignored */ }
    }
  }, []);

  const pixCode = pixData?.pixCode || "";
  const qrSrc = pixData?.qrCodeBase64
    ? `data:image/png;base64,${pixData.qrCodeBase64}`
    : pixData?.qrCodeImage || null;

  async function handleCopy() {
    try { await navigator.clipboard.writeText(pixCode); } catch { /* ignored */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleRetry() {
    setRetryError(null);
    setRetryPhase("loading");
    setRetryExpanding(false);

    const raw = sessionStorage.getItem("checkoutData");
    if (!raw) {
      setRetryError("Dados não encontrados. Volte e complete seus dados.");
      setRetryPhase("idle");
      return;
    }

    try {
      const checkoutData = JSON.parse(raw);
      const newPix = await callPixApi(checkoutData);

      sessionStorage.setItem("pixData", JSON.stringify(newPix));

      const t1 = setTimeout(() => setRetryPhase("dots"), 400);
      const t2 = setTimeout(() => setRetryExpanding(true), 800);
      const t3 = setTimeout(() => {
        setPixData(newPix);
        setRetryPhase("idle");
        setRetryExpanding(false);
      }, 1800);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } catch {
      setRetryError("Erro ao gerar novo Pix. Tente novamente.");
      setRetryPhase("idle");
    }
  }

  /* ── Retry overlay animation ── */
  if (retryPhase !== "idle") {
    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex flex-col items-center justify-center overflow-hidden">
        {retryPhase === "loading" && (
          <div className="flex flex-col items-center gap-8 px-10 text-center">
            <p className="text-[22px] font-semibold text-gray-900">Gerando novo Pix...</p>
            <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-[#3483FA] animate-spin" />
          </div>
        )}
        {(retryPhase === "dots" || retryPhase === "expand") && (
          <div
            style={{
              width: retryExpanding ? "300vmax" : 56,
              height: retryExpanding ? "300vmax" : 56,
              borderRadius: "50%",
              background: "#00A650",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: retryExpanding ? "width 0.9s ease-in, height 0.9s ease-in" : "none",
              position: "absolute",
            }}
          >
            {!retryExpanding && (
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 0.18, 0.36].map((delay, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%", background: "white",
                    animation: `pulse-dot 0.9s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>
        )}
        <style>{`
          @keyframes pulse-dot {
            0%,100%{transform:scale(0.6);opacity:0.5}
            50%{transform:scale(1);opacity:1}
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] max-w-[480px] mx-auto shadow-xl">

      {/* ── Header amarelo ── */}
      <div className="bg-ml-yellow px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate("/orders")} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>
        <span className="text-base font-semibold text-black">Instruções</span>
      </div>

      {/* ── Hero ── */}
      <div className="bg-white px-5 pt-6 pb-7 flex flex-col items-center text-center">
        <div className="mb-4">
          <svg viewBox="0 0 512 512" width="56" height="56" fill="none">
            <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.386 14.765-5.373 20.136 0l76.989 76.989c14.192 14.192 33.064 22 53.12 22h15.138l-97.2 97.2c-30.418 30.417-79.73 30.417-110.148 0l-97.49-97.497h10.642z" fill="#32BCAD"/>
            <path d="M112.57 120.81c20.056 0 38.928 7.808 53.12 22l76.693 76.692c5.565 5.566 14.57 5.566 20.136 0l76.989-76.989c14.192-14.192 33.064-22 53.12-22h10.642l-97.49-97.49c-30.418-30.417-79.73-30.417-110.148 0l-97.2 97.2 14.138-.413z" fill="#32BCAD"/>
            <path d="M458.783 200.643l-54.36-54.36h-11.795c-14.14 0-27.68 5.62-37.667 15.606l-76.989 76.989c-13.693 13.693-37.438 13.706-51.144 0l-76.693-76.692c-9.987-9.987-23.527-15.607-37.667-15.607H97.327l-54.11 54.11c-30.418 30.417-30.418 79.73 0 110.147l54.11 54.111h15.141c14.14 0 27.68-5.62 37.667-15.607l76.693-76.692c6.924-6.924 15.983-10.387 25.572-10.387 9.588 0 18.648 3.463 25.572 10.387l76.989 76.989c9.987 9.987 23.527 15.607 37.667 15.607h11.795l54.36-54.361c30.417-30.417 30.417-79.73 0-110.24z" fill="#32BCAD"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 leading-snug">
          Pague via Pix para garantir<br />sua compra
        </h1>
      </div>

      {/* ── Instructions ── */}
      <div className="bg-[#F5F5F5] mx-0 mt-1 px-4 py-5">
        <div className="space-y-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Icon className="w-4 h-4 text-[#32BCAD]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{step.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-200">
          <Clock className="w-4 h-4 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">Pague e será creditado na hora. O código expira em 30 minutos.</p>
        </div>
      </div>

      {/* ── Pix code + copy ── */}
      {pixCode ? (
        <div className="bg-white mx-0 mt-1 px-4 py-4">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <p className="flex-1 text-xs font-mono text-gray-600 px-3 py-3 truncate">
              {pixCode}
            </p>
            <button
              onClick={handleCopy}
              className={`px-4 py-3 text-sm font-semibold shrink-0 transition-colors ${copied ? "text-[#00A650]" : "text-[#3483FA]"}`}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── QR Code ── */}
      <div className="bg-white mx-0 mt-0 px-5 pt-2 pb-6 flex flex-col items-center">
        {qrSrc ? (
          <div className="p-2 border border-gray-100 rounded-xl inline-block">
            <img src={qrSrc} alt="QR Code PIX" className="w-44 h-44 object-contain" />
          </div>
        ) : (
          <div className="w-44 h-44 flex items-center justify-center border border-gray-100 rounded-xl bg-gray-50">
            <p className="text-xs text-gray-400 text-center px-4">QR Code será exibido após gerar o pagamento PIX</p>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2 text-center">Escaneie com o app do seu banco</p>
      </div>

      {/* ── Tentar novamente ── */}
      <div className="px-4 mt-1 bg-white py-4 flex flex-col gap-3">
        {retryError && (
          <p className="text-xs text-red-500 text-center">{retryError}</p>
        )}
        <button
          onClick={handleRetry}
          className="w-full h-12 rounded-xl border-2 border-[#3483FA] text-[#3483FA] font-semibold text-sm flex items-center justify-center gap-2 active:opacity-70"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <button
          onClick={() => navigate("/orders")}
          className="w-full h-12 rounded-xl bg-blue-50 text-[#3483FA] font-semibold text-sm"
        >
          Ver detalhe da compra
        </button>
      </div>

      {/* ── Você comprou ── */}
      <div className="bg-white mx-0 mt-2 px-4 py-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">Você comprou</p>
        <div className="flex items-center gap-3">
          <img
            src={img("/images/escova/potes-1.webp")}
            alt="produto"
            className="w-14 h-14 object-contain rounded-lg border border-gray-100 bg-gray-50 p-1 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-1">
              Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              1 un. |{" "}
              <button onClick={() => navigate("/orders")} className="text-[#3483FA]">
                Ver detalhe
              </button>
            </p>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
