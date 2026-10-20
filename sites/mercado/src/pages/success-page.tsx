import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Clock, Info, AlertCircle, RefreshCw } from "lucide-react";
import { trackingPayload, trackBrowserPurchase } from "@/lib/tracking";

type Phase = "loading" | "dots" | "expand" | "content";

interface PixData {
  transactionId: string;
  pixCode: string;
  qrCodeBase64?: string;
  qrCodeImage?: string;
}

function BankCircleIcon({ bank }: { bank: { name: string; brand: string; color: string } }) {
  if (bank.brand === "nubank") return (
    <span style={{ color: "#820AD1", fontSize: 16, fontStyle: "italic", fontWeight: 800, fontFamily: "sans-serif" }}>nu</span>
  );
  if (bank.brand === "visa") return (
    <span style={{ color: "#1A1F71", fontSize: 11, fontWeight: 800, fontStyle: "italic", fontFamily: "serif" }}>VISA</span>
  );
  if (bank.brand === "mastercard") return (
    <svg width="26" height="16" viewBox="0 0 38 24" fill="none">
      <circle cx="14" cy="12" r="11" fill="#EB001B" opacity="0.9"/>
      <circle cx="24" cy="12" r="11" fill="#F79E1B" opacity="0.85"/>
    </svg>
  );
  const initials = bank.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  return <span style={{ color: bank.color, fontSize: 12, fontWeight: 800 }}>{initials}</span>;
}

export default function SuccessPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const payment = params.get("payment") || "pix";
  const fromDeclined = params.get("from") === "declined";

  const [phase, setPhase] = useState<Phase>("loading");
  const [expanding, setExpanding] = useState(false);
  const [copied, setCopied] = useState(false);

  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [paidTrackingCode, setPaidTrackingCode] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(37.90);
  const [orderQty, setOrderQty] = useState(1);

  useEffect(() => {
    const raw = sessionStorage.getItem("checkoutData");
    if (raw) {
      try {
        const cd = JSON.parse(raw);
        if (cd.amount && cd.amount > 0) setOrderAmount(cd.amount);
        if (cd.quantity && cd.quantity > 0) setOrderQty(cd.quantity);
      } catch { /* ignored */ }
    }
  }, []);

  useEffect(() => {
    const base = payment === "card" ? 4000 : 3000;
    const t1 = setTimeout(() => setPhase("dots"), base);
    const t2 = setTimeout(() => setExpanding(true), base + 400);
    const t3 = setTimeout(() => setPhase("content"), base + 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (payment !== "pix") return;

    async function generatePix() {
      setPixLoading(true);
      setPixError(null);

      try {
        const raw = sessionStorage.getItem("checkoutData");
        if (!raw) {
          setPixError("Dados do checkout não encontrados. Por favor, recomece a compra.");
          setPixLoading(false);
          return;
        }

        const checkoutData = JSON.parse(raw) as {
          name: string;
          email: string;
          phone?: string;
          document?: string;
          address: {
            city: string;
            street: string;
            neighborhood: string;
            number: string;
          };
          amount: number;
          checkoutId: string;
          quantity: number;
          color?: string;
        };

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
            ...trackingPayload(),
          }),
        });

        const data = (await res.json()) as {
          transactionId?: string;
          pixCode?: string;
          qrCodeBase64?: string;
          qrCodeImage?: string;
          error?: string;
        };

        if (!res.ok || !data.pixCode) {
          setPixError(data.error || "Erro ao gerar código PIX. Tente novamente.");
          setPixLoading(false);
          return;
        }

        const pixResult = {
          transactionId: data.transactionId || "",
          pixCode: data.pixCode,
          qrCodeBase64: data.qrCodeBase64,
          qrCodeImage: data.qrCodeImage,
        };
        setPixData(pixResult);
        sessionStorage.setItem("pixData", JSON.stringify(pixResult));
      } catch {
        setPixError("Erro de conexão. Verifique sua internet e tente novamente.");
      } finally {
        setPixLoading(false);
      }
    }

    generatePix();
  }, [payment]);

  useEffect(() => {
    if (!pixData?.transactionId || paidTrackingCode) return;
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`/api/public/pix/status?id=${encodeURIComponent(pixData.transactionId)}`, { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json() as { isPaid?: boolean; trackingCode?: string; eventId?: string; purchaseDestination?: string; amount?: number };
        if (data.isPaid && active) {
          setPaidTrackingCode(data.trackingCode || "confirmado");
          trackBrowserPurchase({
            eventId: data.eventId, transactionId: pixData.transactionId,
            purchaseDestination: data.purchaseDestination,
            amount: Number(data.amount) || orderAmount, numItems: orderQty,
          });
        }
      } catch { /* Verificaremos novamente enquanto a página estiver aberta. */ }
    };
    void check();
    const timer = window.setInterval(check, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pixData?.transactionId, paidTrackingCode, orderAmount, orderQty]);

  async function handleCopy() {
    const code = pixData?.pixCode || "";
    try { await navigator.clipboard.writeText(code); } catch { /* ignored */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleRetry() {
    setPixData(null);
    setPixError(null);
    setPixLoading(true);

    try {
      const raw = sessionStorage.getItem("checkoutData");
      if (!raw) {
        setPixError("Dados do checkout não encontrados. Por favor, recomece a compra.");
        setPixLoading(false);
        return;
      }

      const checkoutData = JSON.parse(raw) as {
        name: string;
        email: string;
        phone?: string;
        document?: string;
        address: { city: string; street: string; neighborhood: string; number: string };
        amount: number;
        checkoutId: string;
        quantity: number;
        color?: string;
      };

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
          ...trackingPayload(),
        }),
      });

      const data = (await res.json()) as {
        transactionId?: string;
        pixCode?: string;
        qrCodeBase64?: string;
        qrCodeImage?: string;
        error?: string;
      };

      if (!res.ok || !data.pixCode) {
        setPixError(data.error || "Erro ao gerar código PIX. Tente novamente.");
        return;
      }

      setPixData({
        transactionId: data.transactionId || "",
        pixCode: data.pixCode,
        qrCodeBase64: data.qrCodeBase64,
        qrCodeImage: data.qrCodeImage,
      });
    } catch {
      setPixError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setPixLoading(false);
    }
  }

  /* ── Loading ── */
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-8 px-10 text-center">
          <p className="text-[22px] font-semibold text-gray-900 leading-snug">
            {payment === "card" ? "Validando pagamento..." : fromDeclined ? "Gerando Código Pix" : "Já é quase sua!"}
          </p>
          <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-[#3483FA] animate-spin" />
        </div>
      </div>
    );
  }

  /* ── Dot → radial expand ── */
  const expandColor = payment === "card" ? "#FF6200" : "#00A650";
  if (phase === "dots" || phase === "expand") {
    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex items-center justify-center overflow-hidden">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: expandColor,
            transform: expanding ? "scale(40)" : "scale(1)",
            transition: expanding ? "transform 0.65s ease-in" : "none",
          }}
        />
        {!expanding && (
          <div className="absolute flex items-center gap-[4px] pointer-events-none">
            <span className="w-[5px] h-[5px] rounded-full bg-white" />
            <span className="w-[5px] h-[5px] rounded-full bg-white" />
            <span className="w-[5px] h-[5px] rounded-full bg-white" />
          </div>
        )}
      </div>
    );
  }

  /* ── Card: authorization screen ── */
  if (payment === "card") {
    const rawCard = typeof window !== "undefined" ? sessionStorage.getItem("cardData") : null;
    const card = rawCard
      ? JSON.parse(rawCard)
      : { bank: { name: "Cartão", brand: "generic", color: "#6B7280" }, last4: "****" };
    const bankInfo = card.bank || { name: "Cartão", brand: "generic", color: "#6B7280" };

    return (
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-[#EBEBEB] flex flex-col overflow-y-auto">
        <div className="bg-[#FF6200] h-2 shrink-0" />
        <div className="flex justify-end px-4 pt-5 pb-2 shrink-0">
          <button onClick={() => navigate("/")} className="p-1">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-10 pt-4">
          <div className="bg-white rounded-2xl shadow-sm px-6 pt-12 pb-7 relative">
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -28 }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                border: "3px solid #FF6200", background: "white",
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <BankCircleIcon bank={bankInfo} />
                <div style={{
                  position: "absolute", bottom: -3, right: -3,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#FF6200", display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #EBEBEB",
                }}>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>!</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 text-center leading-relaxed mb-3">
              Não foi possível realizar esse pagamento com{" "}
              <strong>{bankInfo.name}</strong> **** {card.last4 || "****"}
            </p>
            <h1 className="text-[20px] font-bold text-gray-900 text-center leading-snug">
              É necessário autorizar o pagamento com o banco
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm px-5 py-6 flex flex-col gap-4">
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              Confirme se já autorizou o pagamento de{" "}
              <strong>R$ {orderAmount.toFixed(2).replace(".", ",")}</strong> para finalizar a compra.
            </p>

            <button
              onClick={() => navigate("/card-declined")}
              className="w-full h-12 rounded-xl bg-[#3483FA] text-white font-semibold text-base active:opacity-80"
            >
              Já autorizei o pagamento
            </button>

            <button
              onClick={() => navigate("/cep")}
              className="w-full h-12 rounded-xl text-[#3483FA] font-medium text-base bg-[#EEF4FF] active:opacity-80"
            >
              Pagar de outra forma
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Pix instructions (final) ── */
  const qrSrc = pixData?.qrCodeBase64
    ? `data:image/png;base64,${pixData.qrCodeBase64}`
    : pixData?.qrCodeImage || null;

  return (
    <div className="fixed inset-0 max-w-[480px] mx-auto flex flex-col bg-[#EBEBEB] overflow-y-auto">
      <div className="bg-[#00A650] h-2 shrink-0" />

      <div className="bg-white shadow-sm relative">
        <button
          onClick={() => navigate("/")}
          className="absolute top-3 right-3 p-1 text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 pt-6 pb-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-[#00A650] flex items-center justify-center bg-white">
              <svg viewBox="0 0 36 36" className="w-9 h-9" fill="none">
                <rect x="4" y="10" width="28" height="18" rx="3" stroke="#00A650" strokeWidth="2" />
                <path d="M4 16h28" stroke="#00A650" strokeWidth="2" />
                <rect x="8" y="20" width="6" height="3" rx="1" fill="#00A650" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00A650] flex items-center justify-center">
              <div className="flex items-center gap-[2px]">
                <span className="w-[3px] h-[3px] rounded-full bg-white" />
                <span className="w-[3px] h-[3px] rounded-full bg-white" />
                <span className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-1">Falta pouco!</p>
          <h1 className="text-xl font-bold text-gray-900 leading-snug">
            Pague R$ {orderAmount.toFixed(2).replace(".", ",")} via Pix para concluir sua compra
          </h1>
        </div>
      </div>

      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Instruções de pagamento
        </h2>

        <ol className="space-y-3 mb-5">
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">1.</span>
            <span>Acesse seu Internet Banking ou app de pagamentos.</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">2.</span>
            <span>Escolha pagar via Pix.</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-700">
            <span className="shrink-0 font-medium text-gray-500">3.</span>
            <span>Escaneie o QR Code ou cole o código abaixo.</span>
          </li>
        </ol>

        {/* QR Code */}
        {pixLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-[#00A650] animate-spin" />
            <p className="text-sm text-gray-500">Gerando código PIX...</p>
          </div>
        )}

        {pixError && !pixLoading && (
          <div className="mb-4">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-3 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 leading-relaxed">{pixError}</p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full h-11 rounded-xl border border-[#3483FA] text-[#3483FA] font-medium text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {pixData && !pixLoading && (
          <>
            {paidTrackingCode && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800">
                Pagamento confirmado!{paidTrackingCode !== "confirmado" && <> <a className="underline" href={`/rastreio.html?codigo=${encodeURIComponent(paidTrackingCode)}`}>Acompanhar pedido</a></>}
              </div>
            )}
            {qrSrc && (
              <div className="flex justify-center mb-4">
                <div className="border border-gray-200 rounded-xl p-3 bg-white inline-block">
                  <img
                    src={qrSrc}
                    alt="QR Code PIX"
                    className="w-44 h-44 object-contain"
                  />
                </div>
              </div>
            )}

            <div className="border border-gray-300 rounded-lg px-3 py-3 bg-gray-50 mb-4">
              <p className="text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-wide">Pix Copia e Cola</p>
              <p className="text-xs font-mono text-gray-600 break-all leading-relaxed line-clamp-3">
                {pixData.pixCode}
              </p>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-500">Pague e será creditado na hora.</p>
            </div>

            <div className="flex items-start gap-2.5 border-l-4 border-[#3483FA] bg-blue-50 rounded-r-lg px-3 py-3 mb-6">
              <Info className="w-4 h-4 text-[#3483FA] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed">
                Confirmaremos a data de entrega quando o pagamento for aprovado.
              </p>
            </div>

            <button
              onClick={handleCopy}
              className="w-full h-12 rounded-xl bg-[#3483FA] hover:bg-[#2968c8] text-white font-semibold text-base transition-colors mb-4"
            >
              Copiar código Pix
            </button>

            <button
              onClick={() => navigate("/orders")}
              className="w-full text-[#3483FA] font-medium text-sm text-center pb-2"
            >
              Ir para Minhas compras
            </button>
          </>
        )}
      </div>

      <div className="h-6" />

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto transition-transform duration-300"
        style={{ transform: copied ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="bg-[#00A650] text-white text-sm font-medium text-center py-4">
          Código copiado
        </div>
      </div>
    </div>
  );
}
