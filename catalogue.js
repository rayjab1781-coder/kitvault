// Renders the shop grid from data/products.json.
// Adding a shirt later = one entry in that file. Nothing here changes.
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('card-grid');
  if (!grid) return;

  const noResults = document.getElementById('no-results');
  const search = document.getElementById('shirt-search');
  const sort = document.getElementById('sort-select');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const products = await window.KitVLTBasket.loadProducts();
  let activeFilter = 'all';

  const FALLBACK = "this.onerror=null;this.classList.add('img-missing');this.src=\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23ffffff' d='M22 6 L12 12 L6 22 L14 28 L14 58 L50 58 L50 28 L58 22 L52 12 L42 6 C42 12 38 15 32 15 C26 15 22 12 22 6 Z'/%3E%3C/svg%3E\"";

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
      '<a class="card-image-link" href="' + href + '">' +
        '<div class="card-image">' +
          '<span class="tag ' + t.cls + '">' + t.label + '</span>' + ribbon +
          '<img src="' + p.images[0] + '" alt="' + p.name + '" loading="lazy" onerror="' + FALLBACK + '">' +
        '</div></a>' +
      '<div class="card-body">' +
        '<a class="card-title-link" href="' + href + '"><h3>' + p.name + '</h3></a>' +
        '<p class="price">£' + p.price.toFixed(2) + '</p>' +
        '<a class="btn btn-card" href="' + href + '">' + label + '</a>' +
      '</div></article>';
  }

  function render() {
    const q = search ? search.value.trim().toLowerCase() : '';
    let list = products.filter((p) => matches(p, activeFilter));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

    if (sort) {
      const m = sort.value;
      if (m === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
      else if (m === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
      else if (m === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      else list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    grid.innerHTML = list.map(cardHtml).join('');
    if (noResults) noResults.classList.toggle('visible', list.length === 0);

    if ('IntersectionObserver' in window) {
      const cards = grid.querySelectorAll('.card');
      cards.forEach((c, i) => { c.classList.add('reveal'); c.style.transitionDelay = (Math.min(i % 6, 5) * 0.06) + 's'; });
      const obs = new IntersectionObserver((entries, o) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); o.unobserve(e.target); } });
      }, { threshold: 0.12 });
      cards.forEach((c) => obs.observe(c));
    }
  }

  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    filterBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
    activeFilter = btn.getAttribute('data-filter');
    render();
  }));

  if (search) search.addEventListener('input', render);
  if (sort) sort.addEventListener('change', render);
  render();
});
