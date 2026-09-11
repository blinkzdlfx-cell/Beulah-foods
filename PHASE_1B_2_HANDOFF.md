# Phase 1B + Phase 2 Handoff

This file records the foundation pass completed directly on `main`.

## Completed in this pass

- Desktop/mobile navigation refinement.
- Mobile hamburger contains Home, Shop, Cart, My Account/auth actions as appropriate.
- Initial Supabase session loading no longer renders a visible incorrect signed-out state.
- Login respects safe `?redirect=` destinations.
- Password recovery redirect uses the canonical root reset-password URL.
- Storefront favicon paths corrected on catalogue/cart/checkout pages.
- Worker canonicalizes `/storefront/*.html` URLs to clean public routes.
- Admin authorization foundation with `admin_users` and database-side `is_admin()`.
- Trusted-only `provision_admin()` boundary.
- Admin login authorization and catalogue/category/inventory dashboard foundation.
- Admin order and transaction read views.
- Trusted provider-neutral pending-order RPC.
- 15-minute stock reservation foundation and expired reservation release function.
- Checkout now creates a real pending order/reservation through the RPC rather than pretending payment exists.
- Customer order list and order detail pages.
- `FEATURES.md`, `PROJECT.md`, and `PHASE_PROGRESS.md` synchronized.

## Intentionally not invented

- Payment provider.
- Provider API keys/webhooks.
- Exact delivery/fee rules.
- Promo-code rules.
- Transactional email templates/policy.

## Before production testing

1. Apply Supabase migrations `0004_admin_authorization.sql` and `0005_trusted_checkout.sql` after the existing migrations.
2. Provision the first admin account from a trusted SQL/service-role context using `provision_admin()`; never add an admin role through client metadata.
3. Configure the selected payment provider and server-side verification boundary.
4. Configure approved fees/promo rules.
5. Configure Resend if transactional email is required.
6. Run full live storefront/admin checkout testing.
