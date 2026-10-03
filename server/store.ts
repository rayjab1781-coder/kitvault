import { randomBytes, createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { baskets, basketItems, orders, rateLimits } from '../db/schema';
import products from '../data/products.json';
import { calculateDiscount, promotions } from './promotions';

export { products, db, baskets, basketItems, orders, eq, and };

export class StoreError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function guard(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new StoreError('Request not permitted.', 403);
}

export async function body(request: Request) {
  guard(request);
  const raw = await request.text();
  if (raw.length > 20000) throw new StoreError('Request too large.', 413);
  try { return JSON.parse(raw); } catch { throw new StoreError('Invalid request.'); }
}

export async function session(request: Request, create = true) {
  const value = request.headers.get('cookie')?.match(/(?:^|;\s*)kitvlt_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (value) {
    const [existing] = await db.select().from(baskets).where(eq(baskets.id, value));
    if (existing) return { id: value, cookie: '' };
  }
  if (!create) throw new StoreError('Please reopen your basket and try again.', 401);
  const id = randomBytes(32).toString('hex');
  await db.insert(baskets).values({ id });
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { id, cookie: `kitvlt_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}` };
}

export function json(data: unknown, status = 200, cookie = '') {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}

export function failure(error: unknown) {
  return json({ error: error instanceof StoreError ? error.message : 'The store is temporarily unavailable. Please try again.' }, error instanceof StoreError ? error.status : 503);
}

export function validateItem(item: { productId: string; size: string; quantity: number }) {
  const product = products.find((entry) => entry.id === item.productId);
  if (!product) throw new StoreError('This shirt is no longer in the catalogue.');
  if (!product.sizes.includes(item.size)) throw new StoreError('Please select a size.');
  if (product.stock !== 'in-stock') throw new StoreError(`${product.name} is not available to purchase.`);
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new StoreError('Choose a quantity between 1 and 10.');
  return product;
}

export async function basket(id: string) {
  const items = await db.select({ productId: basketItems.productId, size: basketItems.size, quantity: basketItems.quantity }).from(basketItems).where(eq(basketItems.basketId, id));
  const [stored] = await db.select().from(baskets).where(eq(baskets.id, id));
  const subtotal = items.reduce((total, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return total + (product ? Math.round(product.price * 100) * item.quantity : 0);
  }, 0);
  const code = stored?.promoCode || null;
  let discount = 0;
  try { discount = calculateDiscount(subtotal, code); } catch { }
  const promo = code && promotions[code]?.active ? { code, label: `${promotions[code].percent}% off`, valid: true, discount: discount / 100, total: (subtotal - discount) / 100 } : null;
  return { items, subtotal: subtotal / 100, discount: discount / 100, total: (subtotal - discount) / 100, promo };
}

export async function checkEligibility(email: string, code: string | null) {
  if (!code || !promotions[code]?.firstOrderOnly) return;
  const [previous] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.email, email.toLowerCase()), eq(orders.status, 'paid'))).limit(1);
  if (previous) throw new StoreError(`${code} is for your first order. Please remove the code to continue.`);
}

export async function limit(request: Request, action: string, maximum: number) {
  const address = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  const hash = createHash('sha256').update(address).digest('hex');
  const id = `${action}:${hash}:${Math.floor(Date.now() / 60000)}`;
  const [record] = await db.insert(rateLimits).values({ id }).onConflictDoUpdate({ target: rateLimits.id, set: { count: sql`${rateLimits.count} + 1` } }).returning();
  if (record.count > maximum) throw new StoreError('Too many requests. Please try again in a minute.', 429);
}

export function shippingQuote(country: string, subtotal: number) {
  if (country === 'GB' && subtotal > 5000) return 0;
  const setting = country === 'GB' ? process.env.KITVLT_UK_SHIPPING_PENCE : process.env.KITVLT_INTERNATIONAL_SHIPPING_PENCE;
  if (!setting || !/^\d+$/.test(setting)) return null;
  return Number(setting);
}
