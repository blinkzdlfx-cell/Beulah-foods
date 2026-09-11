# Beulah Foods — Current Build Status

## Phase 1A — Customer shell

- Customer signup/sign-in/log-out: implemented; live-tested by the project owner.
- Customer profile/account: real `customer_profiles` data with read-only view, edit mode, dirty-state Save, Cancel, and authentication protection.
- Responsive header: desktop primary navigation plus a mobile-only hamburger. Initial session loading no longer renders an incorrect signed-out state.
- Shop is a primary navigation destination.
- My Account and Log out remain inside the mobile hamburger menu; desktop signed-in users get a compact account icon.
- Clean public routes are served through `worker.js`, with legacy `/storefront/*.html` paths normalized to clean URLs.

## Phase 1B — Catalogue foundation

Implemented:
- `categories` and `products` database tables.
- Active-only public RLS.
- Real Supabase catalogue service.
- Shop with live products and category filtering.
- Product detail page using a slug query parameter.
- Live product pricing and stock availability.
- Admin category/product CRUD foundation with database-side admin authorization.
- No fake products, prices, images, or catalogue data.

## Phase 2 — Shopping and order foundation

Implemented:
- Browser cart persistence using localStorage.
- Add, quantity change, and remove controls.
- Live catalogue revalidation when rendering the cart/checkout.
- Authenticated checkout populated from the real customer profile.
- Trusted `create_pending_order` RPC that rechecks live prices/stock, snapshots order items, reserves stock, and creates a pending payment.
- 15-minute reservation model with trusted expired-reservation release function.
- Customer RLS for own orders, order items, reservations, and payments.
- Customer My Orders and order detail pages.
- Admin order and transaction read views.
- Admin inventory visibility and low-stock information.
- Admin operational order-status updates through a narrow trusted database function; payment status is protected from browser/admin mutation.
- Cart remains intact until a payment is actually completed; pending reservation creation does not falsely imply payment success.

Intentionally not activated:
- Payment provider initialization.
- Server-side provider verification/webhooks.
- Exact fee/delivery rules.
- Promo/discount calculation.
- Transactional email.

These require explicit business/provider decisions and must not be invented.

## Admin authorization foundation

Implemented:
- `admin_users` table.
- Database-side `is_admin()` authorization helper.
- RLS policies for admin catalogue and operational record access.
- Trusted-only `provision_admin()` boundary.
- Admin sign-in checks explicit database authorization instead of client metadata.
- Admin order-status updates are restricted to operational status; payment truth remains provider-controlled.

Admin provisioning itself remains a deliberate trusted operation; do not create an admin by passing a role flag from browser signup.

## Known remaining work

- Finalize and configure the selected payment provider.
- Implement provider initialization and server-side verification/webhooks.
- Approve/configure fees, delivery, and promo rules.
- Complete richer admin order/customer management.
- Configure Resend transactional email.
- Apply all pending Supabase migrations to the live project.
- Perform full live end-to-end testing after those services are configured.
