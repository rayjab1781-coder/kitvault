import { db, basketItems, baskets, basket, session, body, json, failure, validateItem, eq, and, StoreError } from '../../server/store';
import { sql } from 'drizzle-orm';
import { promotions } from '../../server/promotions';

export default async (request: Request) => {
  try {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const payload = request.method === 'POST' ? await body(request) : null;
    const current = await session(request);
    if (payload) {
      const { action, productId, size, quantity } = payload;
      const match = and(eq(basketItems.basketId, current.id), eq(basketItems.productId, String(productId)), eq(basketItems.size, String(size)));
      if (action === 'add' || action === 'quantity') {
        validateItem({ productId, size, quantity });
        if (action === 'add') {
          const existing = await basket(current.id);
          if (existing.items.length >= 80 && !existing.items.some((item) => item.productId === productId && item.size === size)) throw new StoreError('Your basket has reached its limit.');
          await db.insert(basketItems).values({ basketId: current.id, productId, size, quantity }).onConflictDoUpdate({ target: [basketItems.basketId, basketItems.productId, basketItems.size], set: { quantity: sql`least(10, ${basketItems.quantity} + ${quantity})` } });
        } else await db.update(basketItems).set({ quantity }).where(match);
      } else if (action === 'remove') await db.delete(basketItems).where(match);
      else if (action === 'promo') {
        const code = String(payload.code || '').trim().toUpperCase();
        if (code && !promotions[code]?.active) throw new StoreError("That code isn't valid or has expired.");
        if (code && !(await basket(current.id)).items.length) throw new StoreError('Add a shirt to your basket first.');
        await db.update(baskets).set({ promoCode: code || null }).where(eq(baskets.id, current.id));
      } else if (action === 'import') {
        const existing = await basket(current.id);
        if (!existing.items.length && Array.isArray(payload.items)) {
          for (const item of payload.items.slice(0, 80)) {
            try { validateItem(item); } catch { continue; }
            await db.insert(basketItems).values({ basketId: current.id, productId: item.productId, size: item.size, quantity: item.quantity }).onConflictDoNothing();
          }
        }
      } else throw new StoreError('Unknown basket action.');
    }
    return json(await basket(current.id), 200, current.cookie);
  } catch (error) { return failure(error); }
};
