import { productFaqs } from "@/lib/product-faqs";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link } from "wouter";
import { products, reviews } from "@/lib/data";
import { getImagePath } from "@/lib/utils";
import { ShieldCheck, Truck, Star, BadgeCheck, ChevronLeft, ChevronRight, Play, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WistiaPlayer } from "@/components/wistia-player";

// ── FAQ Section ──
const homeFaqs = productFaqs;

function LocalTestimonialPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const startVideo = () => {
    setStarted(true);
    void videoRef.current?.play();
  };

  return (
    <div className="relative w-full aspect-[9/16] overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={getImagePath(src)}
        controls={started}
        playsInline
        preload="none"
        className="h-full w-full object-cover"
      />
      {!started && (
        <button
          type="button"
          onClick={startVideo}
          aria-label="Reproduzir depoimento 3"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="absolute inset-x-0 bottom-0 flex h-9 items-center gap-2 bg-blue-700 px-3 text-white">
            <Play className="h-4 w-4 fill-white" />
            <strong className="text-xs">0:41</strong>
            <span className="h-1 flex-1 rounded-full bg-white/70" />
            <MoreHorizontal className="h-5 w-5" />
          </span>
          <span className="flex h-20 w-28 items-center justify-center bg-blue-700/90 text-white shadow-lg">
            <Play className="h-10 w-10 fill-white" />
          </span>
        </button>
      )}
    </div>
  );
}

function HomeFaqSection() {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {homeFaqs.map((item, i) => (
        <div key={i} className="border-b border-gray-100 last:border-0">
          <button
            onClick={() => setAberto(aberto === i ? null : i)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left"
          >
            <span className="text-xl shrink-0">{item.icon}</span>
            <span className="flex-1 text-sm font-bold text-gray-800">{item.q}</span>
            <span
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200"
              style={{
                background: aberto === i ? "linear-gradient(135deg,#E09400,#f5b800)" : "#f3f4f6",
                transform: aberto === i ? "rotate(45deg)" : "rotate(0deg)",
              }}
            >
              <span className="text-xs font-black" style={{ color: aberto === i ? "#fff" : "#6b7280" }}>+</span>
            </span>
          </button>
          {aberto === i && (
            <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed pl-14">{item.r}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Reviewer photos ──
const reviewerPhotos: Record<string, string> = {
  "Amanda Alves": "/images/avatares/mulher-1.jpg",
  "Adriana Duarte": "/images/avatares/mulher-2.jpg",
  "Elisa Martins": "/images/avatares/mulher-3.jpg",
  "Camila Soares": "/images/avatares/mulher-4.jpg",
  "Fernanda Freitas": "/images/avatares/mulher-5.jpg",
  "Natália Ribeiro": "/images/avatares/mulher-6.jpg",
  "Sabrina Almeida": "/images/avatares/mulher-7.jpg",
  "Juliana Pires": "/images/avatares/mulher-8.jpg",
  "Mariana Lima": "/images/avatares/mulher-9.jpg",
  "Beatriz Costa": "/images/avatares/mulher-10.jpg",
  "Renata Moura": "/images/avatares/mulher-11.jpg",
  "Patrícia Vieira": "/images/avatares/mulher-12.jpg",
  "Larissa Teixeira": "/images/avatares/mulher-13.jpg",
  "Vanessa Oliveira": "/images/avatares/mulher-14.jpg",
};

function getReviewerPhoto(author: string): string {
  return getImagePath(reviewerPhotos[author]);
}

// ── Sphere / Coverflow Carousel ──
function getCardTransform(offset: number) {
  const absOff = Math.abs(offset);
  const sign = offset < 0 ? -1 : 1;

  if (absOff === 0) {
    return { x: "0%", rotateY: 0, scale: 1, opacity: 1, zIndex: 20, filter: "brightness(1)" };
  }
  if (absOff === 1) {
    return { x: `${sign * 72}%`, rotateY: sign * -48, scale: 0.76, opacity: 0.88, zIndex: 15, filter: "brightness(0.88)" };
  }
  if (absOff === 2) {
    return { x: `${sign * 115}%`, rotateY: sign * -65, scale: 0.55, opacity: 0.55, zIndex: 10, filter: "brightness(0.72)" };
  }
  return { x: `${sign * 145}%`, rotateY: sign * -75, scale: 0.35, opacity: 0, zIndex: 5, filter: "brightness(0.5)" };
}

function ReviewCard({ review }: { review: typeof reviews[number] }) {
  const reviewerPhoto = getReviewerPhoto(review.author);
  const resultPhotos = review.photos ?? (review.photo ? [review.photo] : []);

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden h-full"
      style={{
        background: "linear-gradient(145deg, #ffffff 0%, #fffdf5 100%)",
        border: "2px solid #f5b800",
        boxShadow: "0 16px 50px rgba(224,148,0,0.20), 0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(245,184,0,0.20) 0%, transparent 70%)" }} />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(22,163,74,0.12) 0%, transparent 70%)" }} />

      <div className="flex gap-0.5 relative z-10">
        {[...Array(review.rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
        ))}
      </div>

      <p className="text-sm text-gray-700 leading-relaxed italic relative z-10 flex-1">
        "{review.text}"
      </p>

      {resultPhotos.length > 0 && (
        <div className="flex gap-2 relative z-10">
          {resultPhotos.map((p, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={getImagePath(p)}
                alt="Foto do resultado"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-yellow-200"
                style={{ boxShadow: "0 4px 14px rgba(224,148,0,0.25)" }}
                loading="lazy"
                decoding="async"
              />
              {i === 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                  ✓ Real
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-3 border-t border-yellow-100 relative z-10">
        <div className="relative shrink-0">
          <img
            src={reviewerPhoto}
            alt={review.author}
            className="w-11 h-11 rounded-full object-cover border-2 border-yellow-300 shadow"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
            style={{ background: "#16a34a" }}>
            <BadgeCheck className="h-3 w-3 text-white" />
          </div>
        </div>
        <div>
          <div className="font-bold text-sm text-gray-900">{review.author}</div>
          <div className="text-xs text-green-600 font-medium">Comprador Verificado ✓</div>
        </div>
        <span className="ml-auto text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm"
          style={{ background: "linear-gradient(135deg,#fff3cc,#ffe58f)", color: "#a06800" }}>
          ⭐ Verificado
        </span>
      </div>
    </div>
  );
}

function SphereCarousel() {
  const [active, setActive] = useState(0);
  const total = reviews.length;

  useEffect(() => {
    const id = setInterval(() => setActive(i => (i + 1) % total), 5500);
    return () => clearInterval(id);
  }, [total]);

  const prev = () => setActive(i => (i - 1 + total) % total);
  const next = () => setActive(i => (i + 1) % total);

  const visibleRange = [-2, -1, 0, 1, 2];

  return (
    <div className="relative select-none">
      <div
        className="relative overflow-visible"
        style={{ perspective: "1100px", perspectiveOrigin: "50% 50%", height: 420 }}
      >
        {visibleRange.map(offset => {
          const idx = ((active + offset) % total + total) % total;
          const review = reviews[idx];
          const t = getCardTransform(offset);
          const isCenter = offset === 0;

          if (isCenter) {
            return (
              <motion.div
                key={active}
                initial={{ x: "120%", opacity: 0, scale: 0.85, zIndex: 20 }}
                animate={{ x: "0%", opacity: 1, scale: 1, zIndex: 20, filter: "brightness(1)" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute", top: 0, left: "50%",
                  width: "min(340px, 80vw)",
                  marginLeft: "calc(min(340px, 80vw) / -2)",
                  transformStyle: "preserve-3d",
                  transformOrigin: "center center",
                  cursor: "default",
                }}
              >
                <ReviewCard review={review} />
              </motion.div>
            );
          }

          return (
            <motion.div
              key={`${idx}-${offset}`}
              animate={{ x: t.x, rotateY: t.rotateY, scale: t.scale, opacity: t.opacity, zIndex: t.zIndex, filter: t.filter }}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: "absolute", top: 0, left: "50%",
                width: "min(340px, 80vw)",
                marginLeft: "calc(min(340px, 80vw) / -2)",
                transformStyle: "preserve-3d",
                transformOrigin: "center center",
                cursor: "pointer",
                pointerEvents: Math.abs(offset) > 2 ? "none" : "auto",
              }}
              onClick={() => {
                if (offset === -1) prev();
                else if (offset === 1) next();
              }}
            >
              <ReviewCard review={review} />
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={prev}
          className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition-all shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex gap-2">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? 24 : 8,
                height: 8,
                background: i === active ? "#E09400" : "#d1d5db",
                boxShadow: i === active ? "0 2px 8px rgba(224,148,0,0.45)" : "none",
              }}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition-all shadow-sm"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function Home() {
  return (
    <div className="w-full bg-white">

      {/* HERO
          ▶ fetchPriority="high" + width/height explícito evitam LCP lento e layout shift.
          ▶ O <link rel="preload"> correspondente deve estar no index.html (ver index-head-otimizado.html).
      */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-4">
          <div
            className="relative rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
            onClick={() => document.getElementById("kits")?.scrollIntoView({ behavior: "smooth" })}
          >
            <img
              src={getImagePath("/images/banner-principal.jpg")}
              alt="Escova Modeladora Gokoco 3 em 1 - Seca, Alisa e Modela por R$ 37,90"
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.01]"
              fetchPriority="high"
              decoding="sync"
              width={828}
              height={1024}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 rounded-2xl" />
          </div>
        </div>
      </section>

      {/* VIDEO — POR QUE TÃO BARATO? */}
      <section className="py-8 bg-gray-50 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <span className="inline-block text-xs font-black tracking-widest uppercase text-red-600 mb-1">▶ Veja o resultado antes de comprar</span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-snug">
              Essa Escova Alisa Seca e Modela seu Cabelo{" "}
              <span className="inline-block bg-amber-200/70 text-gray-950 px-2 py-0.5 rounded-md border border-amber-300/60 shadow-2xs">
                em 5 Minutos
              </span>
            </h2>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg"
            style={{ border: "2px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <WistiaPlayer mediaId="o0w64h2349" aspect={0.5625} />
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="kits" className="py-10 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-5">
            <p className="text-xs font-black tracking-widest uppercase text-green-700 mb-1">Coleção de Beleza Bella Mix</p>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">Escolha Seu Kit</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {products.map((product, idx) => {
              const topLabel =
                idx === 0 ? <span className="badge-relampago"><span className="fire-icon">🔥</span>Oferta Relâmpago</span>
                : idx === 3 ? <span className="badge-beleza">Para sua rotina de beleza</span>
                : idx === 4 ? <span className="badge-presente">Ótimo para presentear</span>
                : null;

              const cardStyle =
                idx === 0 ? { border: "2px solid #ff6600", boxShadow: "0 0 0 3px rgba(255,102,0,0.12), 0 4px 20px rgba(255,102,0,0.22)" }
                : idx === 3 ? { border: "2px solid #22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.10), 0 4px 20px rgba(34,197,94,0.18)" }
                : idx === 4 ? { border: "2px solid #ff7700", boxShadow: "0 0 0 3px rgba(255,119,0,0.10), 0 4px 20px rgba(255,119,0,0.16)" }
                : { border: "1.5px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" };

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex flex-col"
                >
                  {topLabel ? (
                    <div className="flex justify-center mb-1.5">{topLabel}</div>
                  ) : (
                    <div className="mb-1.5 h-[22px]" />
                  )}
                  <Link href={`/produto/${product.slug}`} className="flex-1">
                    <div
                      className="bg-white rounded-xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col h-full hover:scale-[1.02] hover:shadow-xl"
                      style={cardStyle}
                    >
                      {idx === 0 && (
                        <div className="px-2 pt-2">
                          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Mais vendido</span>
                        </div>
                      )}
                      <div className="p-3 aspect-square bg-gray-50 flex items-center justify-center">
                        {/* ▶ loading="lazy" em todas as imagens de produto */}
                        <img
                          src={getImagePath(product.mainImage)}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="p-2.5 flex flex-col flex-1 gap-1">
                        <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-gray-700">{product.rating}</span>
                          <span>({product.reviewCount})</span>
                        </div>
                        <div className="mt-auto">
                          <div className="font-black text-base" style={{ color: "#E09400" }}>{product.price > 0 ? 'R$ ' + product.price.toFixed(2).replace('.', ',') : 'Preço em breve'}</div>
                          <div className="text-[10px] text-green-600 font-medium mb-1.5">Pix: {product.pixPrice > 0 ? 'R$ ' + product.pixPrice.toFixed(2).replace('.', ',') : 'A definir'}</div>
                          <button className="w-full py-1.5 rounded-lg text-[11px] font-black text-white hover:opacity-90 active:scale-95 transition-all"
                            style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)" }}>
                            VER KIT
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PIX BANNER */}
      <section className="py-6 bg-white px-4">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #166534 0%, #16a34a 100%)" }}>
            <p className="text-green-200 text-xs font-bold tracking-widest uppercase mb-1">Desconto Exclusivo</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-1">10% OFF PAGANDO NO PIX</h3>
            <p className="text-green-100 text-sm mb-4">Aprovação instantânea. Sem taxas. Frete grátis.</p>
            <Link href="/produto/kit-7-em-1-bege">
              <button className="px-7 py-2.5 rounded-xl font-black text-sm bg-white hover:bg-gray-50 transition-all shadow"
                style={{ color: "#166534" }}>
                QUERO O DESCONTO PIX
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* REVIEWS — Sphere Coverflow */}
      <section className="py-10 bg-gray-50 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-black tracking-widest uppercase text-green-700 mb-1">+1.847 avaliações verificadas</p>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">O que nossos clientes dizem</h2>
          </div>
          <SphereCarousel />
        </div>
      </section>

      {/* DEPOIMENTOS EM VÍDEO */}
      <section className="py-12 bg-white px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-black tracking-widest uppercase text-green-700 mb-1">📦 Chegou certinho!</span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">Clientes que receberam e aprovaram</h2>
            <p className="text-sm text-gray-500 mt-1">Veja quem já garantiu o kit e recebeu em casa</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { mediaId: "43o1wjrs8m", name: "Vanessa Santos", city: "São Paulo, SP", stars: 5 },
              { mediaId: "wkqskzw8nf", name: "Roberta Soares", city: "Rio de Janeiro, RJ", stars: 5 },
              { videoSrc: "/videos/depoimento-3.mp4", name: "Ana Lima", city: "Belo Horizonte, MG", stars: 5 },
              { mediaId: "lvctikn03c", name: "Karol Silva", city: "Recife, PE", stars: 5 },
            ].map((dep) => (
              <div key={dep.mediaId || dep.videoSrc} className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                {dep.videoSrc ? (
                  <LocalTestimonialPlayer src={dep.videoSrc} />
                ) : (
                  <WistiaPlayer mediaId={dep.mediaId!} aspect={0.5625} />
                )}
                <div className="px-3 py-2.5">
                  <div className="flex gap-0.5 mb-1">
                    {Array.from({ length: dep.stars }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-xs font-bold text-gray-900 whitespace-nowrap">{dep.name}</p>
                  <p className="text-[11px] text-gray-400 whitespace-nowrap">{dep.city}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-5 py-2.5">
              <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-green-700">+14.000 pedidos entregues em todo o Brasil</span>
            </div>
          </div>
        </div>
      </section>

      {/* GARANTIA 90 DIAS */}
      <section className="py-10 bg-white px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden border-2"
            style={{ borderColor: "#16a34a", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 70%)" }} />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 70%)" }} />

            <div className="relative z-10">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4 border-white"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                  <ShieldCheck className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="inline-block bg-green-600 text-white text-xs font-black px-3 py-1 rounded-full mb-3 tracking-wider uppercase shadow">
                Garantia Total
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
                Garantia de <span className="text-green-600">90 Dias</span>
              </h3>

              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4 max-w-lg mx-auto">
                Se por qualquer motivo você não ficar satisfeito com o seu kit, <strong>devolvemos 100% do seu dinheiro</strong> sem burocracia, sem perguntas. Sua satisfação é nossa prioridade.
              </p>

              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { icon: "🔒", label: "Compra 100% Segura" },
                  { icon: "💸", label: "Reembolso Total Garantido" },
                  { icon: "📦", label: "Cuidados com o Cabelo" },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-green-100 flex flex-col items-center gap-1.5">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-[11px] font-semibold text-gray-700 leading-snug text-center">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 bg-gray-50 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-black tracking-widest uppercase text-green-700 mb-1">Tire suas dúvidas</p>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">Perguntas Frequentes</h2>
          </div>
          <HomeFaqSection />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-10 bg-white px-4">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            Seu próximo favorito para<br />
            <span style={{ color: "#E09400" }}>cuidar do seu cabelo!</span>
          </h2>
          <p className="text-gray-500 text-sm">Escolha sua cor e conheça os acessórios do kit 7 em 1.</p>
          <Link href="/produto/kit-7-em-1-bege">
            <button className="w-full sm:w-auto px-10 py-4 rounded-xl font-black text-base text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb, #1d4ed8)" }}>
              CONHECER O KIT 7 EM 1
            </button>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Compra Segura</span>
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-green-600" /> Frete Grátis</span>
          </div>
        </div>
      </section>

    </div>
  );
}
