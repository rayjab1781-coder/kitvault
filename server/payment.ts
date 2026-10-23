import Stripe from 'stripe';
import { randomUUID, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getPromotion } from './promotions';
import { db, orders, basketItems, baskets, eq, and, StoreError } from './store';

export const stripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new StoreError('Payments are not connected yet. No payment has been taken.', 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

export const orderNumber = () => `KV-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
export const fingerprint = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

export type OrderTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordPaidOrder(session: Stripe.Checkout.Session, transaction: OrderTransaction) {
  if (session.payment_status !== 'paid') return null;
  const [order] = await transaction.select().from(orders).where(eq(orders.id, session.id)).for('update');
  if (!order) throw new StoreError('Order is not available yet. Please try again.', 503);
  if (order.status === 'paid') return order;
  if (session.currency !== 'gbp' || session.amount_subtotal !== order.subtotal || session.total_details?.amount_discount !== order.discount || session.total_details.amount_shipping !== order.shipping || session.total_details.amount_tax !== 0 || session.amount_total !== order.total) throw new StoreError('Order totals require review. Please contact KitVLT.', 409);
  const shipping = session.collected_information?.shipping_details;
  const customer = { ...(order.customer as Record<string, unknown>), ...(shipping ? { shipping } : {}) };
  const [paid] = await transaction.update(orders).set({ status: 'paid', paidAt: new Date(), customer, email: order.email?.trim().toLowerCase() || session.customer_details?.email?.trim().toLowerCase() }).where(eq(orders.id, order.id)).returning();
  for (const item of order.items as { productId: string; size: string; quantity: number }[]) {
    const match = and(eq(basketItems.basketId, order.basketId), eq(basketItems.productId, item.productId), eq(basketItems.size, item.size));
    await transaction.update(basketItems).set({ quantity: sql`greatest(0, ${basketItems.quantity} - ${item.quantity})` }).where(match);
    await transaction.delete(basketItems).where(and(match, eq(basketItems.quantity, 0)));
  }
  await transaction.update(baskets).set({ promoCode: null }).where(eq(baskets.id, order.basketId));
  return paid;
}

export async function finishOrder(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return null;
  return db.transaction((transaction) => recordPaidOrder(session, transaction));
}

// All checkout creation for an email shares this transaction lock, across browsers
// and server instances. Stripe expiration closes the pay-before-webhook race:
// a session either expires, or has completed and must be reconciled first.
export async function reconcileCustomerCheckouts(
  transaction: OrderTransaction, stripe: Stripe, email: string, code: string | null,
) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`);
  const pending = await transaction.select().from(orders).where(and(
    sql`lower(trim(${orders.email})) = ${email}`, eq(orders.status, 'pending'),
  ));
  for (const order of pending) {
    if (!getPromotion(code)?.firstOrderOnly && !getPromotion(order.promoCode)?.firstOrderOnly) continue;
    const checkout = await stripe.checkout.sessions.retrieve(order.id);
    if (checkout.payment_status === 'paid') {
      await recordPaidOrder(checkout, transaction);
    } else if (checkout.status === 'complete') {
      throw new StoreError('Your previous payment is still processing. Please wait for confirmation before starting another checkout.', 409);
    } else {
      // If a payment races expiration, Stripe rejects expiration. Fail closed and
      // reconcile on retry rather than issue a second discounted checkout.
      if (checkout.status === 'open') await stripe.checkout.sessions.expire(order.id);
      await transaction.update(orders).set({ status: 'expired' }).where(eq(orders.id, order.id));
    }
  }
}
