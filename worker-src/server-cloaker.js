// =========================================================================
// SERVER-SIDE CLOAKER — BELLA MIX OFICIAL (CLOUDFLARE WORKER)
// =========================================================================
// Bloqueia bots da Meta/Facebook, Google, TikTok e Desktop SEM redirecionamento 302.
// Entrega a loja institucional limpa da Bella Mix diretamente no mesmo domínio (Status 200 OK),
// eliminando a acusação de "Link Enganoso" e qualquer problema com marcas de terceiros.
// =========================================================================

import { getWhitepageHtml } from './whitepage.js';

// Bots da Meta / Facebook, crawlers de anúncios e scrapers automatizados
const AD_REVIEW_BOTS = /facebookexternalhit|Facebot|FacebookBot|MetaInspector|Google-Display-Ads-Bot|AdsBot-Google|TikTokBot|Bytespider|HeadlessChrome|Puppeteer|Selenium|PhantomJS|Wget|curl|python-requests|aiohttp|Go-http-client/i;

// Desktop explícito (Windows PC, Mac, Linux x86_64)
const DESKTOP_PLATFORMS = /Windows NT|Macintosh|X11; Linux x86_64/i;

export function isOfertaSubdomain(url, env = {}) {
  const host = url.hostname.toLowerCase();
  const configured = String(env?.OFERTA_HOSTNAME || '').trim().toLowerCase();
  if (configured && host === configured) return true;

  if (/^(?:oferta|promo|promocao|oficial|lp|teste|b|loja2|seguro)\./i.test(host)) return true;

  if (host.endsWith('.bellamix-oficial.shop') && host !== 'bellamix-oficial.shop' && host !== 'www.bellamix-oficial.shop') {
    const market = String(env?.MARKET_HOSTNAME || '').trim().toLowerCase();
    const bella = String(env?.BELLA_HOSTNAME || '').trim().toLowerCase();
    if (host !== market && host !== bella) return true;
  }

  return false;
}

export function shouldCloakRequest(request, url, env = {}) {
  const path = url.pathname.toLowerCase();

  // 1. NUNCA bloqueia rotas de API, webhooks ou gateways de pagamento
  if (path.startsWith('/api/') || path.includes('webhook') || path.includes('/providers/')) {
    return false;
  }

  // 2. NUNCA bloqueia rotas de admin ou requisições com bypass do proprietário
  if (path.includes('/admin') || url.searchParams.get('admin') === '1' || url.searchParams.get('bypass') === '1') {
    return false;
  }

  // 2.1 Permite navegação direta entre as páginas da whitepage no desktop
  if (path.startsWith('/whitepage-')) {
    return false;
  }

  // 2.2 Oferta limpa / teste A/B: não cloaka, exibe a página real e limpa para bots e usuários
  if (path === '/oferta' || path === '/oferta.html' || path === '/pagamento-oferta' || path === '/pagamento-oferta.html') {
    return false;
  }
  if (isOfertaSubdomain(url, env)) {
    return false;
  }

  // 3. Ignora arquivos estáticos de mídia da loja (imagens, css, js, fontes)
  if (/\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|woff|woff2|ttf|mp4|webm)$/i.test(path)) {
    return false;
  }

  const userAgent = request.headers.get('User-Agent') || '';
  if (!userAgent) {
    return false;
  }

  // 4. Bloqueia bots de análise de anúncios da Meta e scrapers
  if (AD_REVIEW_BOTS.test(userAgent)) {
    return true;
  }

  // 5. Bloqueia navegadores Desktop explícitos (se não forem mobile/tablet)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  if (!isMobile && DESKTOP_PLATFORMS.test(userAgent)) {
    return true;
  }

  return false;
}

/**
 * Entrega a loja institucional limpa da Bella Mix diretamente no mesmo domínio (Status 200 OK)
 * Sem redirecionamento 302 e sem marcas de terceiros (Zero menção a TikTok).
 */
export async function serveCloakedPage(request) {
  const html = getWhitepageHtml();
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return new Response(html, {
    status: 200,
    headers
  });
}
