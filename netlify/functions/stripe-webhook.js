// Captures completed orders and optionally emails you a summary.
// NOTE: this is a bonus layer. Stripe already has a zero-code notification:
// Stripe Dashboard -> Settings -> Notifications -> "Email me about successful payments".
// Turn that on regardless — it can't fail the way a custom integration can.
// Requires: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Optional (for email): RESEND_API_KEY, NOTIFY_EMAIL
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Webhook not configured.' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, event.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['shipping_details','customer_details'] });
      const order = {
        orderId: session.id,
        email: full.customer_details ? full.customer_details.email : session.customer_email,
        total: (session.amount_total / 100).toFixed(2),
        shipping: full.shipping_details || null,
        items: lineItems.data.map((li) => ({ description: li.description, quantity: li.quantity, amount: (li.amount_total / 100).toFixed(2) }))
      };
      console.log('NEW ORDER:', JSON.stringify(order, null, 2));
      if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) await sendEmail(order);
    } catch (err) {
      // Never fail the webhook over a notification issue — Stripe has the order regardless.
      console.error('Notification error:', err);
    }
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function sendEmail(o) {
  const items = o.items.map((i) => `<li>${i.quantity} &times; ${i.description} — £${i.amount}</li>`).join('');
  const a = o.shipping && o.shipping.address ? o.shipping.address : null;
  const ship = a ? `<p>${o.shipping.name || ''}<br>${a.line1 || ''}<br>${a.city || ''} ${a.postal_code || ''}<br>${a.country || ''}</p>` : '<p>No address collected.</p>';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'KitVLT Orders <orders@resend.dev>',
      to: process.env.NOTIFY_EMAIL,
      subject: `New order — £${o.total}`,
      html: `<h2>New KitVLT order</h2><p><strong>Order:</strong> ${o.orderId}</p><p><strong>Email:</strong> ${o.email || 'n/a'}</p><p><strong>Total:</strong> £${o.total}</p><h3>Items</h3><ul>${items}</ul><h3>Ship to</h3>${ship}`
    })
  });
}
