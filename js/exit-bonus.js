(() => {
  const overlay = document.getElementById('lv-bonus-overlay');
  const claim = document.getElementById('lv-bonus-claim');
  const decline = document.getElementById('lv-bonus-decline');
  const count = document.querySelector('.lv-bonus-count');
  if (!overlay || !claim || !decline || !count) return;
  let shown = false, leaving = false, armed = false, countdown;
  try { shown = sessionStorage.getItem('lv_exit_bonus_seen') === '1'; } catch (_) {}
  function close() {
    clearInterval(countdown);
    overlay.style.display = 'none';
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (leaving) { leaving = false; history.back(); }
  }
  function show(fromBack = false) {
    if (shown) return false;
    shown = true;
    leaving = fromBack;
    try { sessionStorage.setItem('lv_exit_bonus_seen', '1'); } catch (_) {}
    let remaining = 7;
    count.textContent = String(remaining);
    overlay.style.display = 'flex';
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    claim.focus();
    countdown = setInterval(() => {
      count.textContent = String(--remaining);
      if (remaining <= 0) close();
    }, 1000);
    return true;
  }
  document.addEventListener('mouseout', event => {
    if (!event.relatedTarget && event.clientY <= 0) show();
  });
  // Arm the mobile back button only after the customer interacts with the page.
  document.addEventListener('pointerdown', () => {
    if (shown || armed || !window.matchMedia('(pointer: coarse)').matches) return;
    try { history.pushState({ ...history.state, gokocoExitBonus: true }, '', location.href); armed = true; } catch (_) {}
  }, { once: true });
  window.addEventListener('popstate', () => {
    if (!armed) return;
    armed = false;
    if (!show(true)) history.back();
  });
  decline.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
  claim.addEventListener('click', () => {
    try { sessionStorage.setItem('lv_exit_bonus5', 'active'); } catch (_) {}
    leaving = false;
    close();
    // Use the regular purchase flow so color and quantity are selected first.
    const buy = document.querySelector('a.ttk-buy,a.ttk-secondary');
    if (buy) buy.click();
  });
})();
