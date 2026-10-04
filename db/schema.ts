import { pgTable, text, timestamp, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';

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
  welcomeEmailSentAt: timestamp('welcome_email_sent_at'),
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
