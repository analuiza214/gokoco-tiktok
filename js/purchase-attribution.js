(function () {
  var keys = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid', 'ttclid'];
  var verdefyPixel=location.origin==='https://gokoco-tiktok.pages.dev'?'98988e4c-9c44-4d29-afea-9759b20d8604':null;
  if(verdefyPixel&&!document.querySelector('script[data-verdefy-loader]')){var loader=document.createElement('script');loader.src='https://verdefy-sales.joazinhisonetinho44.workers.dev/tracker.js?pixel='+verdefyPixel;loader.defer=true;loader.setAttribute('data-verdefy-loader','');document.head.appendChild(loader);}
  var storeKey = 'gokoco_attribution';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch (_) {}
  var params = new URLSearchParams(location.search);
  // Uma nova campanha substitui a anterior, evitando misturar campanhas distintas.
  if (keys.some(function (key) { return params.has(key); })) {
    saved = {};
    keys.forEach(function (key) { if (params.get(key)) saved[key] = params.get(key).slice(0, 500); });
    saved.saved_at = Date.now();
    try { localStorage.setItem(storeKey, JSON.stringify(saved)); } catch (_) {}
  }
  if (Date.now() - Number(saved.saved_at || 0) > 30 * 86400000) saved = {};
  function cookie(name) {
    var value = document.cookie.split(';').map(function (item) { return item.trim(); }).find(function (item) { return item.indexOf(name + '=') === 0; });
    return value ? value.slice(name.length + 1) : '';
  }
  window.getVerdefyTracking = function () {
    var result = {};
    if(verdefyPixel)result.verdefy_pixel=verdefyPixel;
    keys.forEach(function (key) { if (saved[key]) result[key] = saved[key]; });
    result.event_source_url = location.href;
    return result;
  };
  window.getUTMs = window.getVerdefyTracking;
  window.getFbData = function () {
    return { fbp: cookie('_fbp'), fbc: cookie('_fbc') || (saved.fbclid ? 'fb.1.' + saved.saved_at + '.' + saved.fbclid : '') };
  };
})();
