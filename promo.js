// Real promo codes. Applying a code calls validate-promo, which asks Stripe
// for the ACTUAL discount — nothing is calculated locally or faked, so the
// total shown is the total Stripe will charge.
(function () {
  const tab = document.getElementById('promo-tab');
  if (!tab) return;
  const panel = document.getElementById('promo-panel');
  const input = document.getElementById('promo-input');
  const applyBtn = document.getElementById('promo-apply');
  const msg = document.getElementById('promo-msg');
  const dRow = document.getElementById('cart-discount-row');
  const dLabel = document.getElementById('cart-discount-label');
  const dEl = document.getElementById('cart-discount');
  const totalEl = document.getElementById('cart-total');

  tab.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    tab.setAttribute('aria-expanded', String(open));
    if (open && input) {
      const saved = window.KitVLTBasket.getPromo();
      if (saved) input.value = saved.code;
      input.focus();
    }
  });

  function paint(subtotal, r) {
    if (r && r.valid) {
      if (dRow) dRow.hidden = false;
      if (dLabel) dLabel.textContent = 'Discount (' + r.code + ')';
      if (dEl) dEl.textContent = '-£' + r.discount.toFixed(2);
      if (totalEl) totalEl.textContent = '£' + r.total.toFixed(2);
    } else {
      if (dRow) dRow.hidden = true;
      if (totalEl) totalEl.textContent = '£' + subtotal.toFixed(2);
    }
  }

  async function apply() {
    const code = (input.value || '').trim();
    if (!code) { msg.textContent = 'Enter a code first.'; msg.className = 'promo-msg err'; return; }

    const subtotal = await window.KitVLTBasket.subtotal();
    if (subtotal === 0) { msg.textContent = 'Add something to your basket first.'; msg.className = 'promo-msg err'; return; }

    applyBtn.disabled = true; applyBtn.textContent = 'Checking…';
    try {
      const res = await fetch('/.netlify/functions/validate-promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        window.KitVLTBasket.setPromo(null);
        msg.textContent = (data && data.message) || "That code isn't valid.";
        msg.className = 'promo-msg err';
        paint(subtotal, null);
        return;
      }
      window.KitVLTBasket.setPromo({ id: data.id, code: data.code, label: data.label });
      msg.textContent = data.code + ' applied — ' + data.label + '.';
      msg.className = 'promo-msg ok';
      paint(subtotal, data);
    } catch (err) {
      msg.textContent = 'Could not check that code right now — try again.';
      msg.className = 'promo-msg err';
    } finally {
      applyBtn.disabled = false; applyBtn.textContent = 'Apply';
    }
  }

  if (applyBtn) applyBtn.addEventListener('click', apply);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });

  // Re-validates any stored code whenever the basket changes.
  window.KitVLTPromo = {
    async refresh(subtotal) {
      const saved = window.KitVLTBasket.getPromo();
      if (!saved) { paint(subtotal, null); return; }
      try {
        const res = await fetch('/.netlify/functions/validate-promo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: saved.code, subtotal })
        });
        const data = await res.json();
        if (res.ok && data.valid) paint(subtotal, data);
        else { window.KitVLTBasket.setPromo(null); paint(subtotal, null); }
      } catch (e) { paint(subtotal, null); }
    }
  };
})();
