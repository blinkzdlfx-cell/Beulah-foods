# Beulah Foods — Current Build Status

## Phase 1A — Customer shell

- Customer signup/sign-in/log-out: implemented and live-tested by the project owner.
- Customer profile/account: implemented against `customer_profiles` with read-only view, edit mode, dirty-state Save, Cancel, and authenticated protection.
- Responsive header: desktop and mobile behavior defined; hamburger is mobile-only.
- Shop is a primary navigation destination.
- My Account and Log out remain inside the mobile hamburger menu.
- Desktop signed-in users get a compact account icon rather than a text My Account navigation item.

## Phase 1B — Catalogue foundation

Implemented in the repository:

- `categories` database table.
- `products` database table.
- Public RLS for active categories/products only.
- Real Supabase catalogue service.
- Shop page with live product loading.
- Category filtering.
- Product detail page using a slug query parameter.
- Product availability state from live inventory.
- No fake products, prices, images, or catalogue data.

The catalogue migration must still be applied to the live Supabase project before the new shop can display records.

## Phase 2 — Shopping foundation

Implemented:

- Browser cart persistence using localStorage.
- Add-to-cart from product cards and product detail.
- Quantity changes and item removal.
- Live catalogue revalidation when rendering the cart.
- Cart subtotal calculated from live product prices for display only.
- Authenticated checkout shell populated from the real customer profile.
- Order, order-item, reservation, and payment database foundation.
- Reservation expiry defaults to 15 minutes.
- Customer RLS for viewing their own orders, order items, reservations, and payments.

Intentionally not activated yet:

- Payment provider initialization.
- Server-side payment verification.
- Final authoritative fee calculation.
- Promo/discount calculation.
- Trusted order creation/RPC.
- Stock reservation mutation.
- Transactional email.

Those require the payment provider and final business rules to be explicitly connected. The checkout button must not claim payment success until that work exists.

## Next major build area

The next substantial work should be the admin system and trusted server-side order/payment workflow, followed by transactional email and final end-to-end testing.
