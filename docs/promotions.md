# KitVLT promotions

`server/promotions.ts` is the single server-side source of truth. Code names, amounts and offer purposes must only be changed when instructed. The website never accepts a discount percentage or shipping amount from the browser.

| Code | Benefit | Offer | Scope |
| --- | --- | --- | --- |
| KITVLT10 | 10% off | First-order welcome offer | Shirt subtotal; existing first-order restriction retained |
| VLT15 | 15% off | General offer | Shirt subtotal |
| COMMENT10 | 10% off | YouTube commenters | Shirt subtotal |
| FOOTBALL15 | 15% off | Football shirts | Shirt subtotal; all current catalogue products are football shirts |
| SECRET10 | 10% off | Private offer | Shirt subtotal; no public promotion |
| FRIENDSVLT | 20% off | Selected customers | Shirt subtotal; shared privately |
| WELCOME10 | 10% off | First orders | Shirt subtotal; checked against paid orders |
| RETRO5 | £5 off | Orders over £40 | Product subtotal must exceed £40 before discount and delivery; not restricted to retro items |
| FREESHIP | Free shipping | Free shipping | Delivery to any supported checkout destination |
| FAMILY50 | 50% off | Family and friends | Shirt subtotal; shared in person only |

Exactly these ten codes are active. The previous OCT3, WELCOME15, RETRO10 and VIP15 codes were replaced. KITVLT10 retains its existing first-order check against paid orders for the customer's email address; WELCOME10 uses the same check. Codes are trimmed and matched case-insensitively. No expiry dates were introduced.

Only one code applies at a time. Applying another valid code replaces the basket's current code. Invalid codes and unmet spending thresholds leave the existing code intact. RETRO5 is rejected at £40 or below; if the basket later falls below its threshold, checkout requires removing or replacing the code. There is no stacking of offers with FREESHIP.

Private codes are not advertised on customer-facing pages or by the store chatbot. At the owner's request, FAMILY50 and FRIENDSVLT are distributed in person rather than restricted by email or accounts. Anyone who obtains a code can use it: possession is not verified family membership, and forwarding cannot be prevented by the existing checkout. The repository is public, so source-code entries must not be treated as secrets. Direct website requests for the server source directory and this operations document return 404 to avoid exposing the registry through the storefront.

## Management and calculation

Each registry entry contains its type, percentage or fixed pence amount where applicable, offer description, active flag, spending threshold where applicable, and first-order flag. Keep changes here rather than adding code-specific checks to pages or payment functions. After any authorized change, run `npm run check` and verify the affected code through basket application, checkout quotation and Stripe checkout creation.

Amounts are calculated in integer pence. Percentage discounts are rounded once to the nearest penny on the shirt subtotal; RETRO5 subtracts exactly 500 pence when eligible. Valid percentage and fixed discount codes also receive an extra product discount towards delivery at checkout. The delivery fee itself remains unchanged and is still charged and shown separately. For a £23.99 shirt with a 10% code and £2.99 delivery, the product discount is £2.40 plus a £2.99 delivery offset: £23.99 − £5.39 + £2.99 = £21.59 delivered. This is a larger promotion than 10% off products alone; it reduces the store's proceeds by the delivery offset as well.

The shared `checkoutTotals` helper supplies both checkout quotation and Stripe creation with the same discount and delivery amounts. The extra offset is capped at the product subtotal remaining after its original discount, so the Stripe product coupon never exceeds the product subtotal. If delivery costs more than that remaining subtotal, it is only partially offset and the final total cannot be lower than the delivery fee. This applies consistently to UK and international supported destinations. Invalid or ineligible codes do not receive the offset, and unknown delivery rates still prevent payment.

The existing free UK delivery threshold still uses the original product subtotal over £50, so a discount does not remove free delivery. FREESHIP leaves shirt prices unchanged and sets delivery to zero, including when a destination's normal paid delivery rate is not configured. Orders without a code retain their normal delivery charge and receive no extra discount.

Basket totals are explicitly labelled before delivery and its offset; their delivery note explains the extra saving at checkout. Checkout displays product subtotal, combined discount, unchanged delivery fee and final total separately, including a zero discount. The promo help text identifies the exact extra delivery offset. Only the checkout quotation controls the combined discount and delivery-inclusive final total; promo rendering cannot replace them with product-only amounts. Pending or failed quotations do not display a stale payment total.

The selected code persists in Netlify Database's existing basket record. Order snapshots retain the selected code, shirt subtotal, combined shirt discount including the delivery offset, charged delivery and final total. No database schema changes are required; the existing store migration is applied automatically during deployment.

The basket API, validation API and checkout quotation all use the same promotion evaluator. Stripe checkout creation rechecks the basket, product availability and first-order eligibility server-side. Percentage and fixed offers use an exact fixed-amount Stripe coupon; free shipping uses a zero-price shipping rate. The persisted order total matches those payment parameters. Signed Stripe webhook processing verifies currency, subtotal, discount, shipping, tax and final total against the stored order before recording payment.
