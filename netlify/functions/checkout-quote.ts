import { body, session, basket, shippingQuote, json, failure, StoreError, checkEligibility } from '../../server/store';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    const current = await session(request, false);
    const summary = await basket(current.id);
    if (!summary.items.length) throw new StoreError('Your basket is empty.');
    if (summary.promo && !summary.promo.valid) throw new StoreError(summary.promo.message);
    if (input.email) await checkEligibility(String(input.email).trim().toLowerCase(), summary.promo?.code || null);
    const shipping = shippingQuote(String(input.country), Math.round(summary.subtotal * 100), summary.promo?.code || null);
    return json({ ...summary, shipping: shipping === null ? null : shipping / 100, finalTotal: shipping === null ? null : Math.round((summary.total * 100) + shipping) / 100, payments: Boolean(process.env.STRIPE_SECRET_KEY) });
  } catch (error) { return failure(error); }
};
