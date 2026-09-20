// Creates a real, multi-item Stripe Checkout Session.
// SECURITY: prices are NEVER trusted from the browser — every line item is
// priced from data/products.json on the server, so a tampered page can't
// check out at a fake price.
// Requires env var: STRIPE_SECRET_KEY
const Stripe = require('stripe');
const products = require('../../data/products.json');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Payments are not configured on the server yet.' }) };
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { items, customerEmail, promoCodeId } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Your basket is empty.' }) };
    }

    const siteUrl = process.env.URL || 'http://localhost:8888';
    const line_items = [];

    for (const item of items) {
      const p = products.find((x) => x.id === item.productId);
      if (!p) return { statusCode: 400, body: JSON.stringify({ error: `Unknown product: ${item.productId}` }) };
      if (p.stock !== 'in-stock') return { statusCode: 400, body: JSON.stringify({ error: `${p.name} isn't available to buy right now.` }) };

      const quantity = Math.max(1, Math.min(10, parseInt(item.quantity, 10) || 1));
      const size = p.sizes.includes(item.size) ? item.size : p.sizes[0];

      line_items.push({
        price_data: {
          currency: 'gbp',
          product_data: { name: `${p.name} (Size ${size})` },
          unit_amount: Math.round(p.price * 100)
        },
        quantity
      });
    }

    const sessionParams = {
      mode: 'payment',
      line_items,
      customer_email: customerEmail || undefined,
      shipping_address_collection: { allowed_countries: ['GB','IE','US','CA','AU','FR','DE','ES','IT','NL'] },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout.html`
    };

    if (promoCodeId) sessionParams.discounts = [{ promotion_code: promoCodeId }];
    else sessionParams.allow_promotion_codes = true;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not start checkout. Please try again.' }) };
  }
};
