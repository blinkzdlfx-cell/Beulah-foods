# FEATURES.md — Beulah Foods

Status legend: ⬜ not started · 🟨 in progress · ✅ implemented

This file reflects the current repository state. Live-provider features remain in progress until the relevant service is configured and end-to-end tested.

## Customer — Authentication
- ✅ Sign up / email confirmation flow
- ✅ Sign in / log in
- ✅ Log out
- 🟨 Forgot password
- 🟨 Reset password
- ✅ Maintain authenticated session

## Customer — Account
- ✅ View account
- ✅ Edit name
- ✅ Edit phone number
- ✅ Edit delivery address

## Customer — Shopping
- ✅ Browse live products
- ✅ View product details
- ✅ Add products to cart
- ✅ Change quantities
- ✅ Remove products
- ✅ View cart
- 🟨 Proceed to trusted checkout

## Customer — Checkout
- ✅ Review products and quantities
- ✅ Review live subtotal
- 🟨 Review applicable fees — fee rules not yet approved/configured
- ⬜ Apply promo code
- ⬜ Review discount
- 🟨 Review final payable amount — currently provider-neutral subtotal only until fee/discount rules exist
- 🟨 Confirm checkout — creates a trusted pending order and 15-minute reservation; payment is not initialized

## Customer — Orders / Payment
- 🟨 Create a 15-minute reservation before payment
- ⬜ Initialize payment
- ⬜ Complete payment through selected provider — provider not yet chosen
- ⬜ Verify payment server-side
- 🟨 Handle pending payment
- ⬜ Handle successful payment
- ⬜ Handle failed payment
- ⬜ Show final payment result screen
- 🟨 Create pending order through trusted RPC; final paid/confirmed transition remains provider-dependent
- ✅ View own orders
- ✅ View individual order details

## Admin — Dashboard
- 🟨 Authenticated admin shell
- 🟨 Product/category/inventory overview metrics
- ⬜ Sales information
- 🟨 Order information foundation
- 🟨 Payment information foundation
- 🟨 Inventory information
- ⬜ Recent activity

## Admin — Authorization
- 🟨 Explicit `admin_users` authorization table and database `is_admin()` helper
- 🟨 Trusted-only admin provisioning boundary
- 🟨 Admin login authorization check

## Admin — Products
- ✅ Add product
- ✅ Edit product
- ✅ Deactivate product
- ✅ Reactivate product
- 🟨 Delete product — UI deletion remains intentionally conservative until historical deletion policy is finalized
- ✅ Manage product information / pricing / availability

## Admin — Categories
- ✅ Create
- 🟨 Edit/manage existing categories
- ✅ Activate / deactivate

## Admin — Inventory
- ✅ View stock
- 🟨 Adjust stock through product management
- ✅ Low-stock information
- ✅ Product availability

## Admin — Orders
- 🟨 View orders
- ⬜ Search / filter orders
- ⬜ View individual admin order detail
- 🟨 View customer identity reference
- ⬜ Full delivery information view
- ⬜ Full order-item detail view
- 🟨 View payment status
- ⬜ Manage operational order status

## Admin — Payments / Transactions
- 🟨 View payment records
- 🟨 View transaction/provider references
- 🟨 View payment status
- 🟨 Associate payments with orders through database relationship

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

## Infrastructure / Integration
- 🟨 Trusted provider-neutral checkout boundary
- ⬜ Payment provider integration
- ⬜ Server-side payment verification
- ⬜ Resend transactional email
- 🟨 Clean public storefront routes
