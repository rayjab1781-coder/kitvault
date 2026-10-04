import { pgTable, text, timestamp, integer, jsonb, primaryKey, check, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const baskets = pgTable('baskets', {
  id: text().primaryKey(),
  promoCode: text('promo_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const basketItems = pgTable('basket_items', {
  basketId: text('basket_id').notNull().references(() => baskets.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  size: text().notNull(),
  quantity: integer().notNull(),
}, (table) => [primaryKey({ columns: [table.basketId, table.productId, table.size] })]);

export const subscribers = pgTable('subscribers', {
  email: text().primaryKey(),
  consentAt: timestamp('consent_at').defaultNow().notNull(),
  source: text().notNull().default('website'),
});

export const conversations = pgTable('conversations', {
  id: text().primaryKey(),
  basketId: text('basket_id').notNull().references(() => baskets.id, { onDelete: 'cascade' }),
  messages: jsonb().notNull().default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: text().primaryKey(),
  basketId: text('basket_id').notNull().references(() => baskets.id),
  checkoutKey: text('checkout_key').notNull().unique(),
  status: text().notNull().default('pending'),
  email: text(),
  customer: jsonb().notNull(),
  items: jsonb().notNull(),
  subtotal: integer().notNull(),
  discount: integer().notNull(),
  shipping: integer().notNull(),
  total: integer().notNull(),
  promoCode: text('promo_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
});

export const rateLimits = pgTable('rate_limits', {
  id: text().primaryKey(),
  count: integer().notNull().default(1),
});

export const reviews = pgTable('reviews', {
  id: text().primaryKey(),
  displayName: text('display_name').notNull(),
  rating: integer().notNull(),
  review: text().notNull(),
  status: text().notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  check('reviews_rating_range', sql`${table.rating} between 1 and 5`),
  check('reviews_status_values', sql`${table.status} in ('pending', 'approved', 'rejected')`),
  check('reviews_name_length', sql`char_length(trim(${table.displayName})) between 1 and 80`),
  check('reviews_text_length', sql`char_length(trim(${table.review})) between 10 and 2000`),
  index('reviews_public_index').on(table.status, table.createdAt),
]);
