import { db, body, json, failure, limit, StoreError, eq } from '../../server/store';
import { subscribers } from '../../db/schema';
import { connectNewsletter, sendWelcomeEmail } from '../../server/newsletter';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StoreError('Invalid signup request.');
    const email: string = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const [local, domain] = email.split('@');
    if (!/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email) || email.length > 254 || local.length > 64 || local.startsWith('.') || local.endsWith('.') || email.includes('..') || domain.split('.').some((label) => label.length > 63 || label.startsWith('-') || label.endsWith('-'))) throw new StoreError('Enter a valid email address.');
    if (input.consent !== true) throw new StoreError('Please agree to receive the newsletter.');
    if (input.website) throw new StoreError('Unable to subscribe.');
    await limit(request, 'newsletter', 10);
    const connection = connectNewsletter();
    await db.insert(subscribers).values({ email }).onConflictDoNothing();
    await connection.subscribe(email);
    const [subscriber] = await db.select().from(subscribers).where(eq(subscribers.email, email));
    if (subscriber?.welcomeEmailSentAt) return json({ message: 'You’re already on the KitVLT newsletter list. Your first-order code is KITVLT10. Check your inbox or spam folder for your welcome offer.', code: 'KITVLT10', emailSent: true, alreadySubscribed: true });
    await sendWelcomeEmail(connection, email);
    await db.update(subscribers).set({ welcomeEmailSentAt: new Date() }).where(eq(subscribers.email, email));
    return json({ message: 'You’re on the KitVLT newsletter list! Your welcome email is on its way. Check your inbox or spam folder. Your first-order code is KITVLT10.', code: 'KITVLT10', emailSent: true, alreadySubscribed: false });
  } catch (error) { return failure(error); }
};
