import { productFaqs } from "@/lib/product-faqs";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, MessageCircle } from "lucide-react";

const objecoesPrincipais = productFaqs.slice(0, 4);

const faqs = [
  {
    categoria: "Produto",
    perguntas: productFaqs,
  },
  {
    categoria: "Entrega",
    perguntas: [
      {
        q: "Qual o prazo de entrega?",
        r: "O prazo varia conforme sua localidade. Para a maioria das cidades, a entrega ocorre entre 1 e 3 dias úteis após a confirmação do pagamento.",
      },
      {
        q: "O frete é grátis?",
        r: "Sim! Oferecemos frete grátis para todo o Brasil em todos os nossos kits.",
      },
      {
        q: "Como rastreio meu pedido?",
        r: "Após o envio, você receberá o código de rastreamento por e-mail e SMS. Também é possível rastrear diretamente na nossa página de rastreamento.",
      },
    ],
  },
  {
    categoria: "Pagamento",
    perguntas: [
      {
        q: "Quais formas de pagamento vocês aceitam?",
        r: "Aceitamos Pix, cartões de crédito (Visa, Mastercard, Elo, Amex) e boleto bancário. Parcelamos em até 5x sem juros no cartão.",
      },
      {
        q: "O Pix tem desconto?",
        r: "Sim! Pagamentos via Pix têm 10% de desconto automático sobre o valor do produto.",
      },
      {
        q: "Meu pagamento foi confirmado. Quando meu pedido é enviado?",
        r: "Pedidos com pagamento confirmado até às 14h são preparados e enviados no mesmo dia. Após esse horário, o envio ocorre no próximo dia útil.",
      },
    ],
  },
  {
    categoria: "Trocas e Devoluções",
    perguntas: [
      {
        q: "Posso devolver se não gostar?",
        r: "Sim! Você tem 90 dias para solicitar a devolução, conforme nossa política de trocas e o Código de Defesa do Consumidor.",
      },
      {
        q: "O produto chegou danificado. O que fazer?",
        r: "Entre em contato conosco imediatamente pelo WhatsApp com fotos do produto e da embalagem. Resolveremos sem nenhum custo para você.",
      },
    ],
  },
];

function FaqItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-start justify-between gap-3 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{pergunta}</span>
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-transform duration-200"
          style={{
            background: aberto ? "linear-gradient(135deg,#E09400,#f5b800)" : "#f3f4f6",
            transform: aberto ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <span className="text-xs font-black" style={{ color: aberto ? "#fff" : "#6b7280" }}>+</span>
        </span>
      </button>
      {aberto && (
        <p className="pb-4 text-sm text-gray-500 leading-relaxed pr-6">{resposta}</p>
      )}
    </div>
  );
}

function ObjecaoItem({ item }: { item: typeof objecoesPrincipais[number] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b border-yellow-100 last:border-0">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <span className="text-xl shrink-0">{item.icon}</span>
        <span className="flex-1 text-sm font-bold text-gray-800">{item.q}</span>
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200"
          style={{
            background: aberto ? "linear-gradient(135deg,#E09400,#f5b800)" : "#f3f4f6",
            transform: aberto ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <span className="text-xs font-black" style={{ color: aberto ? "#fff" : "#6b7280" }}>+</span>
        </span>
      </button>
      {aberto && (
        <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed pl-14">{item.r}</p>
      )}
    </div>
  );
}

export default function DuvidasFrequentes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Voltar à Loja
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Dúvidas Frequentes</h1>
          <p className="text-sm text-gray-500 mt-1">Encontre respostas rápidas para as perguntas mais comuns.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Objeções Principais — destaque */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔥</span>
            <h2 className="font-black text-sm text-gray-900 uppercase tracking-wider">As dúvidas que todo mundo tem</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden"
            style={{ border: "2px solid #f5b800" }}>
            <div className="px-5 py-3 border-b border-yellow-100"
              style={{ background: "linear-gradient(135deg, #fffbeb, #fff8d6)" }}>
              <p className="text-xs font-bold" style={{ color: "#a06800" }}>
                Antes de comprar, veja as respostas para as perguntas mais comuns dos nossos clientes
              </p>
            </div>
            {objecoesPrincipais.map((item, i) => (
              <ObjecaoItem key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Categorias de FAQ */}
        {faqs.map((grupo, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg, #fffbeb, #fff8d6)" }}>
              <h2 className="font-black text-sm" style={{ color: "#a06800" }}>{grupo.categoria}</h2>
            </div>
            <div className="px-5">
              {grupo.perguntas.map((item, j) => (
                <FaqItem key={j} pergunta={item.q} resposta={item.r} />
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center space-y-3">
          <MessageCircle className="h-8 w-8 mx-auto text-green-600" />
          <h3 className="font-black text-gray-900">Não encontrou sua resposta?</h3>
          <p className="text-sm text-gray-500">Nossa equipe está pronta para ajudar você.</p>
          <Link href="/fale-conosco">
            <button className="px-6 py-2.5 rounded-xl font-black text-sm text-white hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #E09400, #f5b800)" }}>
              FALAR COM A EQUIPE
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
