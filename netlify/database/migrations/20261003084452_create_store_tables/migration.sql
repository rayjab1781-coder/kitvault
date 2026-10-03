CREATE TABLE "basket_items" (
	"basket_id" text,
	"product_id" text,
	"size" text,
	"quantity" integer NOT NULL,
	CONSTRAINT "basket_items_pkey" PRIMARY KEY("basket_id","product_id","size")
);
--> statement-breakpoint
CREATE TABLE "baskets" (
	"id" text PRIMARY KEY,
	"promo_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY,
	"basket_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"basket_id" text NOT NULL,
	"checkout_key" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"email" text,
	"customer" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer NOT NULL,
	"shipping" integer NOT NULL,
	"total" integer NOT NULL,
	"promo_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"email" text PRIMARY KEY,
	"consent_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'website' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_basket_id_baskets_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "baskets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_basket_id_baskets_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "baskets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_basket_id_baskets_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "baskets"("id");