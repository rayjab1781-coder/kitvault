document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('chat-fab'); const panel = document.getElementById('chat-panel');
  if (!button || !panel) return;
  const log = document.getElementById('chat-log'); const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input'); const send = form.querySelector('button[type="submit"]');
  const mode = document.getElementById('chat-mode'); let initialized = false; let sending = false;
  panel.inert = true; panel.setAttribute('aria-hidden', 'true');
  function bubble(role, text, productIds = []) {
    const element = document.createElement('div'); element.className = 'chat-msg chat-' + (role === 'user' ? 'user' : 'bot');
    const copy = document.createElement('span'); copy.textContent = text; element.appendChild(copy);
    if (productIds.length) window.KitVLTBasket.loadProducts().then((products) => {
      const links = document.createElement('div'); links.className = 'chat-product-links';
      for (const id of productIds) {
        const product = products.find((entry) => entry.id === id); if (!product) continue;
        const link = document.createElement('a'); link.href = 'product.html?id=' + encodeURIComponent(product.id);
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = product.name + ' ↗';
        link.setAttribute('aria-label', product.name + ' — opens in a new tab'); links.appendChild(link);
      }
      element.appendChild(links); log.scrollTop = log.scrollHeight;
    }).catch(() => {});
    log.appendChild(element); log.scrollTop = log.scrollHeight; return element;
  }
  async function initialize() {
    if (initialized) return;
    initialized = true;
    try {
      await window.KitVLTBasket.ready;
      const response = await fetch('/.netlify/functions/chat'); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.history.length) data.history.forEach((message) => bubble(message.role, message.content, message.productIds));
      else bubble('assistant', 'Your next shirt is in the vault. Ask me about a club, a player, retro shirts or the 10% offer. Please don’t share payment details here.');
    } catch { initialized = false; bubble('assistant', 'Chat is temporarily unavailable. You can still browse shirts or contact KitVaultCustomerService@gmail.com.'); }
  }
  function toggle(open) {
    panel.classList.toggle('open', open); panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    if (open) { initialize(); input.focus(); } else button.focus();
  }
  button.addEventListener('click', () => toggle(!panel.classList.contains('open')));
  document.getElementById('chat-close').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('open')) toggle(false); });
  document.getElementById('chat-suggestions')?.querySelectorAll('button').forEach((suggestion) => suggestion.addEventListener('click', () => { input.value = suggestion.textContent; form.requestSubmit(); }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const message = input.value.trim();
    if (!message || sending) return;
    sending = true; send.disabled = true; input.value = ''; bubble('user', message);
    const waiting = bubble('assistant', 'Finding your answer…');
    try {
      await window.KitVLTBasket.ready;
      const response = await fetch('/.netlify/functions/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Chat is temporarily unavailable.');
      waiting.remove(); bubble('assistant', result.reply, result.productIds);
      if (mode) mode.textContent = result.mode === 'ai' ? 'AI-assisted · grounded in the vault' : 'Catalogue help · AI unavailable';
    } catch (error) { waiting.textContent = error.message + ' Try again, or email KitVaultCustomerService@gmail.com.'; }
    finally { sending = false; send.disabled = false; input.focus(); }
  });
});
