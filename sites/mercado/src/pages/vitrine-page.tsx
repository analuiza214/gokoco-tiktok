import { useMemo, useState } from "react";
import { ArrowLeft, Search, ShoppingCart, MapPin, ChevronRight, Star, Truck } from "lucide-react";

// A lista de produtos é injetada pelo build (scripts/build-kalodata-upsells.mjs)
// no marcador __VITRINE_PRODUCTS__ abaixo.
interface VitrineProduct {
  name: string;
  href: string;
  img: string;
  priceInt: string;
  priceDec: string;
  oldPriceText: string;
  installment: string;
  rating: number;
  reviewCount: number;
  contents: string;
}

const VITRINE_PRODUCTS: VitrineProduct[] = "__VITRINE_PRODUCTS__" as unknown as VitrineProduct[];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();


export default function VitrinePage() {
  const [query, setQuery] = useState("");
  const suffix = window.location.search;
  const shown = useMemo(
    () => VITRINE_PRODUCTS.filter((p) => normalize(p.name).includes(normalize(query.trim()))),
    [query]
  );

  return (
    <div className="min-h-screen bg-ml-bg mx-auto max-w-[480px] shadow-xl relative">
      {/* Header — mesmo padrão da página de produto */}
      <header className="bg-ml-yellow px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <a href="/tl/" aria-label="Voltar para a loja" className="shrink-0">
          <ArrowLeft className="w-6 h-6 text-black" />
        </a>
        <label className="flex-1 flex items-center gap-2 bg-white rounded h-9 px-3 shadow-sm cursor-text">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produtos"
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </label>
        <ShoppingCart className="w-6 h-6 text-black shrink-0" />
      </header>

      {/* Address Bar — igual à página de produto */}
      <div className="bg-ml-yellow px-4 py-2 flex items-center gap-2 text-xs border-t border-black/5">
        <MapPin className="w-4 h-4 text-black/60 shrink-0" />
        <span className="text-black/80 truncate">Enviar para meu endereço</span>
        <ChevronRight className="w-4 h-4 text-black/60 ml-auto shrink-0" />
      </div>

      {/* Cabeçalho de resultados */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs text-gray-500">Beleza e cuidado pessoal</p>
        <h1 className="text-base font-medium text-gray-900 mt-0.5">
          {shown.length === 1 ? "1 resultado" : `${shown.length} resultados`}
        </h1>
      </div>

      {/* Resultados */}
      <div className="px-3 pb-6 space-y-2">
        {shown.map((p, i) => (
          <a
            key={p.href}
            href={p.href + suffix}
            className="block bg-white rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.12)] p-3 active:bg-gray-50"
          >
            <div className="flex gap-3">
              <img src={p.img} alt={p.name} className="w-[104px] h-[104px] object-contain shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0">
                {i === 0 && (
                  <span className="inline-block bg-orange-500 text-white text-[9px] font-semibold px-1.5 py-[2px] rounded-sm mb-1">
                    MAIS VENDIDO
                  </span>
                )}
                <p className="text-sm font-light text-gray-800 leading-snug line-clamp-2">{p.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-ml-blue">{p.rating.toFixed(1)}</span>
                  <span className="flex text-ml-blue">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Star key={s} className="w-3 h-3 fill-current" />
                    ))}
                  </span>
                  <span className="text-[11px] text-gray-400">({p.reviewCount})</span>
                </div>
                <p className="text-[11px] text-gray-400 line-through mt-1.5">{p.oldPriceText}</p>
                <div className="flex items-baseline">
                  <span className="text-xl font-normal text-gray-900">
                    R$ {p.priceInt}
                    <span className="text-sm align-top">,{p.priceDec}</span>
                  </span>
                </div>
                <p className="text-[11px] text-ml-green mt-0.5">em {p.installment}</p>
                <p className="text-[11px] font-semibold text-ml-green mt-1 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" />
                  Frete grátis
                </p>
                <p className="text-[11px] text-gray-400 mt-1 truncate">{p.contents}</p>
              </div>
            </div>
          </a>
        ))}
        {shown.length === 0 && (
          <div className="bg-white rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.12)] p-6 text-center">
            <p className="text-sm font-medium text-gray-800">Não encontramos resultados para a sua busca</p>
            <p className="text-xs text-gray-500 mt-1">Confira a ortografia ou tente outro termo.</p>
            <button onClick={() => setQuery("")} className="mt-3 text-sm text-ml-blue font-medium">
              Ver todos os produtos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
