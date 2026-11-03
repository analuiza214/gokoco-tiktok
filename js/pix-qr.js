// Generate PIX images locally, including gateways that return only copy/paste.
window.lvPixQrSource = function (code, image) {
  if (code && typeof qrcode === 'function') {
    try {
      var qr = qrcode(0, 'M');
      qr.addData(String(code));
      qr.make();
      return qr.createDataURL(6, 24);
    } catch (error) { console.error('Falha ao desenhar QR PIX'); }
  }
  if (image && /^(data:image|https?:)/.test(image)) return image;
  if (image) return 'data:image/png;base64,' + image;
  return '';
};
