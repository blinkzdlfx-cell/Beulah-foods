# PROJECT.md — Beulah Foods

## What this is

Beulah Foods is a food-products e-commerce website with two clearly separated areas:

1. **Storefront** — customers browse products, manage a cart, check out, and track orders.
2. **Admin dashboard** — authorized staff manage catalogue data, inventory, orders, and payment records.

This is a separate project from BFIS (the internal Beulah Foods inventory system). Nothing here should assume or depend on BFIS.

## Locked stack

The project intentionally uses plain HTML5, normal CSS, Vanilla JavaScript, Supabase, and static deployment. No React, Next.js, Vue, Angular, Tailwind, Bootstrap, Vite, or unnecessary build pipeline should be introduced.

Development happens across Claude, Replit, OpenCode, Kilo Code, VS Code, and mobile editors. The repository therefore remains portable and readable as normal files.

## Current implementation status

### Customer foundation
- Supabase Auth signup, email confirmation, login, logout, session handling, forgot/reset password foundation.
- Customer profiles with RLS and authenticated account editing.
- Shared responsive navigation with desktop primary links and a mobile-only hamburger.
- Authenticated navigation exposes My Account appropriately without putting it in the desktop text navigation.

### Catalogue foundation
- Real Supabase categories and products.
- Public access is restricted to active catalogue records.
- Shop, category filtering, product details, pricing, and stock availability use live database records.

### Shopping foundation
- Persistent browser cart.
- Cart quantity/removal controls and live catalogue revalidation.
- Checkout populated from the authenticated customer profile.
- Trusted provider-neutral order creation RPC rechecks product availability/prices, snapshots order items, reserves stock for 15 minutes, and creates a pending payment record.
- Payment provider initialization and verification are intentionally not implemented yet.

### Admin foundation
- Explicit `admin_users` authorization table and database-side `is_admin()` check.
- Trusted-only admin provisioning function; client-controlled role metadata is never used for authorization.
- Admin login and catalogue/category/inventory foundation.
- Admin order and transaction read views.

### Customer orders
- Authenticated order list and individual order detail pages.

## Important open decisions

The following must not be invented by an AI coding agent:

- payment provider
- exact delivery/fee rules
- promo-code/discount rules
- admin-account provisioning procedure beyond the trusted database boundary
- transactional email policy/templates where business approval is required

Agents may build provider-neutral interfaces and safe database boundaries around these decisions, but must clearly document what remains blocked.

## Read these before building anything

| File | What it covers |
|---|---|
| `ARCHITECTURE.md` | Technical structure and data flow |
| `DEVELOPMENT.md` | Development and testing workflow |
| `DESIGN.md` | Visual direction |
| `FEATURES.md` | Current feature status |
| `RULES.md` | Hard project rules |
| `AGENTS.md` | AI coding-agent rules |
| `PHASE_PROGRESS.md` | Phase-by-phase implementation progress |
