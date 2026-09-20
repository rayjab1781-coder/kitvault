// Looks a promo code up in Stripe and returns the REAL discount it applies,
// so the basket total always matches what Stripe will actually charge.
// Add/change codes in Stripe Dashboard -> Coupons + Promotion codes. No code changes needed.
// Requires env var: STRIPE_SECRET_KEY
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Not configured.' }) };
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { code, subtotal } = JSON.parse(event.body || '{}');
    if (!code || typeof subtotal !== 'number') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or subtotal.' }) };
    }

    const list = await stripe.promotionCodes.list({ code: String(code).trim(), active: true, limit: 1 });
    const promo = list.data[0];
    if (!promo || !promo.coupon || !promo.coupon.valid) {
      return { statusCode: 200, body: JSON.stringify({ valid: false, message: "That code isn't valid or has expired." }) };
    }

    if (promo.restrictions && promo.restrictions.minimum_amount) {
      const min = promo.restrictions.minimum_amount / 100;
      if (subtotal < min) {
        return { statusCode: 200, body: JSON.stringify({ valid: false, message: `Spend at least £${min.toFixed(2)} to use this code.` }) };
      }
    }

    const c = promo.coupon;
    let discount = 0, label = '';
    if (c.percent_off) { discount = Math.round(subtotal * (c.percent_off / 100) * 100) / 100; label = `${c.percent_off}% off`; }
    else if (c.amount_off) { discount = Math.min(c.amount_off / 100, subtotal); label = `£${(c.amount_off / 100).toFixed(2)} off`; }

    return { statusCode: 200, body: JSON.stringify({
      valid: true, id: promo.id, code: promo.code, label, discount,
      total: Math.max(0, subtotal - discount)
    })};
  } catch (err) {
    console.error('Promo error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not check that code right now.' }) };
  }
};
