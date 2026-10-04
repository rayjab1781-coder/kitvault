import { createHash } from 'node:crypto';
import { StoreError } from './store';

type ResendResult = {
  id?: string;
  unsubscribed?: boolean;
  data?: { id: string; name: string }[];
  has_more?: boolean;
};

export function connectNewsletter() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new StoreError('Newsletter signup is temporarily unavailable. Please try again later.', 503);
  const signal = AbortSignal.timeout(25000);

  async function request(path: string, method = 'GET', payload?: unknown, idempotencyKey?: string, allowMissing = false): Promise<ResendResult | null> {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(`https://api.resend.com${path}`, {
          method,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
          signal,
        });
        if (response.status === 404 && allowMissing) return null;
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter || attempt + 1, 1), 3) * 1000));
          continue;
        }
        if (!response.ok) throw new StoreError('We couldn’t complete your newsletter signup or send your welcome email. Please try again in a few minutes.', 503);
        return await response.json() as ResendResult;
      }
    } catch (error) {
      if (error instanceof StoreError) throw error;
      throw new StoreError('The newsletter service is taking too long to respond. Please try again in a few minutes.', 503);
    }
    throw new StoreError('Newsletter signup is busy. Please try again in a minute.', 503);
  }

  async function subscribe(email: string) {
    let after = '';
    let segmentId: string | undefined;
    do {
      const segments = await request(`/segments?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
      segmentId = segments?.data?.find((segment) => segment.name === 'KitVLT Newsletter')?.id;
      if (segmentId || !segments?.has_more) break;
      const next = segments.data?.at(-1)?.id;
      if (!next || next === after) break;
      after = next;
    } while (!signal.aborted);
    if (!segmentId) throw new StoreError('The KitVLT newsletter is temporarily unavailable. Please try again later.', 503);
    const contactPath = `/contacts/${encodeURIComponent(email)}`;
    let contact = await request(contactPath, 'GET', undefined, undefined, true);
    if (!contact) {
      try {
        contact = await request('/contacts', 'POST', { email, unsubscribed: false, segments: [{ id: segmentId }] });
        if (contact?.id) return;
        throw new StoreError('We couldn’t save your newsletter signup. Please try again in a few minutes.', 503);
      } catch (error) {
        contact = await request(contactPath, 'GET', undefined, undefined, true);
        if (!contact) throw error;
      }
    }
    if (contact?.unsubscribed) throw new StoreError('This address previously unsubscribed from KitVLT emails. Please use the preference link in a previous newsletter or contact KitVLT to rejoin.', 409);
    await request(`${contactPath}/segments/${encodeURIComponent(segmentId)}`, 'POST');
  }

  return { from, request, subscribe };
}

export async function sendWelcomeEmail(connection: ReturnType<typeof connectNewsletter>, email: string) {
  const preview = 'Your exclusive KitVLT welcome offer is waiting.';
  const subject = 'Welcome to KitVLT — Here’s 10% OFF ⚽';
  const text = `${preview}\n\nWelcome to the vault! Thanks for joining the KitVLT newsletter.\n\nTake 10% off your first order with code KITVLT10. Enter it in your basket.\n\nShop football shirts: https://kitvault.website/\n\nFirst orders only. Shirt subtotal only; excludes delivery. One code per order.\n\nYou signed up for KitVLT newsletter updates on our website.`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f1e8;color:#171717;font-family:Arial,sans-serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preview}</div><main style="max-width:560px;margin:auto"><h1>Welcome to the vault ⚽</h1><p>Thanks for joining the KitVLT newsletter. Your next matchday shirt starts here.</p><h2>Take 10% off your first order</h2><p>Your exclusive welcome code:</p><p style="font-size:28px;font-weight:bold;letter-spacing:3px">KITVLT10</p><p>Enter your code in your basket before checkout.</p><p><a href="https://kitvault.website/" style="display:inline-block;padding:16px 24px;background:#171717;color:#fff;text-decoration:none">Shop the vault →</a></p><p>First orders only. Shirt subtotal only; excludes delivery. One code per order.</p><p style="font-size:12px">You signed up for KitVLT newsletter updates on our website.</p></main></body></html>`;
  const result = await connection.request('/emails', 'POST', { from: connection.from, to: [email], subject, html, text }, `kitvlt-newsletter-welcome-${createHash('sha256').update(email).digest('hex')}`);
  if (!result?.id) throw new StoreError('Your signup was saved, but we couldn’t confirm your welcome email. Please try again in a few minutes.', 503);
}
