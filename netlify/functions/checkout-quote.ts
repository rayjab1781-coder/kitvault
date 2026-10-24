import { supportsShippingCountry } from '../../server/countries';
import { body, session, basket, checkoutTotals, json, failure, StoreError, checkEligibility, validateItem } from '../../server/store';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    if (!supportsShippingCountry(String(input.country))) throw new StoreError('This shipping destination is not supported.');
    const current = await session(request, false);
    const summary = await basket(current.id);
    if (!summary.items.length) throw new StoreError('Your basket is empty.');
    summary.items.forEach(validateItem);
    if (summary.promo && !summary.promo.valid) throw new StoreError(summary.promo.message);
    if (input.email) await checkEligibility(String(input.email).trim().toLowerCase(), summary.promo?.code || null);
    const pricing = checkoutTotals(summary, String(input.country));
    return json({ ...summary, discount: pricing.discount / 100, total: (pricing.subtotal - pricing.discount) / 100, deliveryOffset: pricing.deliveryOffset / 100, shipping: pricing.shipping === null ? null : pricing.shipping / 100, finalTotal: pricing.total === null ? null : pricing.total / 100, payments: Boolean(process.env.STRIPE_SECRET_KEY) });
  } catch (error) { return failure(error); }
};
