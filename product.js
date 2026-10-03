document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('product-loading'); const content = document.getElementById('product-content');
  const missing = document.getElementById('product-not-found'); const id = new URLSearchParams(location.search).get('id');
  let products;
  try { products = await window.KitVLTBasket.loadProducts(); } catch (error) { loading.textContent = error.message; return; }
  const product = products.find((entry) => entry.id === id);
  loading.hidden = true;
  if (!product) { missing.hidden = false; return; }
  content.hidden = false; document.title = `${product.name} | KitVLT`;
  document.querySelector('meta[name="description"]').content = product.description;
  const fields = { 'product-name': product.name, 'product-price': `£${product.price.toFixed(2)}`, 'product-description': product.description, 'product-sizing': product.sizingNote, 'product-shipping': product.shippingNote, 'product-returns': product.returnsNote, 'product-breadcrumb-name': product.name };
  for (const [identifier, text] of Object.entries(fields)) { const element = document.getElementById(identifier); if (element) element.textContent = text; }
  const availability = document.getElementById('product-stock');
  availability.textContent = product.stock === 'in-stock' ? 'Available to order' : product.stock === 'coming-soon' ? 'Coming soon · not available to order' : 'Sold out';
  availability.className = 'product-stock ' + product.stock;
  const hero = document.getElementById('product-main-img'); const thumbnails = document.getElementById('product-thumbs');
  const setImage = (source) => {
    hero.src = source; hero.alt = product.name;
    hero.onerror = () => { hero.hidden = true; document.getElementById('image-error').hidden = false; };
    thumbnails?.querySelectorAll('button').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.src === source)); });
  };
  setImage(product.images[0]);
  if (thumbnails && product.images.length > 1) {
    thumbnails.classList.add('visible');
    for (const [index, source] of product.images.entries()) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.src = source;
      button.setAttribute('aria-label', `${product.name}, image ${index + 1}`); button.setAttribute('aria-pressed', String(index === 0));
      const image = document.createElement('img'); image.src = source; image.alt = ''; image.loading = 'lazy'; button.appendChild(image);
      button.addEventListener('click', () => setImage(source)); thumbnails.appendChild(button);
    }
  }
  let selectedSize = ''; let quantity = 1;
  const sizes = document.getElementById('product-sizes'); const error = document.getElementById('product-buy-error');
  for (const size of product.sizes) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'size-button'; button.textContent = size;
    button.setAttribute('aria-pressed', 'false'); button.disabled = product.stock !== 'in-stock';
    button.addEventListener('click', () => {
      selectedSize = size; error.textContent = '';
      sizes.querySelectorAll('button').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
    });
    sizes.appendChild(button);
  }
  const quantityValue = document.getElementById('product-qty-value');
  const decrease = document.getElementById('product-qty-down'); const increase = document.getElementById('product-qty-up');
  const updateQuantity = (value) => { quantity = Math.min(10, Math.max(1, value)); quantityValue.textContent = quantity; decrease.disabled = quantity === 1; increase.disabled = quantity === 10; };
  decrease.addEventListener('click', () => updateQuantity(quantity - 1)); increase.addEventListener('click', () => updateQuantity(quantity + 1)); updateQuantity(1);
  const add = document.getElementById('product-add'); const buy = document.getElementById('product-buy');
  if (product.stock !== 'in-stock') {
    [add, buy, decrease, increase].forEach((button) => { button.disabled = true; });
    add.textContent = product.stock === 'coming-soon' ? 'Coming soon' : 'Out of stock'; buy.hidden = true;
  } else {
    async function addToBasket(checkout) {
      error.textContent = '';
      if (!selectedSize) { error.textContent = 'Please select a size.'; sizes.querySelector('button').focus(); return; }
      add.disabled = true; buy.disabled = true;
      const label = add.textContent; add.textContent = 'Adding…';
      try {
        await window.KitVLTBasket.add(product.id, selectedSize, quantity);
        window.KitVLTToast(`${product.name} — ${selectedSize} × ${quantity} added to your basket`);
        if (checkout) window.location.href = 'checkout.html';
      } catch (issue) { error.textContent = issue.message; }
      finally { add.disabled = false; buy.disabled = false; add.textContent = label; }
    }
    add.addEventListener('click', () => addToBasket(false)); buy.addEventListener('click', () => addToBasket(true));
  }
  const related = document.getElementById('related-products');
  if (related) {
    const escape = window.KitVLTEscape;
    const choices = products.filter((entry) => entry.id !== product.id && entry.era === product.era).sort((first, second) => Number(second.stock === 'in-stock') - Number(first.stock === 'in-stock')).slice(0, 3);
    related.innerHTML = choices.map((entry) => `<article class="card"><a class="card-image-link" href="product.html?id=${encodeURIComponent(entry.id)}" target="_blank" rel="noopener" aria-label="${escape(entry.name)} — opens in a new tab"><div class="card-image"><img src="${escape(entry.images[0])}" alt="${escape(entry.name)}" loading="lazy" width="480" height="600"></div></a><div class="card-body"><a href="product.html?id=${encodeURIComponent(entry.id)}" target="_blank" rel="noopener"><h3>${escape(entry.name)}</h3></a><p class="price">£${entry.price.toFixed(2)}</p></div></article>`).join('');
  }
});
