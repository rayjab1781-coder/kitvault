import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { reviews } from '../../db/schema.js';
import { db, body, json, failure, limit, StoreError } from '../../server/store.js';

export default async (request: Request) => {
  try {
    if (request.method === 'GET') {
      const approved = await db.select({ displayName: reviews.displayName, rating: reviews.rating, review: reviews.review })
        .from(reviews).where(eq(reviews.status, 'approved')).orderBy(desc(reviews.createdAt)).limit(50);
      return json({ reviews: approved });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StoreError('Enter your review details.');
    if (input.website) throw new StoreError('Unable to submit this review.');
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    const review = typeof input.review === 'string' ? input.review.trim() : '';
    if (!displayName || displayName.length > 80) throw new StoreError('Enter a display name of up to 80 characters.');
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new StoreError('Choose a rating from 1 to 5 stars.');
    if (review.length < 10 || review.length > 2000) throw new StoreError('Write a review between 10 and 2,000 characters.');
    await limit(request, 'reviews', 3);
    await db.insert(reviews).values({ id: randomUUID(), displayName, rating: input.rating, review, status: 'pending' });
    return json({ message: 'Thank you. Your review is awaiting approval and is not public yet.' }, 201);
  } catch (error) { return failure(error); }
};
