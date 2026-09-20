document.addEventListener('DOMContentLoaded', async () => {
  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;
  const emptyEl = document.getElementById('cart-empty');
  const subEl = document.getElementById('cart-subtotal');
  const payBtn = document.getElementById('checkout-pay-btn');
  const errEl = document.getElementById('checkout-error');
  const emailEl = document.getElementById('checkout-email');

  async function render() {
    await window.KitVLTRenderBasket(itemsEl, subEl, emptyEl, (sub, cart) => {
      if (payBtn) payBtn.disabled = cart.length === 0;
    });
  }

  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      const cart = window.KitVLTBasket.getRaw();
      if (!cart.length) return;
      errEl.textContent = '';
      payBtn.disabled = true;
      payBtn.textContent = 'Redirecting to secure payment…';
      const promo = window.KitVLTBasket.getPromo();
      try {
        const res = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity })),
            customerEmail: emailEl && emailEl.value ? emailEl.value : undefined,
            promoCodeId: promo ? promo.id : undefined
          })
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'failed');
        window.location.href = data.url;
      } catch (err) {
        errEl.textContent = "Couldn't start checkout — please try again in a moment.";
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Securely with Stripe';
      }
    });
  }

  render();
});
