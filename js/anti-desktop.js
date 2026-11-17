// =========================================================================
// BLOQUEADOR ANTI-DESKTOP & CLOAKER PROFISSIONAL (ZERO-FLICKER & DEVTOOLS PROOF)
// =========================================================================
// Detecta: PC, Mac, DevTools (Inspecionar / Emulação Mobile), Bots e Emuladores.
// Garante ZERO-FLICKER: O usuário de desktop NÃO vê o site real nem por 1 milissegundo.
// =========================================================================

(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // 1. CONFIGURAÇÃO DO LINK DE REDIRECIONAMENTO
  // -----------------------------------------------------------------------
  // Insira abaixo o link para onde usuários de desktop devem ser enviados:
  var REDIRECT_URL = 'https://br.gokocobeauty.com/';

  // -----------------------------------------------------------------------
  // 2. BYPASS DE ADMINISTRAÇÃO E TESTES
  // -----------------------------------------------------------------------
  // Permite que o administrador acesse o painel (/admin, /admin.html) ou use ?admin=1 no PC
  try {
    var path = window.location.pathname.toLowerCase();
    var search = window.location.search.toLowerCase();
    if (path.indexOf('/admin') !== -1 || search.indexOf('admin=1') !== -1 || search.indexOf('bypass=1') !== -1) {
      return;
    }
  } catch(e) {}

  // -----------------------------------------------------------------------
  // 3. BLINDAGEM VISUAL INSTANTÂNEA (ANTI-FLICKER)
  // -----------------------------------------------------------------------
  // Oculta a página antes mesmo de ser renderizada ou de carregar pixels/imagens
  var doc = document.documentElement;
  if (doc) {
    doc.style.visibility = 'hidden';
  }

  function allowAccess() {
    if (doc) {
      doc.style.visibility = '';
    }
  }

  function blockAccess() {
    // Interrompe imediatamente qualquer download de recursos (imagens, scripts, pixels)
    if (window.stop) {
      try { window.stop(); } catch(e) {}
    }
    // Redirecionamento instantâneo sem histórico (impede que o botão voltar mostre o site)
    window.location.replace(REDIRECT_URL);
  }

  try {
    var ua = navigator.userAgent || '';
    var plat = navigator.platform || '';
    var uaData = navigator.userAgentData;

    // ---------------------------------------------------------------------
    // CAMADA 1: BOTS, SCRAPERS E NAVEGADORES AUTOMATIZADOS (HEADLESS)
    // ---------------------------------------------------------------------
    var isHeadless = !!navigator.webdriver;
    var isBot = /bot|googlebot|crawler|spider|headless|puppeteer|selenium|phantom|slurp|facebookexternalhit/i.test(ua);
    if (isHeadless || isBot) {
      blockAccess();
      return;
    }

    // ---------------------------------------------------------------------
    // CAMADA 2: DEVTOOLS MOBILE EMULATION NO PC (INSPECIONAR ELEMENTO)
    // ---------------------------------------------------------------------
    // No PC usando DevTools para forçar modo mobile:
    // outerWidth/outerHeight representam a janela/monitor real do PC (ex: 1920x1080),
    // enquanto innerWidth/innerHeight são emulados (ex: 375x667).
    // Em celulares reais, outerWidth é idêntico a innerWidth (ou 0).
    var isDevToolsMobile = false;
    if (window.outerWidth > 0 && window.innerWidth > 0) {
      var widthDiff = window.outerWidth - window.innerWidth;
      var heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 160 || heightDiff > 220) {
        isDevToolsMobile = true;
      }
    }

    // ---------------------------------------------------------------------
    // CAMADA 3: USER-AGENT E CLIENT HINTS (SISTEMA REAL)
    // ---------------------------------------------------------------------
    var isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    var isDesktopPlatform = /Win32|Win64|Windows|MacIntel|Linux x86_64|Linux i686/i.test(plat);

    var isDesktopUAData = false;
    if (uaData) {
      if (uaData.mobile === false) isDesktopUAData = true;
      if (uaData.platform && /Windows|macOS|Linux/i.test(uaData.platform) && !/Android/i.test(uaData.platform)) {
        isDesktopUAData = true;
      }
    }

    // ---------------------------------------------------------------------
    // CAMADA 4: DETECÇÃO DE TOUCH E DISPOSITIVOS APONTADORES (MOUSE X TOQUE)
    // ---------------------------------------------------------------------
    var maxTouch = navigator.maxTouchPoints || 0;
    var hasTouch = maxTouch > 0 || ('ontouchstart' in window);
    var hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    var hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    // iPad detection (Safari no iPad envia 'MacIntel', mas possui multi-touch real)
    var isIPad = plat === 'MacIntel' && maxTouch > 1;

    // ---------------------------------------------------------------------
    // CAMADA 5: WEBGL RENDERER (PLACA DE VÍDEO DE DESKTOP)
    // ---------------------------------------------------------------------
    // Mesmo que o DevTools mude o User-Agent, a GPU do PC continua sendo exposta via WebGL.
    var isDesktopGPU = false;
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
          var desktopGpuRegex = /GeForce|RTX|GTX|Quadro|Radeon|AMD|Intel.*(Iris|UHD|HD|Graphics)|ANGLE|SwiftShader|llvmpipe|VirtualBox|VMware/i;
          var mobileGpuRegex = /Mali|Adreno|PowerVR|Apple GPU|ImgTec/i;
          if (desktopGpuRegex.test(renderer) && !mobileGpuRegex.test(renderer)) {
            isDesktopGPU = true;
          }
        }
      }
    } catch(e) {}

    // ---------------------------------------------------------------------
    // CAMADA 6: RESOLUÇÃO DE TELA DE MONITOR
    // ---------------------------------------------------------------------
    var sw = screen.width || 0;
    var sh = screen.height || 0;
    var isBigMonitor = (sw >= 1200 && sh >= 700);

    // ---------------------------------------------------------------------
    // CÁLCULO DE SCORE / VEREDITO
    // ---------------------------------------------------------------------
    var score = 0;

    // Sinais fortes de Desktop / DevTools (3 ou 4 pontos cada)
    if (isDesktopPlatform && !isIPad) score += 3;
    if (isDesktopUAData) score += 3;
    if (!isMobileUA) score += 3;
    if (!hasTouch) score += 3;
    if (isDevToolsMobile) score += 4;
    if (isDesktopGPU && !isIPad) score += 3;

    // Sinais secundários (2 pontos cada)
    if (hasFinePointer && !hasCoarsePointer) score += 2;
    if (hasHover && !hasCoarsePointer) score += 2;
    if (isBigMonitor && !hasTouch) score += 2;

    // Veredito
    if (score >= 3) {
      blockAccess();
      return;
    }

    // Se aprovado como mobile legítimo, libera a visualização instantaneamente
    allowAccess();

  } catch(err) {
    // Fail-safe: se ocorrer algum erro inesperado no script, libera para não prejudicar comprador mobile
    allowAccess();
  }
})();
