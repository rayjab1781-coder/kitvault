(() => {
  const key = 'kitvlt_welcome_seen';
  const cookieSeen = () => document.cookie.split(';').some((cookie) => cookie.trim().startsWith(key + '='));
  let seen = cookieSeen() || document.cookie.split(';').some((cookie) => cookie.trim().startsWith('kitvlt_newsletter_seen='));
  try { seen = seen || Boolean(localStorage.getItem(key) || localStorage.getItem('kitvlt-cart')); } catch { }
  const remember = () => {
    let stored = false;
    try { localStorage.setItem(key, '1'); stored = localStorage.getItem(key) === '1'; } catch { }
    document.cookie = `${key}=1; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`;
    return stored || cookieSeen();
  };
  const firstVisit = !seen && remember();
  if (seen) remember();
  const offerRequest = fetch('/.netlify/functions/welcome-offer').catch(() => null);
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await offerRequest;
      if (!response?.ok) return;
      const offer = await response.json();
      if (!offer.available || offer.code !== 'KITVLT10' || offer.percent !== 10 || !offer.firstOrderOnly) return;
      const copy = async (button) => {
        remember();
        try { await navigator.clipboard.writeText(offer.code); button.textContent = 'Code copied'; }
        catch { button.textContent = 'Enter KITVLT10 in your basket'; }
      };
      document.querySelectorAll('.footer-legal-links').forEach((links) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button welcome-reminder'; button.textContent = 'First order: KITVLT10 · 10% off'; button.addEventListener('click', () => copy(button)); links.append(button);
      });
      document.querySelectorAll('.promo-box, .checkout-promo-box').forEach((box) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button welcome-reminder'; button.textContent = 'First order? Copy KITVLT10 for 10% off shirts'; button.addEventListener('click', () => copy(button)); box.append(button);
      });
      if (!firstVisit || offer.returningVisitor || !window.KitVLTDialog) return;
      const overlay = document.createElement('div'); overlay.className = 'welcome-overlay';
      overlay.innerHTML = '<section class="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-heading" aria-describedby="welcome-description"><button class="modal-close" type="button" aria-label="Close first-order offer">×</button><div class="welcome-visual" aria-hidden="true"><span>KitVLT / Beyond the final whistle.</span></div><span class="eyebrow">Welcome to the vault</span><h2 id="welcome-heading">Welcome to KitVLT.</h2><p id="welcome-description">Get 10% off your first order.<br>Use code <strong>KITVLT10</strong>.</p><div class="welcome-code"><span>Your first-order code</span><strong>KITVLT10</strong></div><button class="btn btn-primary" type="button" data-copy-welcome>Copy code</button><p class="welcome-terms">First orders only. Shirt subtotal only; excludes delivery. One code per order. Apply in your basket or at checkout.</p><button class="welcome-dismiss text-button" type="button">No thanks, keep browsing</button></section>';
      document.body.append(overlay);
      const dialog = window.KitVLTDialog(overlay, overlay.querySelector('.modal-close'));
      overlay.querySelector('.welcome-dismiss').addEventListener('click', dialog.close);
      overlay.querySelector('[data-copy-welcome]').addEventListener('click', (event) => copy(event.currentTarget));
      const show = () => {
        try { if (localStorage.getItem(key) !== '1' && !cookieSeen()) return; } catch { if (!cookieSeen()) return; }
        const busy = document.querySelector('.cart-overlay.visible, .chat-panel.open, #site-nav.open') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
        if (busy || document.visibilityState !== 'visible') { setTimeout(show, 3000); return; }
        dialog.open();
      };
      setTimeout(show, 8000);
    } catch { }
  });
})();
