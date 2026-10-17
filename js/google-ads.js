(function () {
  var id = 'AW-18518738981';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(script);

  window.trackGoogleAdsPurchase = function (amount, transactionId) {
    var value = Number(amount);
    var orderId = String(transactionId || '').trim();
    if (!Number.isFinite(value) || value <= 0 || !orderId) return;
    var key = 'gokoco_google_ads_purchase_' + orderId;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch (e) { /* The transaction ID is still sent for deduplication. */ }
    window.gtag('event', 'conversion', {
      send_to: 'AW-18518738981/_4X2CPOL_Z8dEKWQtv5E',
      value: value,
      currency: 'BRL',
      transaction_id: orderId
    });
  };
}());
