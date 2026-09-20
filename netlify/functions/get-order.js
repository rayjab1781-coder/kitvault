// Returns real order details for the confirmation page.
// Requires env var: STRIPE_SECRET_KEY
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.STRIPE_SECRET_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured.' }) };

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id.' }) };

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer_details'] });
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
    return { statusCode: 200, body: JSON.stringify({
      orderId: session.id,
      paid: session.payment_status === 'paid',
      email: session.customer_details ? session.customer_details.email : null,
      total: (session.amount_total / 100).toFixed(2),
      items: lineItems.data.map((li) => ({ description: li.description, quantity: li.quantity, amount: (li.amount_total / 100).toFixed(2) }))
    })};
  } catch (err) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
  }
};
