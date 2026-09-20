// script.js — site chrome + the basket engine.
// Basket stores only {productId, size, quantity}; names/prices/images are
// always looked up fresh from data/products.json, so nothing goes stale.

const CART_KEY = 'kitvlt-cart';
const PROMO_KEY = 'kitvlt-promo';
let PRODUCTS_CACHE = null;

async function loadProducts() {
  if (PRODUCTS_CACHE) return PRODUCTS_CACHE;
  try {
    const res = await fetch('data/products.json');
    PRODUCTS_CACHE = await res.json();
  } catch (err) {
    console.error('Could not load catalogue:', err);
    PRODUCTS_CACHE = [];
  }
  return PRODUCTS_CACHE;
}

function loadCart() {
  try { const r = localStorage.getItem(CART_KEY); return r ? JSON.parse(r) : []; }
  catch (e) { return []; }
}
function saveCart(c) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
}
function loadPromo() {
  try { const r = localStorage.getItem(PROMO_KEY); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}
function savePromo(p) {
  try { p ? localStorage.setItem(PROMO_KEY, JSON.stringify(p)) : localStorage.removeItem(PROMO_KEY); } catch (e) {}
}

function badge() {
  const el = document.getElementById('cart-count');
  if (!el) return;
  el.textContent = String(loadCart().reduce((s, i) => s + i.quantity, 0));
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

window.KitVLTBasket = {
  async add(productId, size, quantity) {
    const cart = loadCart();
    const found = cart.find((i) => i.productId === productId && i.size === size);
    if (found) found.quantity = Math.min(10, found.quantity + quantity);
    else cart.push({ productId, size, quantity: Math.min(10, Math.max(1, quantity)) });
    saveCart(cart); badge(); return cart;
  },
  setQuantity(productId, size, quantity) {
    let cart = loadCart();
    if (quantity <= 0) cart = cart.filter((i) => !(i.productId === productId && i.size === size));
    else { const f = cart.find((i) => i.productId === productId && i.size === size); if (f) f.quantity = Math.min(10, quantity); }
    saveCart(cart); badge(); return cart;
  },
  remove(productId, size) {
    const cart = loadCart().filter((i) => !(i.productId === productId && i.size === size));
    saveCart(cart); badge(); return cart;
  },
  clear() { saveCart([]); savePromo(null); badge(); },
  getRaw: loadCart,
  getPromo: loadPromo,
  setPromo: savePromo,
  loadProducts,
  async subtotal() {
    const products = await loadProducts();
    return loadCart().reduce((s, i) => {
      const p = products.find((x) => x.id === i.productId);
      return s + (p ? p.price * i.quantity : 0);
    }, 0);
  }
};

window.KitVLTToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(window.KitVLTToast._t);
  window.KitVLTToast._t = setTimeout(() => t.classList.remove('visible'), 2600);
};

// Renders basket rows into a container. Shared by the drawer and checkout page.
window.KitVLTRenderBasket = async function (itemsEl, subtotalEl, emptyEl, onChange) {
  const products = await loadProducts();
  const cart = loadCart();
  itemsEl.innerHTML = '';
  if (emptyEl) emptyEl.classList.toggle('visible', cart.length === 0);

  let subtotal = 0;
  cart.forEach((item) => {
    const p = products.find((x) => x.id === item.productId);
    if (!p) return;
    subtotal += p.price * item.quantity;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML =
      '<div class="cart-item-img"><img src="' + p.images[0] + '" alt="' + p.name + '" onerror="this.classList.add(\'img-missing\')"></div>' +
      '<div class="cart-item-info"><h4>' + p.name + '</h4>' +
      '<div class="cart-item-meta">Size ' + item.size + ' &middot; £' + p.price.toFixed(2) + ' each</div>' +
      '<div class="qty-stepper"><button type="button" class="qty-btn qty-down" aria-label="Decrease quantity">&minus;</button>' +
      '<span class="qty-value">' + item.quantity + '</span>' +
      '<button type="button" class="qty-btn qty-up" aria-label="Increase quantity">&plus;</button></div></div>' +
      '<button class="cart-item-remove" type="button" aria-label="Remove ' + p.name + '">&times;</button>';

    row.querySelector('.qty-down').addEventListener('click', () => {
      window.KitVLTBasket.setQuantity(p.id, item.size, item.quantity - 1);
      window.KitVLTRenderBasket(itemsEl, subtotalEl, emptyEl, onChange);
    });
    row.querySelector('.qty-up').addEventListener('click', () => {
      window.KitVLTBasket.setQuantity(p.id, item.size, item.quantity + 1);
      window.KitVLTRenderBasket(itemsEl, subtotalEl, emptyEl, onChange);
    });
    row.querySelector('.cart-item-remove').addEventListener('click', () => {
      window.KitVLTBasket.remove(p.id, item.size);
      window.KitVLTRenderBasket(itemsEl, subtotalEl, emptyEl, onChange);
    });
    itemsEl.appendChild(row);
  });

  if (subtotalEl) subtotalEl.textContent = '£' + subtotal.toFixed(2);
  if (window.KitVLTPromo) window.KitVLTPromo.refresh(subtotal);
  if (onChange) onChange(subtotal, cart);
  return subtotal;
};

document.addEventListener('DOMContentLoaded', () => {
  badge();

  const nav = document.getElementById('site-nav');
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('[data-scroll]').forEach((b) => {
    b.addEventListener('click', () => {
      const t = document.querySelector(b.getAttribute('data-scroll'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Basket drawer
  const overlay = document.getElementById('cart-overlay');
  const cartButton = document.getElementById('cart-button');
  if (overlay) {
    const itemsEl = document.getElementById('cart-items');
    const emptyEl = document.getElementById('cart-empty');
    const subEl = document.getElementById('cart-subtotal');
    const closeBtn = document.getElementById('cart-close');

    const open = async () => {
      await window.KitVLTRenderBasket(itemsEl, subEl, emptyEl, (sub, cart) => {
        overlay.classList.toggle('is-empty', cart.length === 0);
      });
      overlay.classList.add('visible');
    };
    const close = () => overlay.classList.remove('visible');

    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('visible')) close(); });
    if (cartButton) cartButton.addEventListener('click', open);
  } else if (cartButton) {
    cartButton.addEventListener('click', () => { window.location.href = 'index.html#kits'; });
  }
});
