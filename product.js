document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  const products = await window.KitVLTBasket.loadProducts();
  const p = products.find((x) => x.id === id);

  const layout = document.getElementById('product-layout');
  const notFound = document.getElementById('product-not-found');
  if (!p) { if (layout) layout.hidden = true; if (notFound) notFound.hidden = false; return; }

  document.title = p.name + ' | KitVLT';

  const tag = p.featured ? { label: 'Featured', cls: 'tag-trending' }
    : (p.era === 'retro' ? { label: 'Retro', cls: 'tag-retro' } : { label: 'New Season', cls: 'tag-current' });
  const tagEl = document.getElementById('product-tag');
  if (tagEl) { tagEl.textContent = tag.label; tagEl.className = 'tag ' + tag.cls; }

  document.getElementById('product-title').textContent = p.name;
  document.getElementById('product-price').textContent = '£' + p.price.toFixed(2);
  document.getElementById('product-description').textContent = p.description;
  document.getElementById('product-sizing').textContent = p.sizingNote;
  document.getElementById('product-shipping').textContent = p.shippingNote;
  document.getElementById('product-returns').textContent = p.returnsNote;

  // Gallery
  const mainImg = document.getElementById('product-main-img');
  const thumbs = document.getElementById('product-thumbs');
  const gallery = p.images && p.images.length ? p.images : [];

  function setImage(src) {
    mainImg.src = src;
    mainImg.alt = p.name;
    mainImg.onerror = () => {
      mainImg.onerror = null;
      mainImg.classList.add('img-missing');
      mainImg.src = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23ffffff' d='M22 6 L12 12 L6 22 L14 28 L14 58 L50 58 L50 28 L58 22 L52 12 L42 6 C42 12 38 15 32 15 C26 15 22 12 22 6 Z'/%3E%3C/svg%3E";
    };
    if (thumbs) thumbs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-src') === src));
  }
  if (gallery.length) setImage(gallery[0]);

  if (thumbs && gallery.length > 1) {
    thumbs.innerHTML = '';
    gallery.forEach((src) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-src', src);
      b.setAttribute('aria-label', 'Show ' + p.name + ' photo');
      b.innerHTML = '<img src="' + src + '" alt="" onerror="this.parentElement.style.display=\'none\'">';
      b.addEventListener('click', () => setImage(src));
      thumbs.appendChild(b);
    });
    thumbs.classList.add('visible');
  }

  // Sizes
  const sizeSel = document.getElementById('product-size');
  sizeSel.innerHTML = p.sizes.map((s) => '<option value="' + s + '"' + (s === 'M' ? ' selected' : '') + '>' + s + '</option>').join('');

  // Quantity
  let qty = 1;
  const qtyVal = document.getElementById('product-qty-value');
  document.getElementById('product-qty-down').addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyVal.textContent = qty; });
  document.getElementById('product-qty-up').addEventListener('click', () => { qty = Math.min(10, qty + 1); qtyVal.textContent = qty; });

  const addBtn = document.getElementById('product-add');
  const buyBtn = document.getElementById('product-buy');
  const errEl = document.getElementById('product-buy-error');

  if (p.stock !== 'in-stock') {
    const label = p.stock === 'coming-soon' ? 'Coming Soon' : 'Out of Stock';
    [addBtn, buyBtn].forEach((b) => { b.disabled = true; b.textContent = label; });
    sizeSel.disabled = true;
    document.getElementById('product-qty-down').disabled = true;
    document.getElementById('product-qty-up').disabled = true;
  } else {
    addBtn.addEventListener('click', async () => {
      await window.KitVLTBasket.add(p.id, sizeSel.value, qty);
      window.KitVLTToast(p.name + ' (Size ' + sizeSel.value + ' × ' + qty + ') added to your basket');
    });

    buyBtn.addEventListener('click', async () => {
      errEl.textContent = '';
      buyBtn.disabled = true;
      const orig = buyBtn.textContent;
      buyBtn.textContent = 'Redirecting…';
      try {
        const res = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ productId: p.id, size: sizeSel.value, quantity: qty }] })
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'failed');
        window.location.href = data.url;
      } catch (err) {
        errEl.textContent = "Couldn't start checkout — please try again.";
        buyBtn.disabled = false;
        buyBtn.textContent = orig;
      }
    });
  }
});
