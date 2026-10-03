type Promotion = {
  active: boolean;
  firstOrderOnly: boolean;
  offer: string;
} & ({ type: 'percentage'; percent: number; collection?: 'retro' } | { type: 'free-shipping' });

export const promotions: Record<string, Promotion> = {
  KITVLT10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: true, offer: 'Newsletter welcome offer' },
  OCT3: { type: 'percentage', percent: 15, active: true, firstOrderOnly: false, offer: 'Launch offer' },
  COMMENT10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: false, offer: 'Social media/comment offer' },
  WELCOME15: { type: 'percentage', percent: 15, active: true, firstOrderOnly: false, offer: 'General welcome offer' },
  RETRO10: { type: 'percentage', percent: 10, collection: 'retro', active: true, firstOrderOnly: false, offer: 'Retro shirts' },
  VIP15: { type: 'percentage', percent: 15, active: true, firstOrderOnly: false, offer: 'Creator/community offer' },
  FREESHIP: { type: 'free-shipping', active: true, firstOrderOnly: false, offer: 'Free shipping' },
};

export const normalizePromoCode = (code: unknown) => typeof code === 'string' ? code.trim().toUpperCase() : '';

export function getPromotion(code: string | null) {
  const normalized = normalizePromoCode(code);
  return Object.hasOwn(promotions, normalized) ? promotions[normalized] : undefined;
}

export function calculateDiscount(subtotal: number, code: string | null, retroSubtotal = 0) {
  if (!code) return 0;
  const promo = getPromotion(code);
  if (!promo?.active) throw new Error("That code isn't valid or has expired.");
  if (subtotal <= 0) throw new Error('Add a shirt to your basket first.');
  if (promo.type === 'free-shipping') return 0;
  if (promo.collection === 'retro' && retroSubtotal <= 0) throw new Error('RETRO10 applies to retro shirts. Add a retro shirt or use another code.');
  const eligibleSubtotal = promo.collection === 'retro' ? retroSubtotal : subtotal;
  return Math.min(subtotal, Math.round(eligibleSubtotal * promo.percent / 100));
}

export function evaluatePromotion(subtotal: number, retroSubtotal: number, code: string | null) {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;
  const promotion = getPromotion(normalized);
  const label = promotion?.type === 'free-shipping' ? 'Free shipping' : promotion?.type === 'percentage' ? `${promotion.percent}% off ${promotion.collection === 'retro' ? 'retro shirts' : 'shirts'}` : 'Unavailable offer';
  try {
    const discount = calculateDiscount(subtotal, normalized, retroSubtotal);
    return { code: normalized, label, valid: true, firstOrderOnly: promotion!.firstOrderOnly, freeShipping: promotion!.type === 'free-shipping', discount, total: subtotal - discount, message: `${normalized} applied — ${label}.${promotion!.firstOrderOnly ? ' First orders only.' : ''}` };
  } catch (error) {
    return { code: normalized, label, valid: false, firstOrderOnly: promotion?.firstOrderOnly || false, freeShipping: false, discount: 0, total: subtotal, message: error instanceof Error ? error.message : 'Unable to apply this code.' };
  }
}
