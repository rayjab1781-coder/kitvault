let cataloguePromise;
let basketState = { items: [], subtotal: 0, discount: 0, total: 0, promo: null };
function loadProducts() {
  if (!cataloguePromise) cataloguePromise = fetch('/data/products.json').then(async (response) => {
    if (!response.ok) throw new Error('The catalogue could not load. Please try again.');
    return response.json();
  }).catch((error) => { cataloguePromise = null; throw error; });
  return cataloguePromise;
}
window.KitVLTEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
window.KitVLTMoney = (pence) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
window.KitVLTImage = (source, width) => '/.netlify/images?url=' + encodeURIComponent('/' + source) + '&w=' + width + '&q=85';
window.KitVLTToast = (message) => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(window.KitVLTToast.timer);
  window.KitVLTToast.timer = setTimeout(() => toast.classList.remove('visible'), 4500);
};
const basketChannel = 'BroadcastChannel' in window ? new BroadcastChannel('kitvlt-basket') : null;
function publishBasket(state, broadcast = false) {
  basketState = state;
  const badge = document.getElementById('cart-count');
  if (badge) badge.textContent = String(state.items.reduce((total, item) => total + item.quantity, 0));
  document.dispatchEvent(new CustomEvent('kitvlt:basket', { detail: state }));
  if (broadcast && basketChannel) basketChannel.postMessage('changed');
  return state.items;
}
async function basketRequest(payload) {
  const response = await fetch('/.netlify/functions/cart', payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Your basket could not update. Please try again.');
  return data;
}
const basketReady = basketRequest().then(async (state) => {
  let previous;
  try { previous = JSON.parse(localStorage.getItem('kitvlt-cart') || 'null'); } catch { }
  if (Array.isArray(previous) && previous.length && !state.items.length) state = await basketRequest({ action: 'import', items: previous });
  try { localStorage.removeItem('kitvlt-cart'); localStorage.removeItem('kitvlt-promo'); } catch { }
  return publishBasket(state);
}).catch((error) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.KitVLTToast(error.message), { once: true });
  else window.KitVLTToast(error.message);
  return [];
});
async function changeBasket(payload) {
  await basketReady;
  return publishBasket(await basketRequest(payload), true);
}
window.KitVLTBasket = {
  ready: basketReady, loadProducts,
  async refresh() { await basketReady; return publishBasket(await basketRequest()); },
  add: (productId, size, quantity) => changeBasket({ action: 'add', productId, size, quantity }),
  setQuantity: (productId, size, quantity) => changeBasket({ action: quantity <= 0 ? 'remove' : 'quantity', productId, size, quantity }),
  remove: (productId, size) => changeBasket({ action: 'remove', productId, size }),
  getRaw: () => basketState.items,
  getPromo: () => basketState.promo,
  setPromo: (code) => changeBasket({ action: 'promo', code: typeof code === 'string' ? code : code?.code || '' }),
  getSummary: () => basketState,
  async subtotal() { await basketReady; return basketState.subtotal; },
};
if (basketChannel) basketChannel.onmessage = () => window.KitVLTBasket.refresh().catch((error) => window.KitVLTToast(error.message));
window.addEventListener('focus', () => window.KitVLTBasket.refresh().catch(() => {}));
window.KitVLTRenderBasket = async (itemsElement, subtotalElement, emptyElement, onChange) => {
  if (!itemsElement) return;
  await basketReady;
  const products = await loadProducts();
  const summary = basketState;
  const escape = window.KitVLTEscape;
  itemsElement.replaceChildren();
  if (emptyElement) emptyElement.classList.toggle('visible', summary.items.length === 0);
  for (const item of summary.items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) continue;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `<a class="cart-item-img" href="product.html?id=${encodeURIComponent(product.id)}" target="_blank" rel="noopener" aria-label="View ${escape(product.name)} in a new tab"><img src="${escape(product.images[0])}" alt="${escape(product.name)}" width="88" height="110"></a><div class="cart-item-info"><h4>${escape(product.name)}</h4><div class="cart-item-meta">Size ${escape(item.size)} · £${product.price.toFixed(2)} each</div><div class="qty-stepper"><button type="button" class="qty-btn qty-down" aria-label="Decrease ${escape(product.name)} size ${escape(item.size)} quantity">−</button><span class="qty-value">${item.quantity}</span><button type="button" class="qty-btn qty-up" aria-label="Increase ${escape(product.name)} size ${escape(item.size)} quantity" ${item.quantity >= 10 ? 'disabled' : ''}>+</button></div></div><span class="cart-line-total">${window.KitVLTMoney(Math.round(product.price * 100) * item.quantity)}</span><button class="cart-item-remove" type="button" aria-label="Remove ${escape(product.name)} size ${escape(item.size)}">×</button>`;
    if (product.stock !== 'in-stock') {
      const note = document.createElement('p'); note.className = 'form-error'; note.textContent = 'No longer available. Remove this shirt to continue.';
      row.querySelector('.cart-item-info').appendChild(note); row.querySelector('.qty-up').disabled = true;
    }
    async function update(action) {
      row.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try { await action(); }
      catch (error) { window.KitVLTToast(error.message); window.KitVLTRenderBasket(itemsElement, subtotalElement, emptyElement, onChange); }
    }
    row.querySelector('.qty-down').addEventListener('click', () => update(() => window.KitVLTBasket.setQuantity(product.id, item.size, item.quantity - 1)));
    row.querySelector('.qty-up').addEventListener('click', () => update(() => window.KitVLTBasket.setQuantity(product.id, item.size, item.quantity + 1)));
    row.querySelector('.cart-item-remove').addEventListener('click', () => update(() => window.KitVLTBasket.remove(product.id, item.size)));
    itemsElement.appendChild(row);
  }
  if (subtotalElement) subtotalElement.textContent = window.KitVLTMoney(Math.round(summary.subtotal * 100));
  if (window.KitVLTPromo) window.KitVLTPromo.refresh();
  if (onChange) onChange(summary.subtotal, summary.items);
  return summary.subtotal;
};
window.KitVLTDialog = (element, closeButton) => {
  let previousFocus;
  let active = false;
  element.inert = true; element.setAttribute('aria-hidden', 'true');
  const close = () => {
    active = false; element.classList.remove('visible'); element.inert = true; element.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.querySelectorAll('body > header, body > main, body > footer').forEach((region) => { region.inert = false; });
    if (previousFocus?.isConnected) previousFocus.focus();
    element.dispatchEvent(new Event('kitvlt:close'));
  };
  const open = () => {
    previousFocus = document.activeElement; active = true; element.inert = false; element.setAttribute('aria-hidden', 'false'); element.classList.add('visible');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('body > header, body > main, body > footer').forEach((region) => { region.inert = true; });
    closeButton.focus();
  };
  closeButton.addEventListener('click', close);
  element.addEventListener('click', (event) => { if (event.target === element) close(); });
  document.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const focusable = [...element.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)')].filter((node) => node.getClientRects().length);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  return { open, close };
};
document.addEventListener('DOMContentLoaded', () => {
  const navigation = document.getElementById('site-nav'); const menu = document.getElementById('menu-toggle');
  if (menu && navigation) {
    const closeMenu = () => { navigation.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('click', () => { menu.setAttribute('aria-expanded', String(navigation.classList.toggle('open'))); });
    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
  }
  document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' })));
  const overlay = document.getElementById('cart-overlay'); const cartButton = document.getElementById('cart-button');
  if (overlay) {
    const dialog = window.KitVLTDialog(overlay, document.getElementById('cart-close'));
    const render = () => window.KitVLTRenderBasket(document.getElementById('cart-items'), document.getElementById('cart-subtotal'), document.getElementById('cart-empty'), (subtotal, items) => overlay.classList.toggle('is-empty', items.length === 0)).catch((error) => window.KitVLTToast(error.message));
    cartButton?.addEventListener('click', async () => {
      dialog.open();
      try { await window.KitVLTBasket.refresh(); await render(); } catch (error) { window.KitVLTToast(error.message); }
    });
    overlay.querySelector('[data-continue-shopping]')?.addEventListener('click', dialog.close);
    document.addEventListener('kitvlt:basket', render);
  } else cartButton?.addEventListener('click', () => { window.location.href = 'checkout.html'; });
});
