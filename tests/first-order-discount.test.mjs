import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the production functions with isolated database and payment adapters.
// No real customers, charges, or database writes are involved.
const directory = await mkdtemp(join(tmpdir(), 'kitvlt-discounts-'));
const output = join(directory, 'store.mjs');
await build({
  stdin: { contents: `export * from './server/promotions'; export * from './server/store'; export * from './server/payment';`, resolveDir: process.cwd() },
  outfile: output, bundle: true, platform: 'node', format: 'esm',
  plugins: [{ name: 'isolated-adapters', setup(builder) {
    builder.onLoad({ filter: /\/db\/index\.ts$/ }, () => ({ contents: 'export const db = globalThis.testDatabase;', loader: 'ts' }));
    builder.onResolve({ filter: /^stripe$/ }, () => ({ path: 'stripe', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export default class Stripe { constructor() { return globalThis.testStripe; } }' }));
  } }],
});
let rows = []; let expired = []; let sessions = {};
const matches = (condition, row) => {
  if (!condition) return true;
  // Drizzle's real SQL compiler supplies parameter values; the adapter implements
  // the email/status/id predicates used by these production queries.
  const { params } = dialect.sqlToQuery(condition);
  return params.every(value => {
    if (typeof value !== 'string') return true;
    if (value.includes('@')) return row.email?.trim().toLowerCase() === value;
    if (['paid', 'pending'].includes(value)) return row.status === value;
    if (value.startsWith('cs_')) return row.id === value;
    return true;
  });
};
const { PgDialect } = await import('drizzle-orm/pg-core');
const dialect = new PgDialect();
const query = () => {
  let condition;
  const result = { from() { return this; }, where(value) { condition = value; return this; }, limit() { return this; }, for() { return this; }, then(resolve, reject) { return Promise.resolve(rows.filter(row => matches(condition, row))).then(resolve, reject); } };
  return result;
};
const database = {
  select: query,
  execute: async () => {},
  transaction: async callback => callback(database),
  update: () => ({ set(values) { return { where(condition) { const selected = rows.filter(row => matches(condition, row)); selected.forEach(row => Object.assign(row, values)); return { returning: async () => selected, then: resolve => Promise.resolve().then(resolve) }; } }; } }),
};
globalThis.testDatabase = database;
globalThis.testStripe = {
  checkout: { sessions: {
    retrieve: async id => sessions[id],
    expire: async id => { if (sessions[id].status !== 'open') throw Error('Already completed'); expired.push(id); sessions[id].status = 'expired'; },
  } },
};
const store = await import(output);
const reset = () => { rows = []; expired = []; sessions = {}; };
const pending = (id, promoCode = 'WELCOME10') => ({ id, status: 'pending', email: 'buyer@example.com', promoCode, subtotal: 2400, discount: 240, shipping: 400, total: 2560, customer: {}, items: [], basketId: 'basket' });
const checkoutSession = (id, overrides = {}) => ({ id, status: 'complete', payment_status: 'paid', currency: 'gbp', amount_subtotal: 2400, amount_total: 2560, total_details: { amount_discount: 240, amount_shipping: 400, amount_tax: 0 }, ...overrides });

try {
  await test('first-time customer qualifies for both welcome aliases', async () => {
    reset();
    await store.checkEligibility('buyer@example.com', 'WELCOME10');
    await store.checkEligibility('buyer@example.com', 'KITVLT10');
  });
  await test('any successful prior order permanently blocks both aliases, independent of basket', async () => {
    reset(); rows = [{ ...pending('cs_paid', null), email: ' Buyer@Example.COM ', status: 'paid' }];
    for (const code of ['WELCOME10', 'KITVLT10']) await assert.rejects(store.checkEligibility(' BUYER@example.com ', code), /first successful order/);
    await store.checkEligibility('buyer@example.com', 'COMMENT10');
    await store.checkEligibility('other@example.com', 'WELCOME10');
  });
  await test('£24 product gets exactly £2.40 off and shipping is excluded', () => {
    process.env.KITVLT_UK_SHIPPING_PENCE = '400';
    for (const code of ['WELCOME10', 'KITVLT10']) {
      const promotion = store.evaluatePromotion(2400, code);
      assert.equal(promotion.discount, 240);
      const totals = store.checkoutTotals({ subtotal: 24, discount: promotion.discount / 100, promo: promotion }, 'GB');
      assert.deepEqual(totals, { subtotal: 2400, discount: 240, shipping: 400, deliveryOffset: 0, total: 2560 });
    }
    const other = store.checkoutTotals({ subtotal: 24, discount: 2.4, promo: { code: 'COMMENT10', valid: true, firstOrderOnly: false, freeShipping: false } }, 'GB');
    assert.equal(other.discount, 640); // Existing behavior for other promotions.
  });
  await test('abandoned and failed payments do not consume eligibility', async () => {
    reset(); rows = [pending('cs_abandoned'), { ...pending('cs_failed'), status: 'failed' }];
    assert.equal(await store.finishOrder(checkoutSession('cs_abandoned', { payment_status: 'unpaid' })), null);
    await store.checkEligibility('buyer@example.com', 'WELCOME10');
  });
  await test('old open checkout is expired before another discounted checkout', async () => {
    reset(); rows = [pending('cs_old')]; sessions.cs_old = checkoutSession('cs_old', { status: 'open', payment_status: 'unpaid' });
    await store.reconcileCustomerCheckouts(database, globalThis.testStripe, 'buyer@example.com', 'KITVLT10');
    assert.deepEqual(expired, ['cs_old']); assert.equal(rows[0].status, 'expired');
    await store.checkEligibility('buyer@example.com', 'KITVLT10');
  });
  await test('delayed webhook cannot grant a second first-order discount', async () => {
    reset(); rows = [pending('cs_paid')]; sessions.cs_paid = checkoutSession('cs_paid');
    await store.reconcileCustomerCheckouts(database, globalThis.testStripe, 'buyer@example.com', 'KITVLT10');
    assert.equal(rows[0].status, 'paid');
    await assert.rejects(store.checkEligibility('buyer@example.com', 'KITVLT10'), /already placed an order/);
    await store.finishOrder(sessions.cs_paid); // Duplicate confirmation stays idempotent.
    assert.equal(rows.filter(row => row.status === 'paid').length, 1);
  });
  await test('processing payments and expiration races fail closed', async () => {
    reset(); rows = [pending('cs_processing')]; sessions.cs_processing = checkoutSession('cs_processing', { payment_status: 'unpaid' });
    await assert.rejects(store.reconcileCustomerCheckouts(database, globalThis.testStripe, 'buyer@example.com', 'WELCOME10'), /still processing/);
    sessions.cs_processing = checkoutSession('cs_processing', { status: 'open', payment_status: 'unpaid' });
    const racingStripe = { checkout: { sessions: { ...globalThis.testStripe.checkout.sessions, expire: async () => { throw Error('Payment completed during expiration'); } } } };
    await assert.rejects(store.reconcileCustomerCheckouts(database, racingStripe, 'buyer@example.com', 'WELCOME10'), /during expiration/);
  });
  await test('changing codes does not leave an old welcome checkout payable', async () => {
    reset(); rows = [pending('cs_old')]; sessions.cs_old = checkoutSession('cs_old', { status: 'open', payment_status: 'unpaid' });
    await store.reconcileCustomerCheckouts(database, globalThis.testStripe, 'buyer@example.com', 'COMMENT10');
    assert.deepEqual(expired, ['cs_old']);
  });
} finally { await rm(directory, { recursive: true, force: true }); }
