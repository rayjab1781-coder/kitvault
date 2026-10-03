import { db, body, json, failure, limit, StoreError } from '../../server/store';
import { subscribers } from '../../db/schema';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new StoreError('Enter a valid email address.');
    if (input.consent !== true) throw new StoreError('Please agree to receive the newsletter.');
    if (input.website) throw new StoreError('Unable to subscribe.');
    await limit(request, 'newsletter', 10);
    await db.insert(subscribers).values({ email }).onConflictDoNothing();
    return json({ message: 'You’re on the list. Your first-order code is KITVLT10.', code: 'KITVLT10', emailSent: false });
  } catch (error) { return failure(error); }
};
