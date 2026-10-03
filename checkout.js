document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('checkout-form'); const pay = document.getElementById('checkout-pay-btn');
  const error = document.getElementById('checkout-error'); const status = document.getElementById('payment-status');
  const country = document.getElementById('checkout-country'); const shipping = document.getElementById('checkout-shipping');
  const total = document.getElementById('cart-total'); let quoting = 0; let submitting = false;
  async function quote() {
    const revision = ++quoting;
    pay.disabled = true;
    if (!window.KitVLTBasket.getRaw().length) { shipping.textContent = '—'; return; }
    try {
      const response = await fetch('/.netlify/functions/checkout-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: country.value, email: form.elements.email.value.trim() }) });
      const summary = await response.json();
      if (revision !== quoting) return;
      if (!response.ok) throw new Error(summary.error || 'Unable to calculate your order.');
      shipping.textContent = summary.shipping === null ? 'Rate not connected' : summary.shipping === 0 ? 'Free' : window.KitVLTMoney(Math.round(summary.shipping * 100));
      total.textContent = summary.finalTotal === null ? window.KitVLTMoney(Math.round(summary.total * 100)) + ' + delivery' : window.KitVLTMoney(Math.round(summary.finalTotal * 100));
      if (!summary.payments) { status.textContent = 'Payments are not connected yet. Your basket is saved, but no payment can be taken. Contact KitVLT for help.'; pay.textContent = 'Payment currently unavailable'; }
      else if (summary.shipping === null) { status.textContent = 'Delivery rates for this destination are not connected yet. Please contact KitVLT before ordering.'; pay.textContent = 'Delivery rate unavailable'; }
      else { status.textContent = 'Your order is ready for secure Stripe payment. No card details are stored by KitVLT.'; pay.textContent = 'Continue to secure payment'; pay.disabled = submitting; }
      error.textContent = '';
    } catch (problem) { if (revision === quoting) { error.textContent = problem.message; status.textContent = 'Please resolve the order message before payment.'; } }
  }
  const render = async () => {
    try {
      await window.KitVLTRenderBasket(document.getElementById('cart-items'), document.getElementById('cart-subtotal'), document.getElementById('cart-empty'));
      const empty = window.KitVLTBasket.getRaw().length === 0;
      document.querySelector('.checkout-page-summary').hidden = empty;
      if (!empty) await quote();
    } catch (problem) { error.textContent = problem.message; }
  };
  country.addEventListener('change', quote); form.elements.email.addEventListener('change', quote);
  document.addEventListener('kitvlt:basket', render);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || submitting || pay.disabled) return;
    submitting = true; pay.disabled = true; pay.textContent = 'Opening secure payment…'; error.textContent = '';
    try {
      const customer = Object.fromEntries(new FormData(form));
      const response = await fetch('/.netlify/functions/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer }) });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Unable to open payment. No payment has been taken.');
      const destination = new URL(result.url);
      if (destination.protocol !== 'https:' || !['checkout.stripe.com', 'buy.stripe.com'].includes(destination.hostname)) throw new Error('The payment destination could not be verified.');
      window.location.href = destination.href;
    } catch (problem) { error.textContent = problem.message; submitting = false; pay.disabled = false; pay.textContent = 'Try secure payment again'; }
  });
  if (new URLSearchParams(location.search).has('cancelled')) window.KitVLTToast('Payment was cancelled. Your basket is still saved.');
  window.KitVLTBasket.ready.then(render);
});
