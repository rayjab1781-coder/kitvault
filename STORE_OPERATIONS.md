# KitVLT store operations

The existing KitVLT catalogue, product photos, policies and social links were retained. The root website is the active storefront; the older `KitVault/` archive redirects to it instead of serving a duplicate store.

## Products and promotions

Manage shirts in `data/products.json`. Product IDs must remain stable because baskets and order records reference them. Prices are in pounds; server calculations convert them to integer pence. Set `stock` to `in-stock`, `coming-soon` or `sold-out`, and list only the sizes and image files that actually exist. Do not advertise availability that you cannot fulfil.

Current shirts are £23.99 and retro shirts are £32.99. The configured Brazil R9 price (£34.99) and Barcelona Dreamwave special price (£27.99) were retained. References to nonexistent back/detail photos were removed; none of the real image files were deleted.

Manage promo codes in `server/promotions.ts`: add, disable or remove entries, change the percentage, or set first-order eligibility. KITVLT10 gives 10% off the shirt subtotal, rounded once to the nearest penny, and never discounts delivery. Baskets support one code at a time. The checkout server checks previous paid orders against the customer email for first-order offers. If the headline newsletter offer changes, update its marketing copy as well.

## Persistent storage

Baskets, their separate product/size rows, newsletter consent, browsing-session chat history, rate-limit counters and orders use Netlify Database with Drizzle. Only an opaque, HttpOnly session identifier is kept in the browser; product and customer records are not stored in client JSON files. A dismissal cookie remembers the newsletter preference. Existing local-storage baskets are imported once where possible and the old storage is removed.

The schema is in `db/schema.ts`. The generated migration is in `netlify/database/migrations/`. Netlify applies migrations during deployment. Generate a new migration after any schema changes with `npx drizzle-kit generate --name describe_the_change`; do not edit applied migrations. Netlify manages database credentials automatically.

## Payment and delivery connection

Stripe is the retained payment provider. Set `STRIPE_SECRET_KEY` only in Netlify's server-side environment. Configure a Stripe webhook pointing to `/.netlify/functions/stripe-webhook`, set `STRIPE_WEBHOOK_SECRET`, and subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Never place these values in HTML, browser JavaScript or this repository.

Set `KITVLT_UK_SHIPPING_PENCE` and `KITVLT_INTERNATIONAL_SHIPPING_PENCE` to the actual approved nonnegative delivery charges in pence. No shipping rate was invented. UK orders with a shirt subtotal over £50 receive free delivery, based on the existing policy. Other orders cannot proceed until their delivery rate is configured. Checkout supports the destinations already present in the Stripe integration and restricts the payment destination to the country selected for the quote.

Without payment configuration, checkout explicitly says payment is unavailable and does not claim to take payment. With configuration, prices, sizes, availability, quantities and discounts are checked on the server and the customer moves to Stripe-hosted payment. Pending and paid orders are stored in the database. Confirmation requires verified paid status and browser-session ownership. Retried webhook delivery is idempotent, and only purchased quantities are removed from the basket after payment.

Validate first in Stripe test mode with a test webhook. Check a successful payment, cancelled payment, delayed payment, webhook retries, both sides of the free-delivery threshold, each supported destination and a returning customer using KITVLT10. Then configure the live environment. No real payment was captured during development.

## Newsletter and notifications

Newsletter subscriptions are genuinely saved in Netlify Database together with consent. The site reveals KITVLT10 and allows it to be copied. No automated newsletter email provider is connected, and the success message says so. Subscribers are not exposed through a public list endpoint. Connect an email service to the newsletter function when ready, including unsubscribe and consent handling; do not claim a welcome email was sent until the provider confirms delivery.

The optional existing Resend order-notification integration remains available through server environment variables `RESEND_API_KEY`, `NOTIFY_EMAIL` and `KITVLT_EMAIL_FROM`. Use a verified sender. This sends merchant notifications only; no customer receipt or shipping email is falsely promised. Stripe receipt settings and a customer shipping-notification workflow still require owner configuration.

## KitGPT

KitGPT uses Netlify AI Gateway and the official OpenAI SDK server-side with the supported `gpt-4.1-mini` model. No private credentials appear in the browser. AI interprets shopping intent; the server supplies confirmed product IDs, prices, stock, sizes and policies rather than accepting generated store facts. History is stored in the database and associated with a browsing-session cookie. If AI is unavailable, a clearly labelled catalogue-help fallback answers supported questions without pretending it is AI.

## Validation and launch checklist

`npm run check` checks TypeScript. JavaScript syntax checks, server-rendered product metadata checks and browser journey checks were performed. Browser journey checks used isolated backend/payment fixtures because the supplied fresh database does not yet contain the deployment-created tables and runtime credentials cannot apply its migration schema. These fixtures are not included in the storefront. The real catalogue, original images, new-tab navigation, size validation and mobile layout were also checked against the running Netlify development server.

Before accepting customers, deploy to apply the database migration, confirm newsletter persistence and cross-tab baskets against the deployed database, configure and test Stripe and actual delivery charges, confirm fulfilment capacity and product availability, verify the existing shipping/returns and replica-product statements, and connect any desired email delivery. Run the full journey on the deployed site in Stripe test mode before enabling live payment. A live charge, live webhook and automated email delivery were not validated in this environment.
