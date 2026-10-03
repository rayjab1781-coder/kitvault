import products from '../../data/products.json';

export default async (request: Request) => {
  const origin = process.env.URL || new URL(request.url).origin;
  const pages = ['/', '/size-guide.html', '/shipping-returns.html', '/faq.html', '/terms.html', '/privacy.html', ...products.map((product) => `/product.html?id=${encodeURIComponent(product.id)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${(origin + page).replaceAll('&', '&amp;')}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
};
