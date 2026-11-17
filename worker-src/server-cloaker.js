// =========================================================================
// SERVER-SIDE CLOAKER & REVERSE PROXY SHIELD (CLOUDFLARE WORKER)
// =========================================================================
// Bloqueia bots da Meta/Facebook, Google, TikTok e Desktop SEM redirecionamento 302.
// Entrega a página segura diretamente no mesmo domínio (Status 200 OK),
// eliminando a acusação de "Link Enganoso" pela Meta.
// =========================================================================

export const CLOAK_TARGET_URL = 'https://br.gokocobeauty.com/';

// Bots da Meta / Facebook, crawlers de anúncios e scrapers automatizados
const AD_REVIEW_BOTS = /facebookexternalhit|Facebot|FacebookBot|MetaInspector|Google-Display-Ads-Bot|AdsBot-Google|TikTokBot|Bytespider|HeadlessChrome|Puppeteer|Selenium|PhantomJS|Wget|curl|python-requests|aiohttp|Go-http-client/i;

// Desktop explícito (Windows PC, Mac, Linux x86_64)
const DESKTOP_PLATFORMS = /Windows NT|Macintosh|X11; Linux x86_64/i;

export function shouldCloakRequest(request, url) {
  const path = url.pathname.toLowerCase();

  // 1. NUNCA bloqueia rotas de API, webhooks ou gateways de pagamento
  if (path.startsWith('/api/') || path.includes('webhook') || path.includes('/providers/')) {
    return false;
  }

  // 2. NUNCA bloqueia rotas de admin ou requisições com bypass do proprietário
  if (path.includes('/admin') || url.searchParams.get('admin') === '1' || url.searchParams.get('bypass') === '1') {
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
 * Entrega a página segura diretamente no mesmo domínio (Proxy Reverso),
 * respondendo com Status 200 OK sem nenhuma troca de URL na barra de endereços.
 */
export async function serveCloakedPage(request) {
  try {
    const response = await fetch(CLOAK_TARGET_URL, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    let html = await response.text();

    // Injeta a tag <base> para que todas as imagens, CSS e scripts da loja segura carreguem perfeitamente
    if (!/<base\s/i.test(html)) {
      html = html.replace(/<head>/i, `<head><base href="${CLOAK_TARGET_URL}">`);
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return new Response(html, {
      status: 200,
      headers
    });
  } catch (err) {
    // Fallback de segurança: página institucional limpa caso a requisição externa falhe
    const fallbackHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bella Mix Oficial | Beleza e Cuidados</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;margin:0;padding:40px 20px;text-align:center;color:#333;background:#fafafa}.card{max-width:540px;margin:auto;background:#fff;padding:40px 30px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06)}h1{color:#fe2c55;margin-bottom:12px}p{line-height:1.6;color:#666}</style></head><body><div class="card"><h1>Bella Mix Oficial</h1><p>Seja bem-vinda à loja Bella Mix Oficial. Produtos de beleza e cuidados pessoais para sua rotina.</p><p style="margin-top:24px;font-size:13px;color:#999">© Bella Mix Oficial - Todos os direitos reservados.</p></div></body></html>`;
    return new Response(fallbackHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
