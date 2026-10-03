import { stripeClient, finishOrder } from '../../server/payment';
import { json } from '../../server/store';
import type Stripe from 'stripe';

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!process.env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook is not configured.' }, 503);
  let event: Stripe.Event;
  try { event = stripeClient().webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature') || '', process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return json({ error: 'Invalid webhook signature.' }, 400); }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    try {
      const paid = await finishOrder(event.data.object as Stripe.Checkout.Session);
      if (paid && process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL && process.env.KITVLT_EMAIL_FROM) {
        const notification = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `kitvlt-order-${paid.id}` },
          body: JSON.stringify({ from: process.env.KITVLT_EMAIL_FROM, to: [process.env.NOTIFY_EMAIL], subject: `KitVLT paid order ${(paid.customer as { reference: string }).reference}`, text: JSON.stringify({ reference: (paid.customer as { reference: string }).reference, email: paid.email, customer: paid.customer, items: paid.items, total: (paid.total / 100).toFixed(2) }, null, 2) }),
        });
        if (!notification.ok) return json({ error: 'Order notification is pending. Please retry.' }, 500);
      }
    } catch { return json({ error: 'Order could not be recorded. Please retry.' }, 500); }
  }
  return json({ received: true });
};
