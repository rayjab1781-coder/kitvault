# KitVLT promotions

`server/promotions.ts` is the single server-side source of truth. Code names, amounts and offer purposes must only be changed when instructed. The website never accepts a discount percentage or shipping amount from the browser.

| Code | Benefit | Offer | Scope |
| --- | --- | --- | --- |
| KITVLT10 | 10% off | Newsletter welcome offer | Shirt subtotal; existing first-order restriction retained |
| OCT3 | 15% off | Launch offer | Shirt subtotal |
| COMMENT10 | 10% off | Social media/comment offer | Shirt subtotal |
| WELCOME15 | 15% off | General welcome offer | Shirt subtotal |
| RETRO10 | 10% off | Retro shirts | Only catalogue items with `era: "retro"` |
| VIP15 | 15% off | Creator/community offer | Shirt subtotal |
| FREESHIP | Free shipping | Free shipping | Delivery to any supported checkout destination |

All seven codes are active. No expiry date, minimum spend or additional first-order restrictions were introduced. KITVLT10 retains its existing first-order check against paid orders for the customer's email address. Codes are trimmed and matched case-insensitively, while their configured names remain exactly as listed above.

Only one code applies at a time. Applying another valid code replaces the basket's current code. Invalid or ineligible codes leave the existing code intact. RETRO10 is rejected when there are no retro shirts; if the last retro shirt is later removed, checkout requires removing or replacing the code. There is no stacking of percentage offers with FREESHIP.

## Management and calculation

Each registry entry contains its type, percentage where applicable, offer description, active flag, collection scope where applicable, and first-order flag. Keep changes here rather than adding code-specific checks to pages or payment functions. After any authorized change, run `npm run check` and verify the affected code through basket application, checkout quotation and Stripe checkout creation.

Amounts are calculated in integer pence. Percentage discounts are rounded once to the nearest penny on the eligible shirt subtotal. Delivery is added after the shirt discount. FREESHIP leaves shirt prices unchanged and sets delivery to zero, including when a destination's normal paid delivery rate is not configured. Without FREESHIP, existing delivery rules and configured rates remain unchanged.

The selected code persists in Netlify Database's existing basket record. Order snapshots retain the selected code, shirt subtotal, shirt discount, charged delivery and final total. No database schema changes are required; the existing store migration is applied automatically during deployment.

The basket API, validation API and checkout quotation all use the same promotion evaluator. Stripe checkout creation rechecks the basket, product availability and first-order eligibility server-side. Percentage offers use an exact fixed-amount Stripe coupon; free shipping uses a zero-price shipping rate. The persisted order total matches those payment parameters, and existing paid-order verification remains in place.
