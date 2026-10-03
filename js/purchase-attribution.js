(function () {
  var keys = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
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
  window.getUTMs = function () {
    var result = {};
    keys.forEach(function (key) { if (saved[key]) result[key] = saved[key]; });
    result.event_source_url = location.href;
    return result;
  };
  window.getFbData = function () {
    return { fbp: cookie('_fbp'), fbc: cookie('_fbc') || (saved.fbclid ? 'fb.1.' + saved.saved_at + '.' + saved.fbclid : '') };
  };
})();
