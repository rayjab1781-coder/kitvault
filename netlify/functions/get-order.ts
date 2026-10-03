import { session, json, failure, db, orders, eq, and, StoreError } from '../../server/store';
import { stripeClient, finishOrder } from '../../server/payment';

export default async (request: Request) => {
  try {
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    const current = await session(request, false);
    const id = new URL(request.url).searchParams.get('session_id');
    if (!id || !/^cs_[a-zA-Z0-9_]+$/.test(id)) throw new StoreError('Order reference is missing or invalid.');
    const [stored] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.basketId, current.id)));
    if (!stored) throw new StoreError('Order not found for this browser. Contact KitVLT for help.', 404);
    const checkout = await stripeClient().checkout.sessions.retrieve(id);
    const paid = await finishOrder(checkout);
    if (!paid) return json({ paid: false, message: 'Payment has not been confirmed. Your basket is safe; please check again shortly.' });
    return json({ paid: true, orderId: (paid.customer as { reference: string }).reference, email: paid.email, customer: paid.customer, items: paid.items, subtotal: paid.subtotal, discount: paid.discount, shipping: paid.shipping, total: paid.total });
  } catch (error) { return failure(error); }
};
