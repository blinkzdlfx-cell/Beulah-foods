# RULES.md — Beulah Foods

These are hard rules. If a rule and a feature request conflict, the rule
wins — stop and ask rather than breaking it.

## Core principles

1. No mock production data.
2. No fake APIs.
3. No hardcoded production products or prices.
4. Real Supabase data must be used when implementing functionality.
5. Do not invent business rules.
6. Do not silently change architectural decisions.
7. Keep customer and admin areas separated.
8. Keep the folder structure simple and understandable.
9. Build and test incrementally.
10. Do not build the entire application and wait until the end to test it.
11. When a feature requires database functionality, connect it to the
    real development database.
12. Do not add dependencies unless there is a concrete technical reason.
13. Preserve existing decisions and conventions.
14. Do not modify unrelated features.

## Products

- Products are controlled by the admin.
- Prices must come from the database — never hardcoded in the storefront.
- The storefront displays live product data from Supabase.
- Inactive/deactivated products are not purchasable by customers.
- Deleting or deactivating a product must **not** erase or corrupt the
  product details already stored on historical orders. An old order
  needs to keep showing what was actually bought, at the price actually
  paid, even if that product no longer exists in the catalog.

## Pricing and fees

- Product pricing and fees are both admin-controlled.
- The storefront displays applicable fees dynamically — never hardcoded.
- The final payable amount is calculated from authoritative backend/
  database data, not solely by client-side JavaScript (see
  ARCHITECTURE.md for how — Supabase Edge Functions / DB logic, since
  there's no separate backend server).
- Don't invent fee types, tax rules, delivery charges, or pricing
  formulas that haven't been explicitly defined. Ask first.

## Reservations and payment

Reservation duration is **fixed at 15 minutes**. Flow:

```
Checkout → Create reservation → 15-min window → Initialize payment
  → Customer pays → Verify payment → SUCCESS or FAILED/PENDING
```

- The browser redirect after payment is never treated as proof of
  success — payment must be verified server-side.
- Payment status and order status are separate concepts; don't conflate
  them.

**Payment states:** `pending`, `successful`, `failed`
**Reservation states:** `active`, `expired`, `confirmed`

After a verified successful payment:
`payment = successful`, `reservation = confirmed`, `order = paid`.

Normal order progression after that: `paid → processing → completed`.

If payment fails: `payment = failed`, and the order reflects a
payment-failed state.

Admins can update **operational** order status (e.g. moving an order to
"processing" or "completed"), but ordinary order-status editing must
never be able to falsely flip payment status. Payment status only changes
through the verified payment flow.

## Security

- Enforce security through Supabase authentication and
  authorization/database policies (Row Level Security) — not by hiding
  buttons in the UI. A hidden button is a UX choice, not a security
  boundary.
- The Supabase service role key never appears in browser code, in
  `/storefront`, in `/admin`, or in the repo.

## Admin permissions

- Admin manages: products (add/edit/deactivate/reactivate/delete),
  categories, inventory, orders (view/search/manage operational status),
  payments (view), customers (view), promo codes, announcements,
  testimonials, and store settings.
- Admin can update operational order status, but not payment status
  directly (see above).
- Don't invent additional admin permissions or roles beyond what's
  listed here without asking.
