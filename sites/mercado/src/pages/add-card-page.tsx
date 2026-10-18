import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, X, HelpCircle } from "lucide-react";

type BankInfo = { name: string; color: string; gradient: string; brand: string };

function detectBank(raw: string): BankInfo {
  const d = raw.replace(/\s/g, "");
  const b4 = d.slice(0, 4);
  if (["5509","5502","4891","5585","5507"].includes(b4))
    return { name: "Nubank", color: "#820AD1", gradient: "linear-gradient(135deg,#9B30F2 0%,#6B00C9 100%)", brand: "nubank" };
  if (["4510","4511","5178","5179","5148"].includes(b4))
    return { name: "Itaú", color: "#EC7000", gradient: "linear-gradient(135deg,#FF8C00 0%,#C85A00 100%)", brand: "itau" };
  if (["5228","5027","4576","4019","5185"].includes(b4))
    return { name: "Bradesco", color: "#CC092F", gradient: "linear-gradient(135deg,#E0143C 0%,#9A0022 100%)", brand: "bradesco" };
  if (["5173","5166","4747","4913"].includes(b4))
    return { name: "Inter", color: "#FF7A00", gradient: "linear-gradient(135deg,#FF8C1A 0%,#CC5500 100%)", brand: "inter" };
  if (["5189","5095","4024","5090"].includes(b4))
    return { name: "Caixa", color: "#0070AF", gradient: "linear-gradient(135deg,#0082CC 0%,#005580 100%)", brand: "caixa" };
  if (d[0] === "4") return { name: "Visa", color: "#1A1F71", gradient: "linear-gradient(135deg,#1A1F71 0%,#2E3491 100%)", brand: "visa" };
  if (d[0] === "5") return { name: "Mastercard", color: "#252525", gradient: "linear-gradient(135deg,#1C1C1E 0%,#3D3D3D 100%)", brand: "mastercard" };
  return { name: "Cartão", color: "#3483FA", gradient: "linear-gradient(135deg,#3483FA 0%,#1D5FC2 100%)", brand: "generic" };
}

function BrandMark({ brand }: { brand: string }) {
  if (brand === "nubank") return (
    <span style={{ color: "white", fontSize: 20, fontStyle: "italic", fontWeight: 800, fontFamily: "sans-serif", letterSpacing: -0.5 }}>nu</span>
  );
  if (brand === "visa") return (
    <span style={{ color: "white", fontSize: 13, fontWeight: 800, fontStyle: "italic", fontFamily: "serif", letterSpacing: 1 }}>VISA</span>
  );
  if (brand === "mastercard") return (
    <svg width="38" height="24" viewBox="0 0 38 24" fill="none">
      <circle cx="14" cy="12" r="11" fill="#EB001B" opacity="0.92"/>
      <circle cx="24" cy="12" r="11" fill="#F79E1B" opacity="0.9"/>
    </svg>
  );
  if (brand === "generic") return null;
  return <span style={{ color: "white", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{brand.toUpperCase()}</span>;
}

function CardFrontFace({ bank, number, name, expiry }: { bank: BankInfo; number: string; name: string; expiry: string }) {
  const d = number.replace(/\s/g, "");
  const g = [0,4,8,12].map(i => d.slice(i, i+4));

  function renderGroup(group: string, idx: number) {
    if (idx < 3) return group.length === 4 ? "●●●●" : "●●●●";
    const padded = group.padEnd(4, "·");
    return padded;
  }

  return (
    <div style={{
      background: bank.gradient,
      borderRadius: 16,
      width: "100%",
      paddingTop: "62.9%",
      position: "relative",
      boxShadow: "0 24px 56px rgba(0,0,0,0.35)",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, padding: "18px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.09)" }} />
        <div style={{ position: "absolute", top: 15, right: 25, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        {/* Top: bank logo */}
        <div><BrandMark brand={bank.brand} /></div>

        {/* Middle: card number */}
        <div style={{ display: "flex", gap: 10 }}>
          {g.map((grp, i) => (
            <span key={i} style={{ color: "white", fontSize: 15, letterSpacing: 2, fontFamily: "monospace", fontWeight: 500, minWidth: 40 }}>
              {renderGroup(grp, i)}
            </span>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 }}>Titular</div>
            <div style={{ color: "white", fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", maxWidth: 160 }}>
              {name || "NOME DO TITULAR"}
            </div>
            {expiry && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 }}>Validade</div>
                <div style={{ color: "white", fontSize: 11, fontFamily: "monospace" }}>{expiry}</div>
              </div>
            )}
          </div>
          {/* Mastercard overlay in bottom right */}
          {bank.brand !== "mastercard" && (
            <svg width="36" height="22" viewBox="0 0 38 24" fill="none">
              <circle cx="14" cy="12" r="11" fill="#EB001B" opacity="0.7"/>
              <circle cx="24" cy="12" r="11" fill="#F79E1B" opacity="0.65"/>
            </svg>
          )}
          {bank.brand === "mastercard" && (
            <svg width="36" height="22" viewBox="0 0 38 24" fill="none">
              <circle cx="14" cy="12" r="11" fill="#EB001B" opacity="0.9"/>
              <circle cx="24" cy="12" r="11" fill="#F79E1B" opacity="0.85"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function CardBackFace({ bank, cvv }: { bank: BankInfo; cvv: string }) {
  return (
    <div style={{
      background: bank.gradient,
      borderRadius: 16,
      width: "100%",
      paddingTop: "62.9%",
      position: "relative",
      boxShadow: "0 24px 56px rgba(0,0,0,0.35)",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#111", height: 42, marginTop: 28 }} />
        <div style={{ padding: "10px 20px", display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
          <div style={{
            flex: 1, height: 34, borderRadius: 4,
            backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 10px)",
            background: "rgba(255,255,255,0.25)",
          }} />
          <div style={{
            background: "white",
            borderRadius: 6,
            width: 50,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "monospace",
            color: "#111",
            border: "2px solid rgba(255,150,0,0.7)",
            boxShadow: "0 0 0 4px rgba(255,150,0,0.18)",
          }}>
            {cvv || "···"}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt4(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function fmtCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function isExpiryValid(v: string) {
  if (v.length !== 5) return false;
  const [mm, yy] = v.split("/").map(Number);
  if (!mm || mm < 1 || mm > 12) return false;
  const now = new Date();
  const expDate = new Date(2000 + yy, mm - 1, 1);
  return expDate >= new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function AddCardPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [cvvFocused, setCvvFocused] = useState(false);

  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched(t => ({ ...t, [field]: true }));

  const bank = detectBank(cardNum);
  const digits = cardNum.replace(/\s/g, "");

  const canNext = [
    digits.length >= 13,
    cardName.trim().length >= 2,
    expiry.length === 5 && cvv.length >= 3,
    cpf.replace(/\D/g, "").length === 11,
  ][step];

  function handleNext() {
    if (step < 3) {
      setStep(s => s + 1);
      setCvvFocused(false);
    } else {
      const cardInfo = {
        number: cardNum,
        name: cardName,
        expiry,
        last4: digits.slice(-4),
        bank,
        cpf,
      };
      sessionStorage.setItem("cardData", JSON.stringify(cardInfo));
      localStorage.setItem("topmix_card", JSON.stringify({ bank, last4: digits.slice(-4) }));

      // Try to restore buyer + address from localStorage to build checkoutData
      let hasBuyerData = false;
      const checkoutRaw = sessionStorage.getItem("checkoutData");
      if (checkoutRaw) {
        try { const cd = JSON.parse(checkoutRaw); hasBuyerData = !!cd.name; } catch { /* ignored */ }
      }

      if (!hasBuyerData) {
        // Try to build checkoutData from localStorage
        try {
          const buyerRaw = localStorage.getItem("topmix_buyer");
          const addrRaw = localStorage.getItem("topmix_address");
          if (buyerRaw && addrRaw) {
            const bd = JSON.parse(buyerRaw);
            const addr = JSON.parse(addrRaw);
            const zipRaw = (addr.cep || "").replace(/\D/g, "");
            sessionStorage.setItem("checkoutData", JSON.stringify({
              name: bd.nome,
              email: bd.email,
              phone: bd.celular,
              document: bd.cpf,
              address: {
                zipCode: zipRaw,
                state: addr.uf || "SP",
                city: addr.localidade || "",
                street: addr.logradouro || "",
                neighborhood: addr.bairro || "Centro",
                number: addr.numero || "S/N",
              },
              amount: 27.9,
            }));
            hasBuyerData = true;
          }
        } catch { /* ignored */ }
      }

      if (!hasBuyerData) {
        navigate("/cep");
      } else {
        navigate("/success?payment=card");
      }
    }
  }

  function handlePrev() {
    if (step > 0) { setStep(s => s - 1); setCvvFocused(false); }
    else navigate("/cep");
  }

  const showBack = step === 2 && cvvFocused;

  return (
    <div className="fixed inset-0 max-w-[480px] mx-auto bg-white flex flex-col">

      {/* Header */}
      <div className="bg-ml-yellow px-4 pt-4 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={handlePrev} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>
        <span className="text-base font-semibold text-black">Novo cartão de crédito</span>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-gray-100 shrink-0">
        <div
          className="h-full bg-[#3483FA] transition-all duration-400"
          style={{ width: `${((step + 1) / 4) * 100}%` }}
        />
      </div>

      {/* Card preview with 3D flip */}
      <div className="px-6 pt-6 pb-5 shrink-0">
        <div style={{ perspective: "1000px" }}>
          <div style={{
            transformStyle: "preserve-3d",
            transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.5s ease",
            position: "relative",
          }}>
            <div style={{ backfaceVisibility: "hidden" }}>
              <CardFrontFace bank={bank} number={cardNum} name={cardName} expiry={expiry} />
            </div>
            <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}>
              <CardBackFace bank={bank} cvv={cvv} />
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-5 pt-2 overflow-y-auto">

        {step === 0 && (() => {
          const err = touched.cardNum && digits.length > 0 && digits.length < 13;
          return (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Número do cartão</label>
              <div className={`flex items-center rounded-xl px-4 py-3 gap-2 border-2 ${err ? "border-red-500" : "border-[#3483FA]"}`}>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={cardNum}
                  onChange={e => { setCardNum(fmt4(e.target.value)); touch("cardNum"); }}
                  onBlur={() => touch("cardNum")}
                  placeholder="0000 0000 0000 0000"
                  className="flex-1 text-sm outline-none tracking-widest"
                />
                {cardNum && <button onClick={() => setCardNum("")}><X className="w-4 h-4 text-gray-400" /></button>}
              </div>
              {err && <p className="text-xs text-red-500 mt-1.5 ml-1">Número de cartão inválido.</p>}
            </div>
          );
        })()}

        {step === 1 && (() => {
          const err = touched.cardName && cardName.trim().length > 0 && cardName.trim().length < 2;
          return (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Nome do titular</label>
              <div className={`flex items-center rounded-xl px-4 py-3 gap-2 border-2 ${err ? "border-red-500" : "border-[#3483FA]"}`}>
                <input
                  autoFocus
                  type="text"
                  value={cardName}
                  onChange={e => { setCardName(e.target.value.toUpperCase()); touch("cardName"); }}
                  onBlur={() => touch("cardName")}
                  placeholder="Como aparece no cartão"
                  className="flex-1 text-sm outline-none uppercase"
                />
                {cardName && <button onClick={() => setCardName("")}><X className="w-4 h-4 text-gray-400" /></button>}
              </div>
              {err
                ? <p className="text-xs text-red-500 mt-1.5 ml-1">Informe o nome como aparece no cartão.</p>
                : <p className="text-xs text-gray-400 mt-1.5 ml-1">Conforme aparece no cartão.</p>
              }
            </div>
          );
        })()}

        {step === 2 && (() => {
          const expiryErr = touched.expiry && expiry.length > 0 && !isExpiryValid(expiry);
          const cvvErr = touched.cvv && cvv.length > 0 && cvv.length < 3;
          return (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Vencimento</label>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={e => { setExpiry(fmtExpiry(e.target.value)); touch("expiry"); }}
                  onBlur={() => touch("expiry")}
                  placeholder="MM/AA"
                  className={`w-full border rounded-xl px-3 py-3 text-sm outline-none ${expiryErr ? "border-2 border-red-500" : "border border-gray-300 focus:border-2 focus:border-[#3483FA]"}`}
                />
                {expiryErr && <p className="text-xs text-red-500 mt-1 ml-0.5">Data inválida.</p>}
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Cód. segurança</label>
                <div className={`flex items-center rounded-xl px-3 py-3 gap-2 border ${cvvErr ? "border-2 border-red-500" : "border-gray-300 focus-within:border-2 focus-within:border-[#3483FA]"}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cvv}
                    onChange={e => { setCvv(e.target.value.replace(/\D/g, "").slice(0, 3)); touch("cvv"); }}
                    onFocus={() => setCvvFocused(true)}
                    onBlur={() => { setCvvFocused(false); touch("cvv"); }}
                    placeholder="CVV"
                    maxLength={3}
                    className="flex-1 text-sm outline-none min-w-0"
                  />
                  <HelpCircle className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                {cvvErr && <p className="text-xs text-red-500 mt-1 ml-0.5">CVV inválido.</p>}
              </div>
            </div>
          );
        })()}

        {step === 3 && (() => {
          const cpfDigits = cpf.replace(/\D/g, "");
          const err = touched.cpf && cpfDigits.length > 0 && cpfDigits.length < 11;
          return (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Documento do titular</label>
              <div className={`flex items-center rounded-xl overflow-hidden border ${err ? "border-2 border-red-500" : "border-gray-300 focus-within:border-2 focus-within:border-[#3483FA]"}`}>
                <div className="px-3 py-3 text-xs font-semibold text-gray-600 border-r border-gray-200 bg-gray-50 flex items-center gap-1 shrink-0">
                  CPF <span className="text-[10px]">▾</span>
                </div>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={e => { setCpf(fmtCpf(e.target.value)); touch("cpf"); }}
                  onBlur={() => touch("cpf")}
                  placeholder="000.000.000-00"
                  className="flex-1 text-sm outline-none px-3 py-3 min-w-0"
                />
              </div>
              {err && <p className="text-xs text-red-500 mt-1.5 ml-1">CPF inválido. Verifique os números.</p>}
            </div>
          );
        })()}
      </div>

      {/* Footer navigation */}
      <div className="px-5 py-4 flex items-center justify-between border-t border-gray-100 shrink-0">
        <button
          onClick={handlePrev}
          className={`text-sm font-medium py-2 px-4 ${step === 0 ? "text-gray-300 pointer-events-none" : "text-[#3483FA]"}`}
        >
          Anterior
        </button>
        <button
          onClick={handleNext}
          disabled={!canNext}
          className={`text-sm font-semibold py-2 px-6 transition-colors ${canNext ? "text-[#3483FA]" : "text-gray-300"}`}
        >
          {step === 3 ? "Finalizar" : "Seguinte"}
        </button>
      </div>
    </div>
  );
}
