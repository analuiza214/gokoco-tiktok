import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Headphones, Copy } from "lucide-react";
import { img } from "@/lib/img";

const ORDER_ID = "2000016590038716";
const TODAY = "25 de mai";

export default function OrdersPage() {
  const [, navigate] = useLocation();
  const [orderAmount, setOrderAmount] = useState(37.90);

  useEffect(() => {
    const raw = sessionStorage.getItem("checkoutData");
    if (raw) {
      try {
        const cd = JSON.parse(raw);
        if (cd.amount && cd.amount > 0) setOrderAmount(cd.amount);
      } catch { /* ignored */ }
    }
  }, []);

  function handleCopyOrder() {
    try { navigator.clipboard.writeText(ORDER_ID); } catch { /* ignored */ }
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] max-w-[480px] mx-auto shadow-xl">

      {/* ── Header amarelo ── */}
      <div className="bg-ml-yellow px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>
        <button className="p-1">
          <Headphones className="w-5 h-5 text-black" />
        </button>
      </div>

      {/* ── Hero section ── */}
      <div className="bg-white px-4 pt-4 pb-5">
        {/* Badge */}
        <div className="mb-3">
          <span className="text-[11px] font-bold text-orange-500 tracking-wide uppercase">
            Pagamento pendente
          </span>
        </div>

        {/* Title + thumbnail */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1">
            Pague R$ {orderAmount.toFixed(2).replace(".", ",")} via Pix
          </h1>
          <img
            src={img("/images/escova/potes-1.webp")}
            alt="produto"
            className="w-16 h-16 object-contain rounded-lg border border-gray-100 bg-gray-50 p-1 shrink-0"
          />
        </div>

        {/* Info */}
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          Confirmaremos a data de entrega quando o pagamento for aprovado.
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate("/instructions")}
          className="w-full h-12 rounded-xl bg-[#3483FA] text-white font-semibold text-base mb-3"
        >
          Ver instruções
        </button>
        <button
          onClick={() => navigate("/cep")}
          className="w-full text-[#3483FA] font-medium text-sm text-center py-1"
        >
          Pagar de outra forma
        </button>
      </div>

      {/* ── Precisa de ajuda ── */}
      <div className="bg-white mx-0 mt-2 px-4">
        <button className="w-full flex items-center gap-3 py-4">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4 text-[#3483FA]" />
          </div>
          <span className="flex-1 text-sm font-medium text-gray-800 text-left">Precisa de ajuda?</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* ── Detalhe da compra ── */}
      <div className="bg-white mx-0 mt-2">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Detalhe da compra</h2>
        </div>

        {/* Product row */}
        <button className="w-full flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <img
            src={img("/images/escova/potes-1.webp")}
            alt="produto"
            className="w-12 h-12 object-contain rounded-lg border border-gray-100 bg-gray-50 p-0.5 shrink-0"
          />
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">
              Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt
            </p>
            <p className="text-xs text-gray-500 mt-0.5">1 un. | Pronta entrega</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>

        {/* Payment row */}
        <button className="w-full flex items-center gap-3 px-4 py-4">
          {/* Pix icon */}
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 512 512" width="36" height="36" fill="none">
              <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.386 14.765-5.373 20.136 0l76.989 76.989c14.192 14.192 33.064 22 53.12 22h15.138l-97.2 97.2c-30.418 30.417-79.73 30.417-110.148 0l-97.49-97.497h10.642z" fill="#32BCAD"/>
              <path d="M112.57 120.81c20.056 0 38.928 7.808 53.12 22l76.693 76.692c5.565 5.566 14.57 5.566 20.136 0l76.989-76.989c14.192-14.192 33.064-22 53.12-22h10.642l-97.49-97.49c-30.418-30.417-79.73-30.417-110.148 0l-97.2 97.2 14.138-.413z" fill="#32BCAD"/>
              <path d="M458.783 200.643l-54.36-54.36h-11.795c-14.14 0-27.68 5.62-37.667 15.606l-76.989 76.989c-13.693 13.693-37.438 13.706-51.144 0l-76.693-76.692c-9.987-9.987-23.527-15.607-37.667-15.607H97.327l-54.11 54.11c-30.418 30.417-30.418 79.73 0 110.147l54.11 54.111h15.141c14.14 0 27.68-5.62 37.667-15.607l76.693-76.692c6.924-6.924 15.983-10.387 25.572-10.387 9.588 0 18.648 3.463 25.572 10.387l76.989 76.989c9.987 9.987 23.527 15.607 37.667 15.607h11.795l54.36-54.361c30.417-30.417 30.417-79.73 0-110.24z" fill="#32BCAD"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-900">R$ {orderAmount.toFixed(2).replace(".", ",")}</p>
            <p className="text-xs text-gray-500">Pix · {TODAY}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>

      {/* ── Order number ── */}
      <div className="py-5 flex items-center justify-center gap-2">
        <button
          onClick={handleCopyOrder}
          className="flex items-center gap-1.5 text-[#3483FA] text-sm"
        >
          <span>Compra #{ORDER_ID}</span>
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4" />
    </div>
  );
}
