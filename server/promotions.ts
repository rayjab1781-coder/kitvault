type Promotion = {
  active: boolean;
  firstOrderOnly: boolean;
  offer: string;
} & ({ type: 'percentage'; percent: number; collection?: 'retro' } | { type: 'fixed'; amount: number; minimumSubtotal: number } | { type: 'free-shipping' });

export const promotions: Record<string, Promotion> = {
  KITVLT10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: true, offer: 'First-order welcome offer' },
  VLT15: { type: 'percentage', percent: 15, active: true, firstOrderOnly: false, offer: '15% shirt discount' },
  COMMENT10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: false, offer: 'YouTube commenter offer' },
  FOOTBALL15: { type: 'percentage', percent: 15, active: true, firstOrderOnly: false, offer: 'Football shirts' },
  SECRET10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: false, offer: 'Private offer' },
  FRIENDSVLT: { type: 'percentage', percent: 20, active: true, firstOrderOnly: false, offer: 'Selected customers; shared privately' },
  WELCOME10: { type: 'percentage', percent: 10, active: true, firstOrderOnly: true, offer: 'First-order welcome offer' },
  RETRO5: { type: 'fixed', amount: 500, minimumSubtotal: 4000, active: true, firstOrderOnly: false, offer: '£5 off orders over £40' },
  FREESHIP: { type: 'free-shipping', active: true, firstOrderOnly: false, offer: 'Free shipping' },
  FAMILY50: { type: 'percentage', percent: 50, active: true, firstOrderOnly: false, offer: 'Family and friends; shared in person only' },
};

export const normalizePromoCode = (code: unknown) => typeof code === 'string' ? code.trim().toUpperCase() : '';

export function getPromotion(code: string | null) {
  const normalized = normalizePromoCode(code);
  return Object.hasOwn(promotions, normalized) ? promotions[normalized] : undefined;
}

export function calculateDiscount(subtotal: number, code: string | null) {
  if (!code) return 0;
  const promo = getPromotion(code);
  if (!promo?.active) throw new Error("That code isn't valid or has expired.");
  if (subtotal <= 0) throw new Error('Add a shirt to your basket first.');
  if (promo.type === 'free-shipping') return 0;
  if (promo.type === 'fixed') {
    if (subtotal <= promo.minimumSubtotal) throw new Error('This code requires a product subtotal over £40, before delivery.');
    return Math.min(subtotal, promo.amount);
  }
  return Math.min(subtotal, Math.round(subtotal * promo.percent / 100));
}

export function evaluatePromotion(subtotal: number, code: string | null) {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;
  const promotion = getPromotion(normalized);
  const label = promotion?.type === 'free-shipping' ? 'Free shipping' : promotion?.type === 'percentage' ? `${promotion.percent}% off shirts` : promotion?.type === 'fixed' ? '£5 off orders over £40' : 'Unavailable offer';
  try {
    const discount = calculateDiscount(subtotal, normalized);
    return { code: normalized, label, valid: true, firstOrderOnly: promotion!.firstOrderOnly, freeShipping: promotion!.type === 'free-shipping', discount, total: subtotal - discount, message: `${normalized} applied — ${label}.${promotion!.firstOrderOnly ? ' First orders only.' : ''}` };
  } catch (error) {
    return { code: normalized, label, valid: false, firstOrderOnly: promotion?.firstOrderOnly || false, freeShipping: false, discount: 0, total: subtotal, message: error instanceof Error ? error.message : 'Unable to apply this code.' };
  }
}
