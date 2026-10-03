// Renders the shop grid from data/products.json.
// Adding a shirt later = one entry in that file. Nothing here changes.
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('card-grid');
  if (!grid) return;

  const noResults = document.getElementById('no-results');
  const search = document.getElementById('shirt-search');
  const sort = document.getElementById('sort-select');
  const filterBtns = document.querySelectorAll('.filter-btn');
  let products;
  try { products = await window.KitVLTBasket.loadProducts(); }
  catch (error) {
    grid.replaceChildren();
    const message = document.createElement('p');
    message.textContent = error.message;
    const retry = document.createElement('button');
    retry.className = 'btn btn-card';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => location.reload());
    grid.append(message, retry);
    return;
  }
  const initial = new URLSearchParams(location.search).get('collection');
  let activeFilter = ['retro', 'new-season', 'featured', 'club', 'international'].includes(initial) ? initial : 'all';
  const sizeFilter = document.getElementById('size-filter');
  const stockFilter = document.getElementById('stock-filter');
  const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function matches(p, f) {
    if (f === 'all') return true;
    if (f === 'featured') return p.featured;
    return p.type === f || p.era === f;
  }

  function tagFor(p) {
    if (p.featured) return { label: 'Featured', cls: 'tag-trending' };
    if (p.era === 'retro') return { label: 'Retro', cls: 'tag-retro' };
    return { label: 'New Season', cls: 'tag-current' };
  }

  function cardHtml(p) {
    const t = tagFor(p);
    const stockCls = p.stock === 'in-stock' ? '' : (p.stock === 'coming-soon' ? 'coming-soon' : 'sold-out');
    const ribbon = p.stock === 'coming-soon'
      ? '<span class="stock-ribbon stock-ribbon-soon">Coming Soon</span>'
      : (p.stock === 'sold-out' ? '<span class="stock-ribbon">Sold Out</span>' : '');
    const label = p.stock === 'in-stock' ? 'View shirt' : (p.stock === 'coming-soon' ? 'Coming soon' : 'Sold out');
    const href = 'product.html?id=' + encodeURIComponent(p.id);

    return '<article class="card ' + stockCls + '">' +
      '<a class="card-image-link" href="' + href + '" target="_blank" rel="noopener" aria-label="' + p.name + ' — opens in a new tab">' +
        '<div class="card-image">' +
          '<span class="tag ' + t.cls + '">' + t.label + '</span>' + ribbon +
          '<img src="' + window.KitVLTImage(p.images[0], 640) + '" srcset="' + window.KitVLTImage(p.images[0], 320) + ' 320w, ' + window.KitVLTImage(p.images[0], 640) + ' 640w" sizes="(max-width: 780px) 45vw, (max-width: 960px) 30vw, 24vw" alt="' + p.name + '" loading="lazy" decoding="async" width="480" height="600">' +
        '</div></a>' +
      '<div class="card-body">' +
        '<a class="card-title-link" href="' + href + '" target="_blank" rel="noopener"><h3>' + p.name + '</h3></a>' +
        '<p class="price">£' + p.price.toFixed(2) + '</p>' +
        '<a class="btn btn-card" href="' + href + '" target="_blank" rel="noopener">' + label + '<span class="sr-only"> — opens in a new tab</span></a>' +
      '</div></article>';
  }

  function render() {
    const q = search ? normalize(search.value.trim()) : '';
    let list = products.filter((p) => matches(p, activeFilter));
    if (q) list = list.filter((p) => q.split(/\s+/).every((term) => normalize([p.name, p.id, p.description, p.type, p.era, p.era === 'new-season' ? 'current' : 'retro'].join(' ')).includes(term)));
    if (sizeFilter?.value) list = list.filter((product) => product.sizes.includes(sizeFilter.value));
    if (stockFilter?.checked) list = list.filter((product) => product.stock === 'in-stock');

    if (sort) {
      const m = sort.value;
      if (m === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
      else if (m === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
      else if (m === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      else list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    grid.innerHTML = list.map(cardHtml).join('');
    if (noResults) noResults.classList.toggle('visible', list.length === 0);
    document.getElementById('results-count').textContent = `${list.length} ${list.length === 1 ? 'shirt' : 'shirts'}${activeFilter !== 'all' ? ' · ' + (activeFilter === 'new-season' ? 'Current' : activeFilter) : ''}`;
    filterBtns.forEach((button) => { button.classList.toggle('active', button.dataset.filter === activeFilter); button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)); });
  }

  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    filterBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
    activeFilter = btn.getAttribute('data-filter');
    const url = new URL(location.href);
    if (activeFilter === 'all') url.searchParams.delete('collection');
    else url.searchParams.set('collection', activeFilter);
    history.replaceState(null, '', url);
    render();
  }));

  if (search) search.addEventListener('input', render);
  if (sort) sort.addEventListener('change', render);
  sizeFilter?.addEventListener('change', render);
  stockFilter?.addEventListener('change', render);
  document.getElementById('reset-filters')?.addEventListener('click', () => { activeFilter = 'all'; search.value = ''; sizeFilter.value = ''; stockFilter.checked = false; render(); });
  render();
});
