import { body, session, basket, json, failure, checkEligibility } from '../../server/store';
import { normalizePromoCode } from '../../server/promotions';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    const current = await session(request, false);
    const code = normalizePromoCode(input.code);
    const summary = await basket(current.id, code);
    if (!summary.promo?.valid) return json({ valid: false, message: summary.promo?.message || 'Enter a promo code.' });
    if (input.email) await checkEligibility(String(input.email).trim().toLowerCase(), code);
    return json(summary.promo);
  } catch (error) { return failure(error); }
};
