// =========================================================================
// BLOQUEADOR ANTI-DESKTOP, CLOAKER & BLINDAGEM ANTI-DEVTOOLS PROFISSIONAL
// =========================================================================
// Detecta: PC, Mac, DevTools (F12 / Inspecionar Elemento / Emulação Mobile), Bots.
// Proteções ativas:
// 1. Zero-Flicker: Usuário de desktop NÃO vê o site real nem por 1 milissegundo.
// 2. Anti-DevTools em Tempo Real: Detecta se o console for aberto a qualquer momento.
// 3. Bloqueio de Teclas: Desativa F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C e Ctrl+U.
// 4. Bloqueio de Botão Direito: Desativa contextmenu para impedir inspeção de código.
// 5. Bypass de Administrador: Permite acesso com ?admin=1 ou via /admin no PC.
// =========================================================================

(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // 1. CONFIGURAÇÃO DO LINK DE REDIRECIONAMENTO (PÁGINA LIMPA BELLA MIX)
  // -----------------------------------------------------------------------
  var REDIRECT_URL = '/whitepage.html';

  // -----------------------------------------------------------------------
  // 2. BYPASS DE ADMINISTRAÇÃO E TESTES
  // -----------------------------------------------------------------------
  try {
    var path = window.location.pathname.toLowerCase();
    var search = window.location.search.toLowerCase();
    if (path.indexOf('/admin') !== -1 || path.indexOf('/whitepage') !== -1 || search.indexOf('admin=1') !== -1 || search.indexOf('bypass=1') !== -1) {
      return; // Permite que o administrador acesse no computador e não bloqueia a whitepage
    }
  } catch(e) {}

  // -----------------------------------------------------------------------
  // 3. BLINDAGEM VISUAL INSTANTÂNEA (ZERO-FLICKER)
  // -----------------------------------------------------------------------
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
    if (window.stop) {
      try { window.stop(); } catch(e) {}
    }
    window.location.replace(REDIRECT_URL);
  }

  // -----------------------------------------------------------------------
  // 4. BLOQUEIO DE BOTÃO DIREITO (ANTI-INSPECIONAR)
  // -----------------------------------------------------------------------
  window.addEventListener('contextmenu', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    // Permite colar texto se for campo de formulário no celular
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    return false;
  }, true);

  // -----------------------------------------------------------------------
  // 5. BLOQUEIO DE TECLAS DE ATALHO DO DEVTOOLS (F12, CTRL+SHIFT+I, ETC.)
  // -----------------------------------------------------------------------
  window.addEventListener('keydown', function(e) {
    // F12
    if (e.keyCode === 123 || e.key === 'F12') {
      e.preventDefault();
      blockAccess();
      return false;
    }

    var ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl + Shift + I, Ctrl + Shift + J, Ctrl + Shift + C
    if (ctrlOrMeta && e.shiftKey) {
      var k = (e.key || '').toUpperCase();
      if (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || k === 'I' || k === 'J' || k === 'C') {
        e.preventDefault();
        blockAccess();
        return false;
      }
    }

    // Ctrl + U (Exibir código fonte da página)
    if (ctrlOrMeta && (e.keyCode === 85 || (e.key || '').toUpperCase() === 'U')) {
      e.preventDefault();
      blockAccess();
      return false;
    }

    // Ctrl + S (Salvar página completa)
    if (ctrlOrMeta && (e.keyCode === 83 || (e.key || '').toUpperCase() === 'S')) {
      e.preventDefault();
      return false;
    }
  }, true);

  // -----------------------------------------------------------------------
  // 6. DETECTOR CONTÍNUO DE ABERTURA DO DEVTOOLS EM TEMPO REAL
  // -----------------------------------------------------------------------
  function checkDevToolsDimensions() {
    if (window.outerWidth > 0 && window.innerWidth > 0) {
      var widthDiff = window.outerWidth - window.innerWidth;
      var heightDiff = window.outerHeight - window.innerHeight;
      // Se abrir o painel lateral ou inferior do DevTools no PC
      if (widthDiff > 160 || heightDiff > 220) {
        blockAccess();
      }
    }
  }

  // Verifica ao redimensionar a janela
  window.addEventListener('resize', checkDevToolsDimensions, { passive: true });

  // Checagem periódica em segundo plano
  setInterval(checkDevToolsDimensions, 1000);

  // -----------------------------------------------------------------------
  // 7. ANÁLISE DE DISPOSITIVO NO CARREGAMENTO
  // -----------------------------------------------------------------------
  try {
    var ua = navigator.userAgent || '';
    var plat = navigator.platform || '';
    var uaData = navigator.userAgentData;

    // BOTS E AUTOMATIZADORES
    var isHeadless = !!navigator.webdriver;
    var isBot = /bot|googlebot|crawler|spider|headless|puppeteer|selenium|phantom|slurp|facebookexternalhit/i.test(ua);
    if (isHeadless || isBot) {
      blockAccess();
      return;
    }

    // DEVTOOLS EMULANDO CELULAR NO PC
    var isDevToolsMobile = false;
    if (window.outerWidth > 0 && window.innerWidth > 0) {
      var wDiff = window.outerWidth - window.innerWidth;
      var hDiff = window.outerHeight - window.innerHeight;
      if (wDiff > 160 || hDiff > 220) {
        isDevToolsMobile = true;
      }
    }

    // USER-AGENT E CLIENT HINTS
    var isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    var isDesktopPlatform = /Win32|Win64|Windows|MacIntel|Linux x86_64|Linux i686/i.test(plat);

    var isDesktopUAData = false;
    if (uaData) {
      if (uaData.mobile === false) isDesktopUAData = true;
      if (uaData.platform && /Windows|macOS|Linux/i.test(uaData.platform) && !/Android/i.test(uaData.platform)) {
        isDesktopUAData = true;
      }
    }

    // DISPOSITIVOS APONTADORES (TOUCH X MOUSE)
    var maxTouch = navigator.maxTouchPoints || 0;
    var hasTouch = maxTouch > 0 || ('ontouchstart' in window);
    var hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    var hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    // iPad detection (Safari no iPad envia 'MacIntel', mas possui multi-touch real)
    var isIPad = plat === 'MacIntel' && maxTouch > 1;

    // PLACA DE VÍDEO (WEBGL RENDERER)
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

    // RESOLUÇÃO DE TELA DE MONITOR
    var sw = screen.width || 0;
    var sh = screen.height || 0;
    var isBigMonitor = (sw >= 1200 && sh >= 700);

    // CÁLCULO DE SCORE
    var score = 0;

    if (isDesktopPlatform && !isIPad) score += 3;
    if (isDesktopUAData) score += 3;
    if (!isMobileUA) score += 3;
    if (!hasTouch) score += 3;
    if (isDevToolsMobile) score += 4;
    if (isDesktopGPU && !isIPad) score += 3;

    if (hasFinePointer && !hasCoarsePointer) score += 2;
    if (hasHover && !hasCoarsePointer) score += 2;
    if (isBigMonitor && !hasTouch) score += 2;

    // VEREDITO
    if (score >= 3) {
      blockAccess();
      return;
    }

    // Se aprovado como mobile legítimo, revela a página instantaneamente
    allowAccess();

  } catch(err) {
    // Fail-safe: não trava compradores legítimos no celular
    allowAccess();
  }
})();
