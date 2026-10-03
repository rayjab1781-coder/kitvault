export const promotions: Record<string, { percent: number; active: boolean; firstOrderOnly: boolean }> = {
  KITVLT10: { percent: 10, active: true, firstOrderOnly: true },
};

export function calculateDiscount(subtotal: number, code: string | null) {
  if (!code) return 0;
  const promo = promotions[code.trim().toUpperCase()];
  if (!promo?.active) throw new Error("That code isn't valid or has expired.");
  return Math.min(subtotal, Math.round(subtotal * promo.percent / 100));
}
