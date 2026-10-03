import { body, session, basket, json, failure } from '../../server/store';
import { calculateDiscount, promotions } from '../../server/promotions';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    const current = await session(request, false);
    const summary = await basket(current.id);
    const code = String(input.code || '').trim().toUpperCase();
    if (!promotions[code]?.active) return json({ valid: false, message: "That code isn't valid or has expired." });
    const discount = calculateDiscount(Math.round(summary.subtotal * 100), code) / 100;
    return json({ valid: true, code, label: `${promotions[code].percent}% off`, discount, total: Math.round((summary.subtotal - discount) * 100) / 100 });
  } catch (error) { return failure(error); }
};
