import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, ShoppingCart, Heart, MapPin, ChevronLeft, ChevronRight, Truck, ShieldCheck, Trophy, Star, Sparkles, ThumbsUp, MoreVertical, Flag, Share2, Play, RotateCcw, BadgeCheck, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiMercadopago } from "react-icons/si";
import { img } from "@/lib/img";

// ── Link de compartilhamento — edite aqui para mudar facilmente ──
const SHARE_URL = window.location.href;
const SHARE_TITLE = "Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt por R$ 37,90";
// ────────────────────────────────────────────────────────────────

type SlideItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string };

const BRUSH_COLORS = [
  { name: 'Preta', file: 'preta.webp', swatch: '#242424' },
  { name: 'Branca', file: 'branca.webp', swatch: '#f4f4f4' },
  { name: 'Rosa', file: 'rosa.webp', swatch: '#e8afb9' },
  { name: 'Azul céu', file: 'azul-ceu.jpg', swatch: '#80c6ec' },
  { name: 'Lilás', file: 'lilas.jpg', swatch: '#b794db' },
  { name: 'Verde', file: 'verde.jpg', swatch: '#92ba9b' },
  { name: 'Dourada', file: 'dourada.jpg', swatch: '#cfaa70' },
] as const;

function answerProductQuestion(question: string): string {
  const text = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/molhad|umid|secar/.test(text)) return 'A descrição informa que a escova alisa e modela, mas não confirma uso em cabelo molhado. Confira o manual antes de usar dessa forma.';
  if (/bivolt|voltagem|110|127|220|tomada/.test(text)) return 'Sim, o modelo anunciado é bivolt.';
  if (/temperatura|graus|aquec|calor|nivel/.test(text)) return 'A escova tem nove níveis de temperatura, de 130 °C a 210 °C, e tela LED para acompanhar o ajuste.';
  if (/alis|model|volume|frizz|ondulad|cachead|crespo|cabelo/.test(text)) return 'A GOKOCO 3 em 1 foi apresentada para alisar, modelar e dar volume. Ela tem revestimento cerâmico e tecnologia de íons negativos; o resultado pode variar conforme o tipo de cabelo.';
  if (/caixa|embalagem|acompanha|vem junto|conteudo|manual|luva|prendedor|bolsa|estojo|ziper/.test(text)) return 'O kit apresentado inclui escova modeladora, luva térmica, dois prendedores, uma caixa tipo estojo com zíper e manual. A foto do conjunto é ilustrativa.';
  if (/cabo|gira|giratorio/.test(text)) return 'Sim. O cabo é giratório em 360°.';
  if (/tela|visor|display|led/.test(text)) return 'Sim. A escova possui uma tela LED digital que mostra a temperatura selecionada.';
  if (/preco|valor|custa|parcela|cartao|pix/.test(text)) return 'O preço mostrado neste anúncio é R$ 37,90. As opções de pagamento aparecem na etapa de compra.';
  if (/frete|entrega|prazo|cep|envio/.test(text)) return 'O prazo e as condições de entrega dependem do CEP. Informe seu endereço na etapa de compra para conferir os dados disponíveis.';
  if (/garantia|troca|devolu/.test(text)) return 'Consulte as condições de garantia, troca e devolução apresentadas na compra antes de finalizar o pedido.';
  return 'Não encontrei essa informação na descrição da escova. Confira os detalhes do produto e as condições da compra antes de finalizar o pedido.';
}

export default function ProductPage() {
  const [, navigate] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedColor, setSelectedColor] = useState<(typeof BRUSH_COLORS)[number]>(BRUSH_COLORS[0]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedReview, setSelectedReview] = useState<{
    src: string; stars: number;
    name: string; initials: string; avatarColor: string; review: string;
  } | null>(null);
  const [helpful, setHelpful] = useState(false);
  const [showMoreReviews, setShowMoreReviews] = useState(false);
  const [helpfulExtra, setHelpfulExtra] = useState<Record<number, boolean>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [qty, setQty] = useState(1);
  const [showQtyPicker, setShowQtyPicker] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showAskQuestion, setShowAskQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, url: SHARE_URL });
      } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(SHARE_URL); } catch { /* ignored */ }
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  }

  // Saved address (shared with cep-page via localStorage)
  const [savedAddress, setSavedAddress] = useState<{ cep: string; logradouro: string; bairro: string; localidade: string; uf: string; numero: string } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addrCepInput, setAddrCepInput] = useState("");
  const [addrNumInput, setAddrNumInput] = useState("");
  const [addrCompInput, setAddrCompInput] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrBairro, setAddrBairro] = useState("");
  const [addrCidade, setAddrCidade] = useState("");
  const [addrUf, setAddrUf] = useState("");
  const [addrCepLoading, setAddrCepLoading] = useState(false);
  const [addrCepError, setAddrCepError] = useState("");
  const [addrCepData, setAddrCepData] = useState<object | null>(null);
  const [addrLocating, setAddrLocating] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("topmix_address");
    if (raw) { try { setSavedAddress(JSON.parse(raw)); } catch { /* ignored */ } }
  }, []);

  function formatCepAddr(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function fetchCepAddr(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setAddrCepLoading(true);
    setAddrCepError("");
    setAddrCepData(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json.erro) {
        setAddrCepError("CEP não encontrado. Verifique e tente novamente.");
      } else {
        setAddrCepData(json);
        setAddrStreet(json.logradouro ?? "");
        setAddrBairro(json.bairro ?? "");
        setAddrCidade(json.localidade ?? "");
        setAddrUf(json.uf ?? "");
      }
    } catch {
      setAddrCepError("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setAddrCepLoading(false);
    }
  }

  async function handleUseLocationAddr() {
    if (!navigator.geolocation) { setAddrCepError("Geolocalização não suportada."); return; }
    setAddrLocating(true);
    setAddrCepError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const json = await res.json();
          const postcode = json.address?.postcode?.replace(/\D/g, "") ?? "";
          if (postcode.length === 8) {
            setAddrCepInput(`${postcode.slice(0, 5)}-${postcode.slice(5)}`);
            await fetchCepAddr(postcode);
          } else {
            setAddrCepError("Não foi possível obter o CEP. Digite manualmente.");
          }
        } catch {
          setAddrCepError("Erro ao obter localização. Tente novamente.");
        } finally {
          setAddrLocating(false);
        }
      },
      () => { setAddrCepError("Permissão negada. Digite o CEP manualmente."); setAddrLocating(false); }
    );
  }

  function handleConfirmAddressModal() {
    if (!addrCepData) return;
    const addr = { cep: addrCepInput, logradouro: addrStreet, bairro: addrBairro, localidade: addrCidade, uf: addrUf, numero: addrNumInput };
    setSavedAddress(addr);
    localStorage.setItem("topmix_address", JSON.stringify(addr));
    setShowAddressModal(false);
    setAddrCepInput(""); setAddrNumInput(""); setAddrCompInput("");
    setAddrStreet(""); setAddrBairro(""); setAddrCidade(""); setAddrUf("");
    setAddrCepData(null); setAddrCepError("");
  }

  function handleBuyNow() {
    setCartCount(qty);
    setShowCart(true);
  }

  function handleFinalizarCompra() {
    setShowCart(false);
    setPreparando(true);
    sessionStorage.setItem(
      "topmix_cart",
      JSON.stringify({ qty: cartCount, totalPrice: 37.90 * cartCount, color: selectedColor.name, image: `/images/escova/cores/${selectedColor.file}` })
    );
    setTimeout(() => {
      setPreparando(false);
      navigate("/cep");
    }, 2000);
  }

  function addToCart() {
    setCartCount((n) => n + 1);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1800);
  }

  function handlePlayVideo() {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 1;
    v.muted = false;
    v.play();
    setVideoPlaying(true);
  }

  const slides: SlideItem[] = [
    { type: 'image', src: img('/images/escova/kit-principal-v2.webp') },
    { type: 'image', src: img(`/images/escova/cores/${selectedColor.file}`) },
    ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ type: "image" as const, src: img(`/images/escova/potes-${n}.webp`) })),
  ];
  function goToSlide(index: number) {
    const next = Math.max(0, Math.min(index, slides.length - 1));
    setCurrentSlide(next);
    const carousel = carouselRef.current;
    if (carousel) carousel.scrollTo({ left: next * carousel.clientWidth, behavior: 'smooth' });
  }
  const reviewPhotos = Array.from({ length: 14 }, (_, i) => img(`/images/escova/reviews/rev-${i + 1}.webp`));
  const brushReviews = [
    { name: 'Isabela Nogueira', initials: 'IN', text: 'Chegou hoje. Testei no meu cabelo ondulado e, em cerca de 10 minutos, consegui deixar liso com as pontas viradas. Amei!', photos: [1] },
    { name: 'Camila Souza', initials: 'CS', text: 'Veio embalada numa caixa preta bem firme, com manual e luva. Tudo chegou sem amassados.', photos: [2, 3, 4] },
    { name: 'Fernanda Martins', initials: 'FM', text: 'É silenciosa, não faz aquele barulho de secador. Uso de manhã antes do trabalho.', photos: [5] },
    { name: 'Juliana Ribeiro', initials: 'JR', text: 'Tinha receio de ressecar meu cabelo tingido, mas no nível 5 já consigo modelar.', photos: [6] },
    { name: 'Patrícia Lima', initials: 'PL', text: 'Minha filha também usou e ficou pronta em poucos minutos para a escola.', photos: [7, 8, 9] },
    { name: 'Ana Clara Duarte', initials: 'AD', text: 'O cabo gira de verdade e não fica enrolando no braço. Isso facilitou muito o uso.', photos: [10, 11, 12] },
    { name: 'Beatriz Costa', initials: 'BC', text: 'Aquece rápido. Mal terminei de separar o cabelo e já estava pronta para usar.', photos: [13] },
    { name: 'Larissa Teixeira', initials: 'LT', text: 'Gostei. Cumpre o que promete.', photos: [14] },
  ];
  const testimonialVideos = [1, 2, 3, 4].map((n) => img(`/videos/creator-${n}.mp4`));
  const commonQuestions = [
    { question: 'A escova é bivolt?', answer: 'Sim. O modelo anunciado é bivolt.' },
    { question: 'Ela alisa e modela o cabelo?', answer: 'Sim. A escova foi desenvolvida para alisar, modelar e dar volume aos fios.' },
    { question: 'Posso ajustar a temperatura?', answer: 'Sim. A escova tem nove níveis de temperatura, de 130 °C a 210 °C.' },
    { question: 'O que vem na embalagem?', answer: 'Escova Modeladora GOKOCO 3 em 1, luva térmica, dois prendedores, uma caixa tipo estojo com zíper e manual. A foto do conjunto é ilustrativa.' },
    { question: 'O cabo gira durante o uso?', answer: 'Sim. O cabo é giratório em 360° para facilitar a modelagem.' },
    { question: 'A escova tem visor de temperatura?', answer: 'Sim. Ela possui uma tela LED digital para acompanhar a temperatura selecionada.' },
  ];

  return (
    <div className="min-h-screen bg-ml-bg mx-auto max-w-[480px] shadow-xl relative pb-[80px]">
      {/* Header */}
      <header className="bg-ml-yellow px-4 py-3 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ArrowLeft className="w-6 h-6 text-black" />
        </div>
        <div className="flex items-center gap-4">
          <Heart className={`w-6 h-6 transition-all ${favorited ? "fill-black text-black" : "text-black fill-none"}`} />
          <Search className="w-6 h-6 text-black" />
          <button className="relative" onClick={() => setShowCart(true)}>
            <ShoppingCart className="w-6 h-6 text-black" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>
      {/* Address Bar */}
      <div
        className="bg-ml-yellow px-4 py-2 flex items-center gap-2 text-xs border-t border-black/5 cursor-pointer active:bg-yellow-300 transition-colors"
        onClick={() => setShowAddressModal(true)}
      >
        <MapPin className="w-4 h-4 text-black/60 shrink-0" />
        <span className="text-black/80 truncate">
          {savedAddress
            ? `Enviar para: ${savedAddress.logradouro}${savedAddress.numero ? `, ${savedAddress.numero}` : ""} - ${savedAddress.localidade}`
            : "Enviar para meu endereço"}
        </span>
        <ChevronRight className="w-4 h-4 text-black/60 ml-auto shrink-0" />
      </div>
      <div className="bg-white">
        <div className="text-sm text-muted-foreground px-4 py-3">
          Escova modeladora 3 em 1
        </div>

        <div className="px-4 pb-2 flex items-center gap-0 w-fit">
          <span className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-[3px] rounded-l-sm">
            MAIS VENDIDO
          </span>
          <span className="bg-white text-ml-blue text-[10px] font-semibold px-2 py-[3px] border-l border-orange-500">
            1º em Álbuns Copa do Mundo
          </span>
        </div>

        <h1 className="text-lg font-medium px-4 leading-snug">
          Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt
        </h1>

        <div className="px-4 py-2 flex items-center gap-1">
          <span className="text-sm font-medium text-ml-blue">4.9</span>
          <div className="flex text-ml-blue ml-1">
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
          </div>
          <span className="text-sm text-muted-foreground ml-1">(2485)</span>
        </div>

        {/* Carousel */}
        <div className="bg-white">
          {/* Top bar: counter + heart — outside the image */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-500">
              <span className="font-medium">{currentSlide + 1}</span>
              {" / "}
              <span>{slides.length}</span>
            </span>
            <button className="p-1" onClick={() => setFavorited(f => !f)}>
              <Heart className={`w-[22px] h-5 stroke-[1.5] transition-all ${favorited ? "fill-black text-black" : "text-gray-400 fill-none"}`} />
            </button>
          </div>

          {/* Image-only area */}
          <div className="relative w-full aspect-square bg-white overflow-hidden">
            <div
              ref={carouselRef}
              className="flex w-full h-full overflow-x-scroll"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties}
              onScroll={(e) => {
                const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
                setCurrentSlide(index);
              }}
            >
              {slides.map((slide, i) =>
                slide.type === "video" ? (
                  <div
                    key={i}
                    className="relative w-full h-full shrink-0 flex items-center justify-center bg-black"
                    style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
                  >
                    <video
                      ref={videoRef}
                      src={slide.src}
                      preload="none"
                      className="w-full h-full object-contain"
                      playsInline
                      onEnded={() => setVideoPlaying(false)}
                    />
                    {!videoPlaying && (
                      <button
                        onClick={handlePlayVideo}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="w-7 h-7 text-gray-800 fill-gray-800 ml-1" />
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={i} className="relative w-full h-full shrink-0" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
                    <img
                      src={slide.src}
                      alt={i === 0 ? 'Kit GOKOCO com escova, luva, dois prendedores e caixa com zíper — imagem ilustrativa' : i === 1 ? `Escova GOKOCO na cor ${selectedColor.name}` : 'Detalhe da Escova GOKOCO'}
                      className="w-full h-full object-contain p-4"
                    />
                  </div>
                )
              )}
            </div>
            <button type="button" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0}
              aria-label="Imagem anterior" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slides.length - 1}
              aria-label="Próxima imagem" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom bar: dots + share — outside the image */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="w-8" />
            <div className="flex gap-2 items-center">
              {slides.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-ml-blue' : 'bg-gray-300'}`} />
              ))}
            </div>
            <button
              onClick={handleShare}
              className="w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center active:scale-95 transition-transform relative"
            >
              <Share2 className={`w-4 h-4 stroke-[1.5] transition-colors ${shareCopied ? "text-[#3483FA]" : "text-gray-500"}`} />
            </button>
          </div>
        </div>

        {/* Color selection */}
        <div className="bg-white px-4 pt-3 pb-5 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-800 mb-3">Cor: <span className="font-semibold">{selectedColor.name}</span></p>
          <div className="flex gap-3 overflow-x-auto pb-1" role="group" aria-label="Escolha a cor da escova">
            {BRUSH_COLORS.map((color) => (
              <button key={color.name} type="button" aria-label={`Selecionar cor ${color.name}`} aria-pressed={selectedColor.name === color.name}
                onClick={() => { setSelectedColor(color); setCurrentSlide(1); carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth, behavior: 'smooth' }); }}
                className="shrink-0 flex flex-col items-center gap-1.5 text-xs text-gray-700 min-w-12">
                <span className={`w-10 h-10 rounded-full border-2 shadow-sm ${selectedColor.name === color.name ? 'border-ml-blue ring-2 ring-blue-100' : 'border-gray-300'}`}
                  style={{ backgroundColor: color.swatch }} />
                <span className={selectedColor.name === color.name ? 'font-semibold text-ml-blue' : ''}>{color.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Price & Buying options */}
        <div className="px-4 pb-6">
          <div className="text-sm text-gray-400 line-through">R$ 167,90</div>
          <div className="text-4xl font-normal text-foreground">R$ 37<span className="text-xl align-top">,90</span></div>
          <div className="mt-1 text-[15px]">
            em <span className="text-ml-green font-medium">5x R$ 7,58 sem juros</span> no cartão
          </div>

          <div className="mt-4 flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.386 14.765-5.373 20.136 0l76.989 76.989c14.192 14.192 33.064 22 53.12 22h15.138l-97.2 97.2c-30.418 30.417-79.73 30.417-110.148 0l-97.49-97.497h10.642z" fill="#32BCAD"/>
              <path d="M112.57 120.81c20.056 0 38.928 7.808 53.12 22l76.693 76.692c5.565 5.566 14.57 5.566 20.136 0l76.989-76.989c14.192-14.192 33.064-22 53.12-22h10.642l-97.49-97.49c-30.418-30.417-79.73-30.417-110.148 0l-97.2 97.2 14.138-.413z" fill="#32BCAD"/>
              <path d="M458.783 200.643l-54.36-54.36h-11.795c-14.14 0-27.68 5.62-37.667 15.606l-76.989 76.989c-13.693 13.693-37.438 13.706-51.144 0l-76.693-76.692c-9.987-9.987-23.527-15.607-37.667-15.607H97.327l-54.11 54.11c-30.418 30.417-30.418 79.73 0 110.147l54.11 54.111h15.141c14.14 0 27.68-5.62 37.667-15.607l76.693-76.692c6.924-6.924 15.983-10.387 25.572-10.387 9.588 0 18.648 3.463 25.572 10.387l76.989 76.989c9.987 9.987 23.527 15.607 37.667 15.607h11.795l54.36-54.361c30.417-30.417 30.417-79.73 0-110.24z" fill="#32BCAD"/>
            </svg>
            <div className="text-sm">
              <span className="text-ml-blue">Pagamento por Pix disponível</span>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2">
            <Truck className="w-5 h-5 text-ml-green mt-0.5" />
            <div className="text-sm">
              <div className="text-ml-green font-medium">Frete grátis <span className="font-bold italic">FULL</span></div>
              <div className="text-muted-foreground">Chegará amanhã</div>
            </div>
          </div>

          {/* Estoque disponível */}
          <div className="mt-6">
            <p className="text-base font-semibold text-foreground mb-2">Estoque disponível</p>
            <button
              onClick={() => setShowQtyPicker(true)}
              className="w-full flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-base font-medium text-foreground">Quantidade: {qty}</span>
                <span className="text-sm text-gray-400">(+50 disponíveis)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={handleBuyNow} className="w-full bg-ml-blue hover:bg-ml-blue/90 text-white h-12 rounded-xl text-base font-medium">
              Comprar agora
            </Button>
            <Button
              onClick={addToCart}
              className="w-full bg-blue-50 hover:bg-blue-100 text-ml-blue h-12 rounded-xl text-base font-medium border-0 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Adicionar ao carrinho
            </Button>
          </div>

          {/* Seller */}
          <div className="mt-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden border border-gray-200">
              <img src={img("/images/bella-mix-logo.png")} alt="Bella Mix" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Loja oficial</span>
                <span className="font-semibold text-foreground">Bella Mix</span>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#3483FA"/>
                  <path d="M5.5 10.5l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-sm font-medium text-foreground mt-0.5">Escovas e acessórios de beleza</div>
            </div>
          </div>

          {/* Guarantees */}
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 text-sm">
              <RotateCcw className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <span><span className="text-ml-blue font-medium">Devolução grátis</span> Você tem 30 dias a partir da data de recebimento.</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <ShieldCheck className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <span><span className="text-ml-blue font-medium">Compra Garantida.</span> Receba o produto que está esperando ou devolvemos o dinheiro.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-2 bg-ml-bg" />
      {/* Specs */}
      <div className="bg-white p-4">
        <h2 className="text-lg font-medium mb-4">Características principais</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          {[
            ['Produto', 'Escova Modeladora GOKOCO 3 em 1'],
            ['Funções', 'Alisa, modela e dá volume'],
            ['Voltagem', 'Bivolt'],
            ['Temperatura', '9 níveis, de 130 °C a 210 °C'],
            ['Aquecimento', 'PTC duplo'],
            ['Revestimento', 'Cerâmico'],
            ['Tela', 'LED digital'],
            ['Cabo', 'Giratório 360°'],
            ['Marca', 'GOKOCO'],
          ].map(([k, v], i) => (
            <div key={k} className={`flex ${i % 2 === 0 ? 'bg-gray-200' : 'bg-white'}`}>
              <div className="w-1/3 p-3 text-sm font-medium border-r border-gray-200">{k}</div>
              <div className="w-2/3 p-3 text-sm">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-2 bg-ml-bg" />
      {/* Description */}
      <div className="bg-white p-4 pb-8">
        <h2 className="text-lg font-medium mb-4">Descrição</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A Escova Modeladora GOKOCO 3 em 1 alisa, modela e dá volume. Tem revestimento cerâmico, cerdas antiemaranhado, tela LED e nove níveis de temperatura.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          O kit inclui escova modeladora, luva térmica, dois prendedores, uma caixa tipo estojo com zíper e manual de instruções. Escolha a temperatura adequada ao seu tipo de cabelo antes de usar.
        </p>
      </div>
      {/* Detalhes do produto */}
      <div className="bg-white p-4">
        <h2 className="text-lg font-medium mb-4">Detalhes do produto</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            'Produto: 1 Escova Modeladora GOKOCO 3 em 1',
            'Acessórios: luva térmica e 2 prendedores',
            'Estojo: caixa com zíper para guardar a escova',
            'Manual de instruções incluído',
            'Voltagem: bivolt',
            'Temperatura: 130 °C a 210 °C',
            'Tecnologia: íons negativos e aquecimento PTC',
            'Revestimento: cerâmico',
            'Peso aproximado: 350 g',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <button className="mt-4 text-ml-blue text-sm font-medium flex items-center gap-1">
          Ver mais detalhes <ChevronRight className="w-4 h-4" />
        </button>
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Anúncio: <span className="font-medium">4892145760</span></span>
          <button className="text-ml-blue font-medium flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" /> Denunciar
          </button>
        </div>
      </div>
      <div className="h-2 bg-ml-bg" />
      {/* Perguntas e respostas */}
      <div className="bg-white p-4">
        <h2 className="text-lg font-medium mb-4">Perguntas e respostas</h2>
        <Button onClick={() => { setQuestionText(''); setQuestionAnswer(null); setShowAskQuestion(true); }} className="w-full bg-ml-blue hover:bg-ml-blue/90 text-white h-12 rounded-lg text-base font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5" />
          Perguntar
        </Button>
        <button onClick={() => setShowQuestions(true)} className="mt-4 text-ml-blue text-sm font-medium flex items-center gap-1">
          Ver mais perguntas e respostas <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="h-2 bg-ml-bg" />
      {showQuestions && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-4" onClick={() => setShowQuestions(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="common-questions-title"
            className="w-full max-w-[440px] max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-100">
              <h2 id="common-questions-title" className="text-lg font-semibold text-gray-900">Perguntas frequentes</h2>
              <button onClick={() => setShowQuestions(false)} aria-label="Fechar perguntas" className="p-1 rounded-full text-gray-600 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {commonQuestions.map(({ question, answer }) => (
                <div key={question} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">{question}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showAskQuestion && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-4" onClick={() => setShowAskQuestion(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ask-question-title"
            className="w-full max-w-[440px] rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-100">
              <h2 id="ask-question-title" className="text-lg font-semibold text-gray-900">Pergunte sobre a escova</h2>
              <button onClick={() => setShowAskQuestion(false)} aria-label="Fechar pergunta" className="p-1 rounded-full text-gray-600 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="p-4" onSubmit={(event) => { event.preventDefault(); setQuestionAnswer(answerProductQuestion(questionText)); }}>
              <label htmlFor="product-question" className="block text-sm font-medium text-gray-800 mb-2">Qual é sua dúvida?</label>
              <textarea id="product-question" autoFocus required maxLength={300} rows={3} value={questionText}
                onChange={(event) => { setQuestionText(event.target.value); setQuestionAnswer(null); }}
                placeholder="Ex.: A escova é bivolt?" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-ml-blue" />
              <button type="submit" className="w-full mt-3 rounded-xl bg-ml-blue py-3 text-sm font-semibold text-white hover:opacity-90">Ver resposta</button>
              {questionAnswer && (
                <div aria-live="polite" className="mt-4 rounded-xl bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-ml-blue mb-1">Resposta automática com base no anúncio</p>
                  <p className="text-sm leading-relaxed text-gray-800">{questionAnswer}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* Avaliações do produto */}
      <div className="bg-white p-4">
        <h2 className="text-lg font-medium mb-4">Opiniões do produto</h2>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-5xl font-light text-ml-blue">4.9</span>
          <div>
            <div className="flex text-yellow-400" aria-label="5 estrelas">
              {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-5 h-5 fill-current" />)}
            </div>
            <p className="text-sm text-gray-500 mt-1">2.485 avaliações</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-6" aria-label="Distribuição das avaliações">
          {[[5, 92], [4, 5], [3, 2], [2, 1], [1, 0]].map(([stars, percent]) => (
            <div key={stars} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-3">{stars}</span>
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />
              <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-ml-blue" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 text-right">{percent}%</span>
            </div>
          ))}
        </div>
        {/* Mídia do produto */}
        <h2 className="text-lg font-medium mb-4">Vídeos de depoimentos de pessoas reais</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory touch-pan-x" aria-label="Vídeos de depoimentos; deslize para ver mais">
          {testimonialVideos.map((src, i) => (
            <video key={src} controls playsInline preload="none" poster={img(`/images/criadores/t${5427 + i}.jpg`)}
              aria-label={`Depoimento em vídeo ${i + 1}`}
              className="w-[43%] aspect-[9/16] shrink-0 snap-start rounded-xl bg-black object-cover" src={src} />
          ))}
        </div>
        <div className="divide-y divide-gray-100 mt-5">
          {brushReviews.map((review, index) => (
            <article key={review.name} className="py-4 first:pt-1">
              <div className="flex items-center gap-2">
                <span className={`w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 ${['bg-purple-700', 'bg-teal-600', 'bg-rose-600', 'bg-indigo-600', 'bg-orange-600', 'bg-emerald-700', 'bg-sky-700', 'bg-fuchsia-700'][index % 8]}`}>{review.initials}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-800">{review.name}</span>
                    <BadgeCheck className="w-4 h-4 text-ml-blue shrink-0" aria-label="Comentário do projeto Bella Mix" />
                  </div>
                  <div className="flex text-yellow-400" aria-label="5 estrelas">
                    {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mt-2">{review.text}</p>
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {review.photos.map((number) => {
                  const src = reviewPhotos[number - 1];
                  return (
                    <button key={src} onClick={() => setLightboxSrc(src)} className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-50">
                      <img src={src} alt={`Foto enviada com o comentário de ${review.name}`} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="h-2 bg-ml-bg" />

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center max-w-[480px] mx-auto"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxSrc(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Quantity Picker */}
      {showQtyPicker && (
        <div className="fixed inset-0 z-[260] flex items-end max-w-[480px] mx-auto" onClick={() => setShowQtyPicker(false)}>
          <div className="w-full bg-white rounded-t-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Selecione a quantidade</h2>
              <button onClick={() => setShowQtyPicker(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-72 py-2">
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => { setQty(n); setShowQtyPicker(false); }}
                  className={`w-full flex items-center justify-between px-5 py-3 text-sm transition-colors ${qty === n ? "bg-blue-50 text-ml-blue font-semibold" : "text-gray-800 hover:bg-gray-50"}`}
                >
                  <span>{n} {n === 1 ? "unidade" : "unidades"}</span>
                  {qty === n && <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-ml-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preparando sua compra */}
      {preparando && (
        <div className="fixed inset-0 z-[400] bg-white flex flex-col items-center justify-center max-w-[480px] mx-auto">
          <div className="flex flex-col items-center gap-8 px-10 text-center">
            <p className="text-[22px] font-semibold text-gray-900 leading-snug">
              Preparando tudo para<br />sua compra
            </p>
            <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-[#3483FA] animate-spin" />
          </div>
        </div>
      )}

      {/* Cart added toast */}
      {cartAdded && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
          <ShoppingCart className="w-3.5 h-3.5" />
          Adicionado ao carrinho!
        </div>
      )}

      {/* Share copied toast */}
      {shareCopied && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
          <Share2 className="w-3.5 h-3.5" />
          Link copiado!
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-4 z-50 mx-auto max-w-[480px]">
        <div className="flex flex-col shrink-0">
          <div className="flex items-start gap-0.5 leading-none">
            <span className="text-xs font-medium text-gray-700 mt-1">R$</span>
            <span className="text-3xl font-semibold text-gray-900 leading-none">37</span>
            <span className="text-xs font-semibold text-gray-900 leading-none mt-0.5">,90</span>
          </div>
          <span className="text-[11px] text-ml-green font-medium leading-tight mt-0.5">5x R$ 7,58 sem juros</span>
        </div>
        <Button onClick={handleBuyNow} className="flex-1 bg-ml-blue hover:bg-ml-blue/90 text-white rounded-xl h-12 font-semibold text-base">
          Comprar agora
        </Button>
      </div>

      {/* Cart — slide in from right */}
      <div
        className="fixed inset-0 z-[250] max-w-[480px] mx-auto transition-all duration-300"
        style={{
          pointerEvents: showCart ? "auto" : "none",
          backgroundColor: showCart ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
        }}
        onClick={() => setShowCart(false)}
      >
        <div
          className="absolute inset-y-0 right-0 w-[92%] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: showCart ? "translateX(0)" : "translateX(100%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-ml-yellow">
            <button onClick={() => setShowCart(false)} className="-ml-1 p-1">
              <ArrowLeft className="w-5 h-5 text-black" />
            </button>
            <h2 className="text-base font-semibold text-black flex-1">Meu carrinho</h2>
            {cartCount > 0 && (
              <span className="text-xs text-black/70 font-medium">
                {cartCount} {cartCount === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {cartCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 pb-20">
                <ShoppingCart className="w-14 h-14 text-gray-200" />
                <p className="text-sm text-gray-400">Seu carrinho está vazio</p>
              </div>
            ) : (
              <>
                {/* Product row */}
                <div className="flex items-start gap-3 px-4 py-5 border-b border-gray-100 bg-white">
                  <img
                    src={img(`/images/escova/cores/${selectedColor.file}`)}
                    alt="produto"
                    className="w-20 h-20 rounded-xl object-contain border border-gray-100 shrink-0 bg-gray-50 p-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug mb-2">
                      Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt · {selectedColor.name}
                    </p>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-base font-bold text-gray-900">R$ 37,90</span>
                      <span className="text-[10px] text-gray-400 line-through">R$ 167,90</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCartCount((n) => Math.max(1, n - 1))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 text-xl font-medium leading-none"
                      >−</button>
                      <span className="text-sm font-bold w-6 text-center">{cartCount}</span>
                      <button
                        onClick={() => setCartCount((n) => n + 1)}
                        className="w-8 h-8 rounded-full border border-ml-blue bg-ml-blue text-white flex items-center justify-center text-xl font-medium leading-none"
                      >+</button>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="px-4 py-4 space-y-2 bg-white mt-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'itens'})</span>
                    <span>R$ {(37.90 * cartCount).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Frete</span>
                    <span>Grátis</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                    <span>Total</span>
                    <span>R$ {(37.90 * cartCount).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <p className="text-xs text-green-600">
                    Em 5x de R$ {(37.90 * cartCount / 5).toFixed(2).replace('.', ',')} sem juros
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer actions */}
          {cartCount > 0 && (
            <div className="px-4 py-4 border-t border-gray-100 flex flex-col gap-2 bg-white">
              <Button onClick={handleFinalizarCompra} className="w-full bg-ml-blue hover:bg-ml-blue/90 text-white rounded-xl font-semibold h-12 text-base">
                Finalizar compra
              </Button>
              <button
                onClick={() => setShowCart(false)}
                className="w-full text-ml-blue text-sm font-medium py-2"
              >
                Continuar comprando
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Address Modal ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-end max-w-[480px] mx-auto">
          <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Informe seu endereço</h3>
              <button onClick={() => { setShowAddressModal(false); setAddrCepData(null); setAddrCepError(""); setAddrCepInput(""); }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-4 flex flex-col gap-4">
              {/* Use location */}
              <button
                onClick={handleUseLocationAddr}
                className="flex items-center gap-3 py-3 border border-gray-200 rounded-xl px-4"
              >
                {addrLocating ? (
                  <div className="w-5 h-5 border-2 border-[#3483FA] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5 text-[#3483FA]" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium text-[#3483FA]">
                    {addrLocating ? "Obtendo localização..." : "Usar minha localização atual"}
                  </p>
                  <p className="text-xs text-gray-400">Detectamos seu CEP automaticamente</p>
                </div>
              </button>

              {/* CEP input */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">CEP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={addrCepInput}
                  onChange={(e) => setAddrCepInput(formatCepAddr(e.target.value))}
                  onBlur={() => { if (addrCepInput.replace(/\D/g, "").length === 8) fetchCepAddr(addrCepInput); }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
                {addrCepLoading && <p className="text-xs text-gray-400 mt-1">Buscando endereço...</p>}
                {addrCepError && <p className="text-xs text-red-500 mt-1">{addrCepError}</p>}
              </div>

              {addrCepData && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Rua</label>
                    <input
                      type="text"
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="Nome da rua"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Número</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 100"
                        value={addrNumInput}
                        onChange={(e) => setAddrNumInput(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto, bloco..."
                        value={addrCompInput}
                        onChange={(e) => setAddrCompInput(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Bairro</label>
                    <input
                      type="text"
                      value={addrBairro}
                      onChange={(e) => setAddrBairro(e.target.value)}
                      placeholder="Nome do bairro"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Cidade</label>
                      <input
                        type="text"
                        value={addrCidade}
                        onChange={(e) => setAddrCidade(e.target.value)}
                        placeholder="Nome da cidade"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">UF</label>
                      <input
                        type="text"
                        value={addrUf}
                        onChange={(e) => setAddrUf(e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="SP"
                        maxLength={2}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors uppercase"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  if (!addrCepData) { fetchCepAddr(addrCepInput); return; }
                  if (!addrNumInput) { return; }
                  handleConfirmAddressModal();
                }}
                disabled={addrCepInput.replace(/\D/g, "").length < 8}
                className={`w-full h-12 rounded-xl font-semibold text-base transition-colors ${addrCepInput.replace(/\D/g, "").length === 8 ? "bg-[#3483FA] text-white hover:bg-[#2968c8]" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                Confirmar endereço
              </button>

              <p className="text-xs text-center text-gray-400 pb-2">
                Não sabe seu CEP?{" "}
                <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="text-[#3483FA] font-medium">
                  Consulte os Correios
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
