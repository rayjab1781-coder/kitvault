# Customer review moderation

Reviews require manual approval. No fake or placeholder customer reviews are included, and submissions are never published automatically. The public API cannot approve reviews or list pending reviews.

Deploy the site to apply the new reviews migration automatically. No new API keys, email service or public administrator login are required. The original store migration and historical subscriber records remain untouched.

## Approving or rejecting reviews

Open the site's Netlify Database dashboard and connect with an authorized PostgreSQL client using the dashboard's secure connection instructions. Keep database credentials private; never paste them into this repository or browser code. The CLI's `netlify db connect --query` command is read-only and cannot approve a review.

Inspect the moderation queue in the connected database:

```sql
SELECT id, display_name, rating, review, created_at
FROM reviews
WHERE status = 'pending'
ORDER BY created_at;
```

After checking a submission for spam, abusive content and private information, replace `REVIEW_ID` with that record's ID:

```sql
UPDATE reviews SET status = 'approved' WHERE id = 'REVIEW_ID' AND status = 'pending';
```

To reject a submission, set `status = 'rejected'` instead. To unpublish an approved review, set its status to `rejected`. All ratings are treated equally; moderation is for safety and authenticity, not to hide negative feedback. Reload the storefront to see the latest approved reviews. Only the latest 50 approved reviews are displayed.

No customer email address or proof of purchase is collected, so the website does not claim that submissions are verified purchases. Requests to remove a review can be handled through the existing customer-service address. Limit moderator database access to trusted site administrators.

## First-order offer and socials

KITVLT10 retains its real 10% shirt-subtotal discount and existing paid-order email eligibility check. Copying the code does not apply it or reserve eligibility. The popup is remembered in local browser storage and a first-party cookie; older offer-dismissal cookies and existing browsing sessions are honored. It cannot identify one person across browsers/devices or after storage is cleared.

The existing KitVLT YouTube and Instagram URLs are reused throughout the site and open in new tabs. No replacement social URL needs configuration.

The Resend integration for merchant order notifications remains intact and still uses `RESEND_API_KEY`, `NOTIFY_EMAIL` and `KITVLT_EMAIL_FROM`. No environment variables were removed.
