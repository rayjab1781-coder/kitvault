import { getPromotion } from '../../server/promotions.js';
import { json } from '../../server/store.js';

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const promotion = getPromotion('KITVLT10');
  const available = Boolean(promotion?.active && promotion.type === 'percentage' && promotion.percent === 10 && promotion.firstOrderOnly && !promotion.collection);
  const returningVisitor = /(?:^|;\s*)kitvlt_session=[a-f0-9]{64}(?:;|$)/.test(request.headers.get('cookie') || '');
  return json(available ? { available: true, code: 'KITVLT10', percent: 10, firstOrderOnly: true, returningVisitor } : { available: false });
};
