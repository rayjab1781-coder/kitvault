document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('newsletter-overlay');
  const dialog = overlay ? window.KitVLTDialog(overlay, document.getElementById('newsletter-close')) : null;
  const remember = () => { document.cookie = 'kitvlt_newsletter_seen=1; Path=/; SameSite=Lax; Max-Age=2592000'; };
  overlay?.addEventListener('kitvlt:close', remember);
  document.querySelectorAll('[data-open-newsletter]').forEach((button) => button.addEventListener('click', () => dialog?.open()));
  if (dialog && !document.cookie.includes('kitvlt_newsletter_seen=') && !new URLSearchParams(location.search).has('collection')) {
    setTimeout(() => {
      if (!document.querySelector('.cart-overlay.visible, .chat-panel.open') && document.visibilityState === 'visible') { remember(); dialog.open(); }
    }, 18000);
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
