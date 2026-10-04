CREATE TABLE "reviews" (
	"id" text PRIMARY KEY,
	"display_name" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("rating" between 1 and 5),
	CONSTRAINT "reviews_status_values" CHECK ("status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "reviews_name_length" CHECK (char_length(trim("display_name")) between 1 and 80),
	CONSTRAINT "reviews_text_length" CHECK (char_length(trim("review")) between 10 and 2000)
);
--> statement-breakpoint
CREATE INDEX "reviews_public_index" ON "reviews" ("status","created_at");