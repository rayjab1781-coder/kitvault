import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Bundle only test fixtures into the OS temporary directory, never site artifacts.
// The handlers and pricing/stock rules are real; storage and Stripe are isolated.
const directory = await mkdtemp(join(tmpdir(), 'kitvlt-checkout-'));
const output = join(directory, 'handlers.mjs');
let summary; let created; let coupon; let order; let writes;
const transaction = {
  select: () => ({ from: () => ({ where: async () => [] }) }),
  insert: () => ({ values: value => { order = value; return { onConflictDoNothing: async () => {} }; } }),
};
globalThis.checkoutFixture = {
  session: async () => ({ id: 'test-basket', cookie: '' }),
  basket: async () => summary,
  limit: async () => {},
  checkEligibility: async () => {}, // Real eligibility and reconciliation covered in the companion suite.
  db: {
    transaction: async callback => callback(transaction),
    insert: () => { writes++; throw Error('Unexpected basket write'); },
  },
};
globalThis.paymentFixture = {
  stripeClient: () => ({
    customers: { create: async () => ({ id: 'customer-test' }) },
    coupons: { create: async value => { coupon = value; return { id: 'coupon-test' }; } },
    checkout: { sessions: { create: async value => { created = value; return { id: 'session-test', url: 'https://checkout.stripe.com/test' }; } } },
  }),
  reconcileCustomerCheckouts: async () => {},
  fingerprint: () => 'test-key',
  orderNumber: () => 'test-reference',
};
await build({
  stdin: { contents: `export {default as quote} from './netlify/functions/checkout-quote'; export {default as checkout} from './netlify/functions/create-checkout-session'; export {default as cart} from './netlify/functions/cart'; export * from './server/promotions';`, resolveDir: process.cwd() },
  outfile: output, bundle: true, platform: 'node', format: 'esm',
  plugins: [{ name: 'isolated-adapters', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/server\/store$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\.\.\/\.\.\/server\/payment$/ }, () => ({ path: 'payment', namespace: 'fixture' }));
    builder.onLoad({ filter: /^store$/, namespace: 'fixture' }, () => ({ contents: `export * from '${process.cwd()}/server/store.ts'; export const {session,basket,limit,checkEligibility,db} = globalThis.checkoutFixture;` }));
    builder.onLoad({ filter: /^payment$/, namespace: 'fixture' }, () => ({ contents: 'export const {stripeClient,reconcileCustomerCheckouts,fingerprint,orderNumber} = globalThis.paymentFixture;' }));
    builder.onLoad({ filter: /\/db\/index\.ts$/ }, () => ({ contents: 'export const db = {};', loader: 'ts' }));
    builder.onResolve({ filter: /\/server\/store\.ts$/ }, args => ({ path: args.path }));
  } }],
});
const handlers = await import(output);
const request = (name, payload) => new Request(`https://example.test/.netlify/functions/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const customer = { name: 'Test Buyer', email: 'test@example.com', line1: '1 Test Street', city: 'London', postalCode: 'SW1A 1AA', country: 'GB', terms: 'on' };
try {
  await test('unavailable variants cannot be added, increased, quoted or sent to payment, including saved baskets', async () => {
    for (const [productId, size] of [['brazil-2002-r9', 'S'], ['ac-milan-2006-kaka', 'S'], ['barcelona', 'M']]) {
      const item = { productId, size, quantity: 1 };
      summary = { items: [item], subtotal: 23.99, discount: 0, total: 23.99, promo: null };
      writes = 0; created = null;
      for (const action of ['add', 'quantity']) {
        const response = await handlers.cart(request('cart', { action, ...item }));
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Out of Stock/);
      }
      for (const [name, handler, payload] of [['checkout-quote', handlers.quote, { country: 'GB' }], ['create-checkout-session', handlers.checkout, { customer }]]) {
        const response = await handler(request(name, payload));
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Out of Stock/);
      }
      assert.equal(writes, 0); assert.equal(created, null);
    }
  });
  await test('product size controls visibly label and disable only the requested variants', async () => {
    const products = JSON.parse(await readFile('data/products.json', 'utf8'));
    const source = await readFile('product.js', 'utf8');
    for (const id of ['brazil-2002-r9', 'ac-milan-2006-kaka', 'barcelona']) {
      const elements = new Map();
      const element = () => ({ textContent: '', children: [], disabled: false, setAttribute() {}, addEventListener() {}, appendChild(child) { this.children.push(child); }, querySelectorAll() { return this.children; } });
      const get = id => {
        if (['product-thumbs', 'related-products'].includes(id)) return null;
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      };
      let ready;
      runInNewContext(source, {
        URLSearchParams, location: { search: `?id=${id}` },
        window: { KitVLTBasket: { loadProducts: async () => products } },
        document: { addEventListener: (_, callback) => { ready = callback; }, getElementById: get, createElement: element, querySelector: () => ({}) },
      });
      await ready();
      const product = products.find(product => product.id === id);
      const buttons = get('product-sizes').children;
      assert.equal(buttons.length, product.sizes.length);
      buttons.forEach((button, index) => {
        const size = product.sizes[index];
        if (product.outOfStockSizes.includes(size)) {
          assert.equal(button.disabled, true);
          assert.equal(button.textContent, `${size} — Out of Stock`);
        } else assert.ok(!button.disabled);
      });
    }
  });
  await test('£23.99 welcome quotes match Stripe payment parameters and order snapshots with and without shipping', async () => {
    for (const code of ['KITVLT10', 'WELCOME10']) {
      const promo = handlers.evaluatePromotion(2399, code);
      summary = { items: [{ productId: 'real-madrid-home', size: 'S', quantity: 1 }], subtotal: 23.99, discount: promo.discount / 100, total: promo.total / 100, promo: { ...promo, discount: promo.discount / 100, total: promo.total / 100 } };
      for (const shipping of [0, 299, 400]) {
        process.env.KITVLT_UK_SHIPPING_PENCE = String(shipping);
        const quote = await handlers.quote(request('checkout-quote', { country: 'GB' }));
        assert.equal(quote.status, 200);
        const displayed = await quote.json();
        assert.equal(displayed.discount, 2.40);
        assert.equal(Math.round(displayed.finalTotal * 100), 2159 + shipping);
        const checkout = await handlers.checkout(request('create-checkout-session', { customer }));
        assert.equal(checkout.status, 200);
        const stripeSubtotal = created.line_items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
        const stripeShipping = created.shipping_options[0].shipping_rate_data.fixed_amount.amount;
        assert.equal(coupon.amount_off, 240);
        assert.equal(created.discounts[0].coupon, 'coupon-test');
        const charged = stripeSubtotal - coupon.amount_off + stripeShipping;
        assert.equal(charged, Math.round(displayed.finalTotal * 100));
        assert.equal(order.total, charged);
        assert.equal(order.shipping, stripeShipping);
        assert.equal(order.discount, coupon.amount_off);
      }
    }
  });
} finally { await rm(directory, { recursive: true, force: true }); }
