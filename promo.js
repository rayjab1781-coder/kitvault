(function () {
  const tab = document.getElementById('promo-tab');
  if (!tab) return;
  const panel = document.getElementById('promo-panel'); const input = document.getElementById('promo-input');
  const applyButton = document.getElementById('promo-apply'); const message = document.getElementById('promo-msg');
  tab.addEventListener('click', () => {
    panel.hidden = !panel.hidden; tab.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { input.value = window.KitVLTBasket.getPromo()?.code || ''; input.focus(); }
  });
  function paint() {
    const summary = window.KitVLTBasket.getSummary();
    document.getElementById('cart-discount-row').hidden = !summary.promo;
    document.getElementById('cart-discount-label').textContent = `Discount (${summary.promo?.code || ''})`;
    document.getElementById('cart-discount').textContent = '−' + window.KitVLTMoney(Math.round(summary.discount * 100));
    document.getElementById('cart-total').textContent = window.KitVLTMoney(Math.round(summary.total * 100));
    const remove = document.getElementById('promo-remove'); if (remove) remove.hidden = !summary.promo;
  }
  async function apply(code) {
    applyButton.disabled = true; applyButton.textContent = 'Checking…';
    try {
      await window.KitVLTBasket.setPromo(code);
      const promo = window.KitVLTBasket.getPromo();
      message.textContent = promo ? `${promo.code} applied — ${promo.label}. First orders only.` : 'Discount removed.';
      message.className = 'promo-msg ok'; paint();
    } catch (error) { message.textContent = error.message; message.className = 'promo-msg err'; }
    finally { applyButton.disabled = false; applyButton.textContent = 'Apply'; }
  }
  applyButton.addEventListener('click', () => {
    const code = input.value.trim();
    if (!code) { message.textContent = 'Enter a code first.'; message.className = 'promo-msg err'; return; }
    apply(code);
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); applyButton.click(); } });
  document.getElementById('promo-remove')?.addEventListener('click', () => apply(''));
  window.KitVLTPromo = { refresh: paint };
  document.addEventListener('kitvlt:basket', paint); window.KitVLTBasket.ready.then(paint);
})();
