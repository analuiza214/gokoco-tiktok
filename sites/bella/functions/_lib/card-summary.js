// Nunca devolva dados completos do cartão nem um blob reversível ao painel.
export function safeCardSummary(value) {
  const summary = String(value || '').trim();
  return /^(Visa|Mastercard|Amex|Elo|Hipercard|Cartão) ••••[0-9]{4}$/.test(summary) ? summary : null;
}
