import { body, session, basket, products, db, orders, validateItem, shippingQuote, json, failure, StoreError, checkEligibility, limit, eq } from '../../server/store';
import { stripeClient, orderNumber, fingerprint } from '../../server/payment';
import type Stripe from 'stripe';

export default async (request: Request) => {
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const input = await body(request);
    const current = await session(request, false);
    await limit(request, 'checkout', 10);
    const summary = await basket(current.id);
    if (!summary.items.length) throw new StoreError('Your basket is empty.');
    if (summary.promo && !summary.promo.valid) throw new StoreError(summary.promo.message);
    summary.items.forEach(validateItem);
    const customer = input.customer;
    if (!customer || typeof customer !== 'object') throw new StoreError('Please enter your contact and shipping details.');
    if (customer.terms !== 'on') throw new StoreError('Please agree to the Terms before continuing.');
    const fields = ['name', 'email', 'line1', 'city', 'postalCode', 'country'];
    if (fields.some((field) => typeof customer[field] !== 'string' || !customer[field].trim() || customer[field].length > 254)) throw new StoreError('Please complete all required shipping details.');
    const clean = Object.fromEntries([...fields, 'line2'].map((field) => [field, String(customer[field] || '').trim().slice(0, 254)]));
    clean.email = clean.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new StoreError('Enter a valid email address.');
    if (!['GB', 'IE', 'US', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'NL'].includes(clean.country)) throw new StoreError('This shipping destination is not supported.');
    const subtotal = Math.round(summary.subtotal * 100);
    const discount = Math.round(summary.discount * 100);
    const shipping = shippingQuote(clean.country, subtotal, summary.promo?.code || null);
    if (shipping === null) throw new StoreError('Delivery rates for this destination are not connected yet. Please contact KitVLT before ordering.', 503);
    await checkEligibility(clean.email, summary.promo?.code || null);
    const stripe = stripeClient();
    const key = fingerprint({ basket: current.id, items: summary.items, subtotal, discount, shipping, promoCode: summary.promo?.code || null, customer: clean, window: Math.floor(Date.now() / 1800000) });
    const [existing] = await db.select().from(orders).where(eq(orders.checkoutKey, key));
    if (existing?.status === 'paid') throw new StoreError('This checkout is already paid. Refresh your basket.');
    const reference = existing ? (existing.customer as { reference: string }).reference : orderNumber();
    const address = { line1: clean.line1, line2: clean.line2 || undefined, city: clean.city, postal_code: clean.postalCode, country: clean.country };
    const stripeCustomer = await stripe.customers.create({ name: clean.name, email: clean.email, address, shipping: { name: clean.name, address } }, { idempotencyKey: `${key}-customer` });
    let coupon: Stripe.Coupon | undefined;
    if (discount) coupon = await stripe.coupons.create({ amount_off: discount, currency: 'gbp', duration: 'once', name: summary.promo!.code }, { idempotencyKey: `${key}-discount` });
    const siteUrl = process.env.URL || new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomer.id,
      client_reference_id: reference,
      line_items: summary.items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId)!;
        return { price_data: { currency: 'gbp', unit_amount: Math.round(product.price * 100), product_data: { name: `${product.name} — Size ${item.size}`, images: [new URL(product.images[0], siteUrl).href] } }, quantity: item.quantity };
      }),
      shipping_address_collection: { allowed_countries: [clean.country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry] },
      customer_update: { shipping: 'auto', name: 'auto' },
      shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: shipping, currency: 'gbp' }, display_name: shipping === 0 ? 'Free delivery' : 'Standard delivery' } }],
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      metadata: { reference, promoCode: summary.promo?.code || '' },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout.html?cancelled=1`,
    }, { idempotencyKey: key });
    const items = summary.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)!;
      return { ...item, name: product.name, image: product.images[0], price: Math.round(product.price * 100) };
    });
    await db.insert(orders).values({ id: checkout.id, basketId: current.id, checkoutKey: key, customer: { ...clean, reference }, email: clean.email, items, subtotal, discount, shipping, total: subtotal - discount + shipping, promoCode: summary.promo?.code }).onConflictDoNothing();
    return json({ url: checkout.url });
  } catch (error) { return failure(error); }
};
