# FEATURES.md — Beulah Foods

Status legend: ⬜ not started · 🟨 in progress · ✅ done

Nothing below is built yet — this list is scope, not a changelog. Update
the status column as work actually happens; don't mark something ✅
until it's connected to real Supabase data and tested.

## Customer — Authentication
- 🟨 Sign up (UI built, uses real Supabase Auth — not yet run against a live project to confirm end-to-end)
- 🟨 Sign in / log in (same — built, not yet verified against a live project)
- 🟨 Log out (built into the shared header, same caveat)
- 🟨 Forgot password (UI built — `forgot-password.html`/`forgot-password.js`, calls `authService.requestPasswordReset()` — not yet run against a live Supabase project to confirm end-to-end)
- 🟨 Reset password (UI built — `reset-password.html`/`reset-password.js`, handles the Supabase recovery-session redirect and calls `authService.updatePassword()` — same caveat, and depends on the Redirect URL being configured; see `supabase/README.md`)
- 🟨 Maintain an authenticated session (session-aware header built; no protected page exists yet to fully exercise this)

## Customer — Account
- ⬜ View account
- ⬜ Edit name
- ⬜ Edit phone number
- ⬜ Edit delivery address

## Customer — Shopping
- ⬜ Browse products
- ⬜ View product details
- ⬜ Add products to cart
- ⬜ Change quantities
- ⬜ Remove products
- ⬜ View cart
- ⬜ Proceed to checkout

## Customer — Checkout
- ⬜ Review products
- ⬜ Review quantities
- ⬜ Review subtotal
- ⬜ Review applicable fees
- ⬜ Apply promo code
- ⬜ Review discount
- ⬜ Review final payable amount
- ⬜ Confirm checkout

## Customer — Orders / Payment
- ⬜ Create a 15-minute reservation before payment
- ⬜ Initialize payment
- ⬜ Complete payment through the selected payment provider *(provider not yet chosen — see RULES.md/open decisions)*
- ⬜ Verify payment server-side (never trust the browser redirect alone)
- ⬜ Handle pending payment
- ⬜ Handle successful payment
- ⬜ Handle failed payment
- ⬜ Show appropriate payment result screen
- ⬜ Create/confirm the order after verified successful payment
- ⬜ View own orders (authenticated)
- ⬜ View individual order details

## Admin — Dashboard
- ⬜ Overview
- ⬜ Sales information
- ⬜ Order information
- ⬜ Payment information
- ⬜ Inventory information
- ⬜ Recent activity

## Admin — Products
- ⬜ Add product
- ⬜ Edit product
- ⬜ Deactivate product
- ⬜ Reactivate product
- ⬜ Delete product (non-destructive to historical orders — see RULES.md)
- ⬜ Manage product information / pricing / availability

## Admin — Categories
- ⬜ Create
- ⬜ Edit
- ⬜ Manage categories

## Admin — Inventory
- ⬜ View stock
- ⬜ Adjust stock
- ⬜ Low-stock information
- ⬜ Product availability

## Admin — Orders
- ⬜ View orders
- ⬜ Search / filter orders
- ⬜ View individual orders
- ⬜ View customer information
- ⬜ View delivery information
- ⬜ View order items
- ⬜ View payment status
- ⬜ Manage operational order status (not payment status — see RULES.md)

## Admin — Payments / Transactions
- ⬜ View payment records
- ⬜ View transaction references
- ⬜ View payment status
- ⬜ Associate payments with orders

## Admin — Customers
- ⬜ View customers
- ⬜ View customer details
- ⬜ View customer orders

## Admin — Promo Codes
- ⬜ Create
- ⬜ Edit
- ⬜ Enable / disable
- ⬜ Configure discount rules

## Admin — Announcements
- ⬜ Create
- ⬜ Edit
- ⬜ Publish / unpublish

## Admin — Testimonials
- ⬜ Manage testimonials
- ⬜ Publish / unpublish

## Admin — Settings
- ⬜ Manage approved store configuration
