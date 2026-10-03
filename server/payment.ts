import Stripe from 'stripe';
import { randomUUID, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, orders, basketItems, baskets, eq, and, StoreError } from './store';

export const stripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new StoreError('Payments are not connected yet. No payment has been taken.', 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

export const orderNumber = () => `KV-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
export const fingerprint = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

export async function finishOrder(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return null;
  return db.transaction(async (transaction) => {
    const [order] = await transaction.select().from(orders).where(eq(orders.id, session.id)).for('update');
    if (!order) throw new StoreError('Order is not available yet. Please try again.', 503);
    if (order.status === 'paid') return order;
    if (session.currency !== 'gbp' || session.amount_total !== order.total) throw new StoreError('Order totals require review. Please contact KitVLT.', 409);
    const shipping = session.collected_information?.shipping_details;
    const customer = { ...(order.customer as Record<string, unknown>), ...(shipping ? { shipping } : {}) };
    const [paid] = await transaction.update(orders).set({ status: 'paid', paidAt: new Date(), customer, email: session.customer_details?.email?.toLowerCase() || order.email }).where(eq(orders.id, order.id)).returning();
    for (const item of order.items as { productId: string; size: string; quantity: number }[]) {
      const match = and(eq(basketItems.basketId, order.basketId), eq(basketItems.productId, item.productId), eq(basketItems.size, item.size));
      await transaction.update(basketItems).set({ quantity: sql`greatest(0, ${basketItems.quantity} - ${item.quantity})` }).where(match);
      await transaction.delete(basketItems).where(and(match, eq(basketItems.quantity, 0)));
    }
    await transaction.update(baskets).set({ promoCode: null }).where(eq(baskets.id, order.basketId));
    return paid;
  });
}
