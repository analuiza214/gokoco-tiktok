import { useState, useRef, useEffect } from "react";
import { ArrowLeft, MapPin, ChevronRight, X, CreditCard, Navigation, Check, User, Pencil, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { img } from "@/lib/img";

function formatCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validateCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +d[10];
}

function Price({ value, className = "", size = "md", bold = true }: { value: number; className?: string; size?: "sm" | "md" | "lg"; bold?: boolean }) {
  const [reais, cents] = value.toFixed(2).split(".");
  const basePx = size === "lg" ? 28 : size === "md" ? 20 : 16;
  const weight = bold ? "font-bold" : "font-normal";
  return (
    <span
      className={`inline-flex items-start leading-none ${className}`}
      style={{ fontSize: basePx }}
    >
      <span className={weight} style={{ fontSize: "1em", lineHeight: 1 }}>
        R$ {reais}
      </span>
      <span
        className={weight}
        style={{ fontSize: "0.5em", lineHeight: 1, marginLeft: 2, marginTop: 1 }}
      >
        {cents}
      </span>
    </span>
  );
}

interface AddressData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  numero: string;
}

// ── BIN detection ──────────────────────────────────────────────
interface BankInfo { name: string; color: string; brand: string }

function detectBank(number: string): BankInfo {
  const d = number.replace(/\D/g, "");
  const b4 = d.slice(0, 4);
  const b6 = d.slice(0, 6);
  const nubank4 = ["5274","5078","5162","5041","5356","4035","4985","5492"];
  if (nubank4.includes(b4)) return { name: "Nubank", color: "#820AD1", brand: "nubank" };
  const itau4 = ["5491","5276","5184","4514","4916","4917","4011","5434"];
  if (itau4.includes(b4)) return { name: "Itaú", color: "#EC7000", brand: "itau" };
  const brad4 = ["5228","5027","4576","4019","5185","5441"];
  if (brad4.includes(b4)) return { name: "Bradesco", color: "#CC092F", brand: "bradesco" };
  const sant4 = ["5360","5275","4072","4348","4532"];
  if (sant4.includes(b4)) return { name: "Santander", color: "#EC0000", brand: "santander" };
  const inter4 = ["5173","5166","4747","4913"];
  if (inter4.includes(b4)) return { name: "Inter", color: "#FF7A00", brand: "inter" };
  const caixa4 = ["5189","5095","4024","5090"];
  if (caixa4.includes(b4)) return { name: "Caixa", color: "#0070AF", brand: "caixa" };
  const bb4 = ["5067","5180","4001","4002","4003"];
  if (bb4.includes(b4)) return { name: "Banco do Brasil", color: "#FBBA00", brand: "bb" };
  const c64 = ["5392","5371","4389"];
  if (c64.includes(b4)) return { name: "C6 Bank", color: "#242424", brand: "c6" };
  // Fallback to brand
  if (d[0] === "4") return { name: "Visa", color: "#1A1F71", brand: "visa" };
  if (d[0] === "5") return { name: "Mastercard", color: "#EB001B", brand: "mastercard" };
  if (d.slice(0,2) === "34" || d.slice(0,2) === "37") return { name: "Amex", color: "#007BC1", brand: "amex" };
  return { name: "Cartão", color: "#6B7280", brand: "generic" };
}

function BankLogo({ bank, size = 32 }: { bank: BankInfo; size?: number }) {
  const s = size;
  if (bank.brand === "nubank") return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#820AD1"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">nu</text>
    </svg>
  );
  if (bank.brand === "visa") return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#1A1F71"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="serif" fontStyle="italic">VISA</text>
    </svg>
  );
  if (bank.brand === "mastercard") return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#252525"/>
      <circle cx="13" cy="16" r="7" fill="#EB001B"/>
      <circle cx="19" cy="16" r="7" fill="#F79E1B" opacity="0.9"/>
    </svg>
  );
  // Generic: colored square with initials
  const initials = bank.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill={bank.color}/>
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif">{initials}</text>
    </svg>
  );
}

// ── Installments ─────────────────────────────────────────────
// 1x–5x sem juros; a partir de 6x aplica ~2,42% a.m. (CET ~33% a.a.)
// Juros compostos: total = P * (1,0242)^n - P
const INTEREST_BY_INSTALLMENT: Record<number, number> = {
  6: 0.1544, 7: 0.1819, 8: 0.2100,
  9: 0.2385, 10: 0.2676, 11: 0.2972, 12: 0.3273,
};

function calcInstallments(price: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const rate = INTEREST_BY_INSTALLMENT[n];
    const total = rate ? price * (1 + rate) : price;
    const perMonth = total / n;
    return { n, perMonth, total, hasInterest: !!rate };
  });
}

const PixIcon = () => (
  <svg viewBox="0 0 512 512" className="w-8 h-8" fill="none">
    <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.386 14.765-5.373 20.136 0l76.989 76.989c14.192 14.192 33.064 22 53.12 22h15.138l-97.2 97.2c-30.418 30.417-79.73 30.417-110.148 0l-97.49-97.497h10.642z" fill="#32BCAD"/>
    <path d="M112.57 120.81c20.056 0 38.928 7.808 53.12 22l76.693 76.692c5.565 5.566 14.57 5.566 20.136 0l76.989-76.989c14.192-14.192 33.064-22 53.12-22h10.642l-97.49-97.49c-30.418-30.417-79.73-30.417-110.148 0l-97.2 97.2 14.138-.413z" fill="#32BCAD"/>
    <path d="M458.783 200.643l-54.36-54.36h-11.795c-14.14 0-27.68 5.62-37.667 15.606l-76.989 76.989c-13.693 13.693-37.438 13.706-51.144 0l-76.693-76.692c-9.987-9.987-23.527-15.607-37.667-15.607H97.327l-54.11 54.11c-30.418 30.417-30.418 79.73 0 110.147l54.11 54.111h15.141c14.14 0 27.68-5.62 37.667-15.607l76.693-76.692c6.924-6.924 15.983-10.387 25.572-10.387 9.588 0 18.648 3.463 25.572 10.387l76.989 76.989c9.987 9.987 23.527 15.607 37.667 15.607h11.795l54.36-54.361c30.417-30.417 30.417-79.73 0-110.24z" fill="#32BCAD"/>
  </svg>
);

export default function CepPage() {
  const [, navigate] = useLocation();

  // Address state
  const [address, setAddress] = useState<AddressData | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Address modal fields
  const [cepInput, setCepInput] = useState("");
  const [numInput, setNumInput] = useState("");
  const [compInput, setCompInput] = useState("");
  const [streetInput, setStreetInput] = useState("");
  const [bairroInput, setBairroInput] = useState("");
  const [cidadeInput, setCidadeInput] = useState("");
  const [ufInput, setUfInput] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepData, setCepData] = useState<Partial<AddressData> | null>(null);
  const [locating, setLocating] = useState(false);

  // Payment
  const [payment, setPayment] = useState<"pix" | "card" | null>("pix");
  const [showCardModal, setShowCardModal] = useState(false);
  const [savedCard, setSavedCard] = useState<{ last4: string; bank: BankInfo } | null>(null);

  // Card modal fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardError, setCardError] = useState("");

  // Installments
  const [showInstallments, setShowInstallments] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(5);

  // Buyer data
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerData, setBuyerData] = useState<{ nome: string; email: string; celular: string; cpf: string } | null>(null);
  const [buyerNome, setBuyerNome] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerCelular, setBuyerCelular] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [buyerError, setBuyerError] = useState("");

  // Cart quantity / total (read from product page)
  const [cartQty, setCartQty] = useState(1);
  const [cartTotal, setCartTotal] = useState(37.90);
  const [cartColor, setCartColor] = useState('Preta');
  const [cartImage, setCartImage] = useState('/images/escova/cores/preta.webp');

  // Shipping
  const [shipping, setShipping] = useState(0);

  // Section validation errors
  const [addressErr, setAddressErr] = useState(false);
  const [paymentErr, setPaymentErr] = useState(false);
  const [buyerErr, setBuyerErr] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Section refs for scroll
  const addressRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const buyerRef = useRef<HTMLDivElement>(null);

  function handleCheckout() {
    let firstErr: React.RefObject<HTMLDivElement | null> | null = null;

    if (!address) {
      setAddressErr(true);
      if (!firstErr) firstErr = addressRef;
    } else {
      setAddressErr(false);
    }

    if (!payment) {
      setPaymentErr(true);
      if (!firstErr) firstErr = paymentRef;
    } else {
      setPaymentErr(false);
    }

    if (!buyerData) {
      setBuyerErr(true);
      if (!firstErr) firstErr = buyerRef;
    } else {
      setBuyerErr(false);
    }

    if (firstErr) {
      const missing = [];
      if (!address) missing.push("endereço");
      if (!payment) missing.push("meio de pagamento");
      if (!buyerData) missing.push("dados do comprador");
      showToast(`Preencha: ${missing.join(", ")}.`);
      firstErr.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (address && buyerData) {
      const checkoutId = crypto.randomUUID();
      sessionStorage.setItem(
        "checkoutData",
        JSON.stringify({
          name: buyerData.nome,
          email: buyerData.email,
          phone: buyerData.celular,
          document: buyerData.cpf,
          checkoutId,
          quantity: cartQty,
          color: cartColor,
          address: {
            zipCode: address.cep?.replace(/\D/g, "") || "",
            state: address.uf || "SP",
            city: address.localidade,
            street: address.logradouro,
            neighborhood: address.bairro || "Centro",
            number: address.numero || "S/N",
          },
          amount: productPrice,
        })
      );
    }

    navigate(`/success?payment=${payment}`);
  }

  // Scroll to top on mount + restore data from previous session or product page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    // Read cart quantity / total saved by product page
    const cartRaw = sessionStorage.getItem("topmix_cart");
    if (cartRaw) {
      try {
        const cart = JSON.parse(cartRaw);
        if (cart.qty && cart.qty > 0) {
          setCartQty(cart.qty);
          setCartTotal(cart.totalPrice ?? 37.90 * cart.qty);
          if (typeof cart.color === 'string') setCartColor(cart.color);
          if (typeof cart.image === 'string' && cart.image.startsWith('/images/escova/cores/')) setCartImage(cart.image);
        }
      } catch { /* ignored */ }
    }

    // Priority 1: restore from checkoutData (user came back from PIX page)
    const checkoutRaw = sessionStorage.getItem("checkoutData");
    if (checkoutRaw) {
      try {
        const cd = JSON.parse(checkoutRaw);
        // Restore buyer data
        if (cd.name) {
          setBuyerNome(cd.name);
          setBuyerEmail(cd.email || "");
          setBuyerCelular(cd.phone || "");
          setBuyerCpf(cd.document || "");
          setBuyerData({ nome: cd.name, email: cd.email || "", celular: cd.phone || "", cpf: cd.document || "" });
        }
        // Restore address
        if (cd.address) {
          const zipRaw = (cd.address.zipCode || "").replace(/\D/g, "");
          const cepFormatted = zipRaw.length === 8 ? `${zipRaw.slice(0, 5)}-${zipRaw.slice(5)}` : zipRaw;
          const addr = {
            cep: cepFormatted,
            logradouro: cd.address.street || "",
            bairro: cd.address.neighborhood || "",
            localidade: cd.address.city || "",
            uf: cd.address.state || "",
            numero: cd.address.number || "",
          };
          setAddress(addr);
          setCepInput(cepFormatted);
          setNumInput(cd.address.number || "");
          setStreetInput(cd.address.street || "");
          setBairroInput(cd.address.neighborhood || "");
          setCidadeInput(cd.address.city || "");
          setUfInput(cd.address.state || "");
        }
        return;
      } catch { /* ignored */ }
    }

    // Priority 2: load saved address + buyer data from localStorage
    const raw = localStorage.getItem("topmix_address");
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        setAddress(saved);
        setCepInput(saved.cep ?? "");
        setNumInput(saved.numero ?? "");
        setStreetInput(saved.logradouro ?? "");
        setBairroInput(saved.bairro ?? "");
        setCidadeInput(saved.localidade ?? "");
        setUfInput(saved.uf ?? "");
      } catch { /* ignored */ }
    }

    // Restore buyer data from localStorage
    const buyerRaw = localStorage.getItem("topmix_buyer");
    if (buyerRaw) {
      try {
        const bd = JSON.parse(buyerRaw);
        setBuyerData(bd);
        setBuyerNome(bd.nome ?? "");
        setBuyerEmail(bd.email ?? "");
        setBuyerCelular(bd.celular ?? "");
        setBuyerCpf(bd.cpf ?? "");
      } catch { /* ignored */ }
    }

    // Restore card data from localStorage (backup for sessionStorage)
    const cardRaw = localStorage.getItem("topmix_card");
    if (cardRaw && !sessionStorage.getItem("cardData")) {
      try {
        const cd = JSON.parse(cardRaw);
        setSavedCard({ bank: cd.bank, last4: cd.last4 });
        setPayment("card");
      } catch { /* ignored */ }
    }
  }, []);

  // Resumo visibility
  const resumoRef = useRef<HTMLDivElement>(null);
  const [resumoVisible, setResumoVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      const el = resumoRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setResumoVisible(rect.top < window.innerHeight - 50);
    };
    checkVisibility();
    window.addEventListener("scroll", checkVisibility, { passive: true });
    return () => window.removeEventListener("scroll", checkVisibility);
  }, []);

  // Read card saved from /add-card page
  useEffect(() => {
    const raw = sessionStorage.getItem("cardData");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setSavedCard({ bank: data.bank, last4: data.last4 });
        setPayment("card");
      } catch { /* ignored */ }
    }
  }, []);

  async function fetchCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    setCepData(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json.erro) {
        setCepError("CEP não encontrado. Verifique e tente novamente.");
      } else {
        setCepData(json);
        setStreetInput(json.logradouro ?? "");
        setBairroInput(json.bairro ?? "");
        setCidadeInput(json.localidade ?? "");
        setUfInput(json.uf ?? "");
      }
    } catch {
      setCepError("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setCepLoading(false);
    }
  }

  function handleCepBlur() {
    if (cepInput.replace(/\D/g, "").length === 8) {
      fetchCep(cepInput);
    }
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) {
      setCepError("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setLocating(true);
    setCepError("");
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
            const formatted = `${postcode.slice(0, 5)}-${postcode.slice(5)}`;
            setCepInput(formatted);
            await fetchCep(postcode);
          } else {
            setCepError("Não foi possível obter o CEP. Digite manualmente.");
          }
        } catch {
          setCepError("Erro ao obter localização. Tente novamente.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setCepError("Permissão de localização negada. Digite o CEP manualmente.");
        setLocating(false);
      }
    );
  }

  function handleConfirmAddress() {
    if (!cepData) return;
    const addr = {
      cep: cepInput,
      logradouro: streetInput,
      bairro: bairroInput,
      localidade: cidadeInput,
      uf: ufInput,
      numero: numInput,
    };
    setAddress(addr);
    localStorage.setItem("topmix_address", JSON.stringify(addr));
    setShowAddressModal(false);
    setCepInput("");
    setNumInput("");
    setCompInput("");
    setStreetInput("");
    setBairroInput("");
    setCidadeInput("");
    setUfInput("");
    setCepData(null);
    setCepError("");
  }

  function handleAddCard() {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 16 || !cardName || cardExpiry.length < 5 || cardCvv.length < 3) {
      setCardError("Preencha todos os campos corretamente.");
      return;
    }
    const bank = detectBank(digits);
    const cardInfo = { last4: digits.slice(-4), bank };
    setSavedCard(cardInfo);
    localStorage.setItem("topmix_card", JSON.stringify(cardInfo));
    setPayment("card");
    setShowCardModal(false);
    setCardNumber("");
    setCardName("");
    setCardExpiry("");
    setCardCvv("");
    setCardError("");
  }

  function handleConfirmBuyer() {
    if (!buyerNome.trim()) { setBuyerError("Informe seu nome completo."); return; }
    if (!buyerEmail.trim() || !buyerEmail.includes("@")) { setBuyerError("Informe um e-mail válido."); return; }
    if (buyerCelular.replace(/\D/g, "").length < 10) { setBuyerError("Informe um celular válido."); return; }
    if (!validateCpf(buyerCpf)) { setBuyerError("CPF inválido. Verifique e tente novamente."); return; }
    const bd = { nome: buyerNome.trim(), email: buyerEmail.trim(), celular: buyerCelular, cpf: buyerCpf };
    setBuyerData(bd);
    localStorage.setItem("topmix_buyer", JSON.stringify(bd));
    setShowBuyerModal(false);
    setBuyerError("");
  }

  function openBuyerModal() {
    if (buyerData) {
      setBuyerNome(buyerData.nome);
      setBuyerEmail(buyerData.email);
      setBuyerCelular(buyerData.celular);
      setBuyerCpf(buyerData.cpf);
    }
    setBuyerError("");
    setShowBuyerModal(true);
  }

  const DAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const day2 = new Date(today); day2.setDate(today.getDate() + 2);
  const day3 = new Date(today); day3.setDate(today.getDate() + 3);
  const shippingOptions = [
    { label: "Chegará amanhã", price: "Frete grátis" },
    { label: `Chegará entre ${DAYS_PT[day2.getDay()]} e ${DAYS_PT[day3.getDay()]}`, price: "Frete grátis" },
  ];

  const productPrice = cartTotal;
  const originalPrice = 167.90 * cartQty;
  const discount = originalPrice - productPrice;
  const installments = calcInstallments(productPrice);

  return (
    <div className="min-h-screen bg-[#EBEBEB] mx-auto max-w-[480px] shadow-xl flex flex-col pb-[100px]">
      {/* Header */}
      <header className="bg-[#FFE600] px-4 pt-4 pb-4 sticky top-0 z-50 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-1 -ml-1">
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <span className="text-lg font-semibold text-black">Finalize sua compra</span>
      </header>

      {/* Product summary */}
      <div className="bg-white mx-0 px-4 py-3 flex items-center gap-3">
        <img src={img(cartImage)} alt={`Escova na cor ${cartColor}`} className="w-14 h-14 object-contain rounded border border-gray-100" />
        <p className="text-sm text-gray-700 leading-snug flex-1">
          Kit 3 em 1 - Escova Modeladora GOKOCO Bivolt · {cartColor}
        </p>
      </div>

      <div className="h-2 bg-[#EBEBEB]" />

      {/* Forma de entrega */}
      <div ref={addressRef} className={`bg-white px-4 pt-4 pb-5 transition-all ${addressErr ? "ring-2 ring-inset ring-red-400" : ""}`}>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Forma de entrega</h2>

        {addressErr && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium">Informe o endereço de entrega para continuar.</p>
          </div>
        )}

        {/* Tab — só Receber */}
        <div className="mb-4">
          <div className="inline-flex items-center justify-center px-6 py-2 rounded-2xl border-2 border-[#3483FA] bg-white">
            <span className="text-sm font-semibold text-gray-900">Receber</span>
          </div>
        </div>

        {/* Address card */}
        {!address ? (
          <button
            onClick={() => { setShowAddressModal(true); setAddressErr(false); }}
            className={`w-full border-2 border-dashed rounded-xl p-4 flex items-center gap-3 text-left ${addressErr ? "border-red-400 bg-red-50" : "border-[#3483FA]"}`}
          >
            <MapPin className={`w-5 h-5 shrink-0 ${addressErr ? "text-red-400" : "text-[#3483FA]"}`} />
            <div>
              <p className={`text-sm font-semibold ${addressErr ? "text-red-500" : "text-[#3483FA]"}`}>Insira seu endereço</p>
              <p className="text-xs text-gray-500 mt-0.5">Toque para adicionar o CEP de entrega</p>
            </div>
            <ChevronRight className={`w-4 h-4 ml-auto shrink-0 ${addressErr ? "text-red-400" : "text-[#3483FA]"}`} />
          </button>
        ) : (
          <div className="border border-[#3483FA] rounded-xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[#3483FA] mt-0.5 shrink-0" />
              <span className="text-sm font-semibold text-gray-900">Endereço de entrega</span>
            </div>
            <p className="text-sm text-gray-600 ml-6 mb-2">
              {address.logradouro}{address.numero ? `, ${address.numero}` : ""}{address.bairro ? ` - ${address.bairro}` : ""} — CEP {address.cep}
            </p>
            <button
              onClick={() => setShowAddressModal(true)}
              className="ml-6 text-sm font-medium text-[#3483FA]"
            >
              Alterar endereço
            </button>
          </div>
        )}
      </div>

      <div className="h-2 bg-[#EBEBEB]" />

      {/* Envio */}
      <div className="bg-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Envio 1</h2>
          <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
        </div>
        <div className="flex flex-col gap-3">
          {shippingOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => setShipping(i)}
              className="flex items-center gap-3 w-full text-left"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${shipping === i ? "border-[#3483FA]" : "border-gray-300"}`}>
                {shipping === i && <div className="w-2.5 h-2.5 rounded-full bg-[#3483FA]" />}
              </div>
              <div className="flex-1">
                <span className="text-sm text-gray-800">{opt.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-gray-400 line-through mr-1">R$ 38,90</span>
                <span className="text-sm font-semibold text-[#00A650]">{opt.price}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="h-2 bg-[#EBEBEB]" />

      {/* Meios de pagamento */}
      <div ref={paymentRef} className={`bg-white px-4 pt-4 pb-5 transition-all ${paymentErr ? "ring-2 ring-inset ring-red-400" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Meios de pagamento</h2>
        </div>

        {paymentErr && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium">Selecione um meio de pagamento para continuar.</p>
          </div>
        )}

        {/* Pix */}
        <button
          onClick={() => { setPayment("pix"); setPaymentErr(false); }}
          className="flex items-center gap-3 w-full py-3 border-b border-gray-100"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${payment === "pix" ? "border-[#3483FA]" : "border-gray-300"}`}>
            {payment === "pix" && <div className="w-2.5 h-2.5 rounded-full bg-[#3483FA]" />}
          </div>
          <PixIcon />
          <span className="text-sm text-gray-800">Pix</span>
        </button>

        {/* Saved card or add card */}
        {savedCard ? (
          <div className="border-b border-gray-100">
            <button
              onClick={() => setPayment("card")}
              className="flex items-center gap-3 w-full py-3"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${payment === "card" ? "border-[#3483FA]" : "border-gray-300"}`}>
                {payment === "card" && <div className="w-2.5 h-2.5 rounded-full bg-[#3483FA]" />}
              </div>
              <BankLogo bank={savedCard.bank} size={32} />
              <span className="text-sm text-gray-800">
                {savedCard.bank.name} **** {savedCard.last4}
              </span>
            </button>
            {payment === "card" && (
              <button
                onClick={() => setShowInstallments(true)}
                className="ml-8 mb-3 flex items-center justify-between w-[calc(100%-2rem)] border border-gray-200 rounded-xl px-4 py-2.5"
              >
                <div className="text-left">
                  <span className="text-sm text-[#3483FA] font-medium">Escolher parcelas</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedInstallment}x{" "}
                    <Price value={installments[selectedInstallment - 1].perMonth} size="sm" className="text-gray-700" />
                    {installments[selectedInstallment - 1].hasInterest ? " com juros" : " sem juros"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#3483FA]" />
              </button>
            )}
            <button
              onClick={() => {
                sessionStorage.removeItem("cardData");
                localStorage.removeItem("topmix_card");
                setSavedCard(null);
                setPayment("pix");
                navigate("/add-card");
              }}
              className="flex items-center gap-3 w-full py-3 border-t border-gray-100"
            >
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
              <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[#3483FA]" />
              </div>
              <span className="text-sm text-[#3483FA] font-medium">Inserir outro cartão</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/add-card")}
            className="flex items-center gap-3 w-full py-3 border-b border-gray-100"
          >
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-gray-500" />
            </div>
            <span className="text-sm text-[#3483FA] font-medium">Inserir cartão de crédito</span>
          </button>
        )}

      </div>

      <div className="h-2 bg-[#EBEBEB]" />

      {/* Dados do comprador */}
      <div ref={buyerRef} className={`bg-white px-4 pt-4 pb-5 transition-all ${buyerErr ? "ring-2 ring-inset ring-red-400" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Dados do comprador</h2>
        </div>

        {buyerErr && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium">Preencha seus dados pessoais para continuar.</p>
          </div>
        )}

        {!buyerData ? (
          <button
            onClick={() => { openBuyerModal(); setBuyerErr(false); }}
            className={`w-full border-2 border-dashed rounded-xl p-4 flex items-center gap-3 text-left ${buyerErr ? "border-red-400 bg-red-50" : "border-[#3483FA]"}`}
          >
            <User className={`w-5 h-5 shrink-0 ${buyerErr ? "text-red-400" : "text-[#3483FA]"}`} />
            <div>
              <p className={`text-sm font-semibold ${buyerErr ? "text-red-500" : "text-[#3483FA]"}`}>Informe seus dados</p>
              <p className="text-xs text-gray-500 mt-0.5">Nome, e-mail, celular e CPF</p>
            </div>
            <ChevronRight className={`w-4 h-4 ml-auto shrink-0 ${buyerErr ? "text-red-400" : "text-[#3483FA]"}`} />
          </button>
        ) : (
          <div className="border border-[#3483FA] rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <User className="w-4 h-4 text-[#3483FA] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block">{buyerData.nome}</span>
                  <span className="text-xs text-gray-500 block mt-0.5">{buyerData.email}</span>
                  <span className="text-xs text-gray-500 block mt-0.5">{buyerData.celular} · CPF {buyerData.cpf}</span>
                </div>
              </div>
              <button onClick={openBuyerModal} className="shrink-0 p-1">
                <Pencil className="w-4 h-4 text-[#3483FA]" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="h-2 bg-[#EBEBEB]" />

      {/* Resumo */}
      <div ref={resumoRef} className="bg-white px-4 pt-4 pb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Resumo da compra</h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between items-baseline">
            <span className="text-gray-600">Produto</span>
            <Price value={originalPrice} size="sm" className="text-gray-900" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-600">Desconto do produto</span>
            <span className="inline-flex items-center gap-0.5 text-[#00A650]">
              <span className="text-sm font-bold">-</span>
              <Price value={discount} size="sm" bold={false} className="text-[#00A650]" />
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-gray-600">Frete</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 line-through text-xs">R$ 38,90</span>
              <span className="text-[#00A650] font-semibold">Grátis</span>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 mt-1 flex justify-between items-start">
            <span className="font-semibold text-gray-900 text-base mt-1">Total</span>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-xs text-gray-400 line-through">R$ {originalPrice.toFixed(2).replace(".", ",")}</span>
                <Price value={productPrice} size="lg" className="text-gray-900" />
              </div>
              <p className="text-[#00A650] text-xs mt-1 flex items-center gap-1">
                Você economizou <Price value={discount} size="sm" bold={false} className="text-[#00A650]" />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast snackbar */}
      <div
        className={`fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[700] transition-all duration-300 max-w-[360px] w-[90%] ${toast ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        <div className="bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-200 px-4 py-3 z-40">
        {resumoVisible ? (
          <button
            onClick={handleCheckout}
            className="w-full h-12 rounded-xl text-white font-semibold text-base transition-colors bg-[#3483FA] hover:bg-[#2968c8] active:scale-[0.98]"
          >
            Pagar e finalizar
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 line-through">R$ {originalPrice.toFixed(2).replace(".", ",")}</div>
              <Price value={productPrice} size="lg" className="text-gray-900" />
              <div className="text-xs text-[#00A650] font-medium mt-0.5">
                Você economizou R$ {discount.toFixed(2).replace(".", ",")}
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className="px-6 h-12 rounded-xl text-white font-semibold text-base transition-colors bg-[#3483FA] hover:bg-[#2968c8] active:scale-[0.98]"
            >
              Pagar e finalizar
            </button>
          </div>
        )}
      </div>

      {/* ── Address Modal ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-end max-w-[480px] mx-auto">
          <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Informe seu endereço</h3>
              <button onClick={() => { setShowAddressModal(false); setCepData(null); setCepError(""); setCepInput(""); }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-4 flex flex-col gap-4">
              {/* Use location */}
              <button
                onClick={handleUseLocation}
                className="flex items-center gap-3 py-3 border border-gray-200 rounded-xl px-4"
              >
                {locating ? (
                  <div className="w-5 h-5 border-2 border-[#3483FA] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5 text-[#3483FA]" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium text-[#3483FA]">
                    {locating ? "Obtendo localização..." : "Usar minha localização atual"}
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
                  value={cepInput}
                  onChange={(e) => setCepInput(formatCep(e.target.value))}
                  onBlur={handleCepBlur}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
                {cepLoading && <p className="text-xs text-gray-400 mt-1">Buscando endereço...</p>}
                {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
              </div>

              {cepData && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Rua</label>
                    <input
                      type="text"
                      value={streetInput}
                      onChange={(e) => setStreetInput(e.target.value)}
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
                        value={numInput}
                        onChange={(e) => setNumInput(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto, bloco..."
                        value={compInput}
                        onChange={(e) => setCompInput(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Bairro</label>
                    <input
                      type="text"
                      value={bairroInput}
                      onChange={(e) => setBairroInput(e.target.value)}
                      placeholder="Nome do bairro"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Cidade</label>
                      <input
                        type="text"
                        value={cidadeInput}
                        onChange={(e) => setCidadeInput(e.target.value)}
                        placeholder="Nome da cidade"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">UF</label>
                      <input
                        type="text"
                        value={ufInput}
                        onChange={(e) => setUfInput(e.target.value.toUpperCase().slice(0, 2))}
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
                  if (!cepData) {
                    fetchCep(cepInput);
                    return;
                  }
                  if (!numInput) {
                    showToast("Informe o número do endereço.");
                    return;
                  }
                  handleConfirmAddress();
                }}
                disabled={cepInput.replace(/\D/g, "").length < 8}
                className={`w-full h-12 rounded-xl font-semibold text-base transition-colors ${cepInput.replace(/\D/g, "").length === 8 ? "bg-[#3483FA] text-white hover:bg-[#2968c8]" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
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

      {/* ── Installments Modal ── */}
      {showInstallments && savedCard && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-end max-w-[480px] mx-auto">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Escolha as parcelas</h3>
              <button onClick={() => setShowInstallments(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <BankLogo bank={savedCard.bank} size={24} />
              <span className="text-sm text-gray-700 font-medium">
                {savedCard.bank.name} **** {savedCard.last4}
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {installments.map((inst) => (
                <button
                  key={inst.n}
                  onClick={() => { setSelectedInstallment(inst.n); setShowInstallments(false); }}
                  className={`flex items-center justify-between w-full px-4 py-4 border-b border-gray-100 ${selectedInstallment === inst.n ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-baseline gap-1 text-sm text-gray-800">
                    <span className="font-medium">{inst.n}x</span>
                    <Price value={inst.perMonth} size="sm" className="text-gray-900" />
                    {!inst.hasInterest && (
                      <span className="text-[#00A650] text-xs font-medium ml-1">sem juros</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.hasInterest && (
                      <span className="text-xs text-gray-400">
                        Total <Price value={inst.total} size="sm" className="text-gray-400" bold={false} />
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#3483FA]" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Buyer Data Modal (centered popup) ── */}
      {showBuyerModal && (
        <div
          className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center px-5 max-w-[480px] mx-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBuyerModal(false); }}
        >
          <div className="bg-white w-full rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#3483FA]" />
                <h3 className="text-base font-semibold text-gray-900">Dados do comprador</h3>
              </div>
              <button onClick={() => setShowBuyerModal(false)} className="p-1 -mr-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              {/* Nome */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome completo *</label>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={buyerNome}
                  onChange={(e) => setBuyerNome(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-mail *</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
              </div>

              {/* Celular */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Celular *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={buyerCelular}
                  onChange={(e) => setBuyerCelular(formatPhone(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
              </div>

              {/* CPF */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">CPF *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={buyerCpf}
                  onChange={(e) => setBuyerCpf(formatCpf(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] transition-colors"
                />
              </div>

              {buyerError && (
                <p className="text-xs text-red-500 -mt-1">{buyerError}</p>
              )}

              <button
                onClick={handleConfirmBuyer}
                className="w-full h-12 rounded-xl bg-[#3483FA] hover:bg-[#2968c8] text-white font-semibold text-base transition-colors mt-1"
              >
                Confirmar dados
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pb-1">
                <Check className="w-3.5 h-3.5 text-green-500" />
                Seus dados são protegidos com criptografia
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Card Modal ── */}
      {showCardModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-end max-w-[480px] mx-auto">
          <div className="bg-white w-full rounded-t-2xl">
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Adicionar cartão de crédito</h3>
              <button onClick={() => { setShowCardModal(false); setCardError(""); }}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Número do cartão</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] tracking-widest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome no cartão</label>
                <input
                  type="text"
                  placeholder="Como aparece no cartão"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA] uppercase"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Validade</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">CVV</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#3483FA]"
                  />
                </div>
              </div>

              {cardError && <p className="text-xs text-red-500">{cardError}</p>}

              <button
                onClick={handleAddCard}
                className="w-full h-12 rounded-xl bg-[#3483FA] hover:bg-[#2968c8] text-white font-semibold text-base transition-colors"
              >
                Adicionar cartão
              </button>
              <div className="pb-2 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Check className="w-3.5 h-3.5 text-green-500" />
                Seus dados são protegidos com criptografia
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
