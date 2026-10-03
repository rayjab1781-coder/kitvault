document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('newsletter-overlay');
  const dialog = overlay ? window.KitVLTDialog(overlay, document.getElementById('newsletter-close')) : null;
  const hasSeenOffer = () => document.cookie.split(';').some((cookie) => cookie.trim().startsWith('kitvlt_newsletter_seen='));
  const remember = () => { document.cookie = `kitvlt_newsletter_seen=1; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`; };
  overlay?.addEventListener('kitvlt:close', remember);
  document.querySelectorAll('[data-open-newsletter]').forEach((button) => button.addEventListener('click', () => dialog?.open()));
  document.querySelectorAll('[data-dismiss-newsletter]').forEach((button) => button.addEventListener('click', () => dialog?.close()));
  if (dialog && !hasSeenOffer()) {
    const showWelcome = () => {
      if (hasSeenOffer()) return;
      const busy = document.querySelector('.cart-overlay.visible, .chat-panel.open, #site-nav.open') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
      if (busy || document.visibilityState !== 'visible') {
        setTimeout(showWelcome, 3000);
        return;
      }
      remember();
      dialog.open();
    };
    setTimeout(showWelcome, 8000);
  }
  document.querySelectorAll('[data-newsletter-form]').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); const status = form.querySelector('[role="status"]');
    button.disabled = true; status.textContent = 'Saving your signup…';
    try {
      const response = await fetch('/.netlify/functions/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.elements.email.value, consent: form.elements.consent.checked, website: form.elements.website.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your signup could not be saved. Please try again.');
      status.textContent = result.message + ' Your signup is saved. Automated emails are not connected yet.';
      form.querySelector('[data-newsletter-code]').hidden = false;
      remember(); form.reset();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }));
  document.querySelectorAll('[data-copy-discount]').forEach((button) => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('KITVLT10'); window.KitVLTToast('KITVLT10 copied. Apply it in your basket.'); }
    catch { window.KitVLTToast('Your code is KITVLT10. Enter it in your basket.'); }
  }));
});
