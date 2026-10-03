import { json, shippingQuote } from '../../server/store';

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  return json({ payments: Boolean(process.env.STRIPE_SECRET_KEY), ukShipping: shippingQuote('GB', 0), internationalShipping: shippingQuote('US', 0), countries: ['GB', 'IE', 'US', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'NL'] });
};
