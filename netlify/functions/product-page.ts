import { readFile } from 'node:fs/promises';
import { products } from '../../server/store';

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export default async (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  const product = products.find((entry) => entry.id === id);
  let html = await readFile('product.html', 'utf8');
  if (!product) return new Response(html.replace('<title>Product | KitVLT</title>', '<title>Shirt not found | KitVLT</title>'), { status: 404, headers: { 'Content-Type': 'text/html' } });
  const origin = process.env.URL || new URL(request.url).origin;
  const url = `${origin}/product.html?id=${encodeURIComponent(product.id)}`;
  const image = `${origin}/${product.images[0]}`;
  const description = escape(product.description);
  const metadata = `<meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:title" content="${escape(product.name)} | KitVLT"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:url" content="${url}"><meta property="og:type" content="product"><meta name="twitter:card" content="summary_large_image">`;
  const structured = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description, image: product.images.map((photo) => `${origin}/${photo}`), sku: product.id, brand: { '@type': 'Brand', name: 'KitVLT' }, offers: { '@type': 'Offer', priceCurrency: 'GBP', price: product.price.toFixed(2), url, availability: product.stock === 'in-stock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  html = html.replace(/<title>.*?<\/title>/, `<title>${escape(product.name)} | KitVLT</title>`).replace(/<meta name="description"[^>]+>/, metadata).replace('</head>', `<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script></head>`);
  html = html.replace('<p id="product-loading" role="status">Loading your shirt…</p>', '<p id="product-loading" role="status" hidden>Loading your shirt…</p>').replace('<div id="product-content" hidden>', '<div id="product-content">');
  const fields: Record<string, string> = { 'product-name': product.name, 'product-price': `£${product.price.toFixed(2)}`, 'product-description': product.description, 'product-sizing': product.sizingNote, 'product-shipping': product.shippingNote, 'product-returns': product.returnsNote, 'product-breadcrumb-name': product.name };
  for (const [identifier, value] of Object.entries(fields)) html = html.replace(new RegExp(`(<[^>]+id="${identifier}"[^>]*>)(</[^>]+>)`), (_match, opening, closing) => opening + escape(value) + closing);
  html = html.replace('<img id="product-main-img"', `<img src="${escape(product.images[0])}" id="product-main-img"`).replace('id="product-main-img" alt=""', `id="product-main-img" alt="${escape(product.name)}"`);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
