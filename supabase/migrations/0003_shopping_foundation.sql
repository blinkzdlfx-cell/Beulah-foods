-- Phase 2: order/reservation/payment foundation.
-- No payment provider is assumed here. The checkout UI must not claim payment success.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','processing','completed','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','successful','failed')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  fees numeric(12,2) not null default 0 check (fees >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  delivery_name text not null,
  delivery_phone text not null,
  delivery_address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired','confirmed')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','successful','failed')),
  amount numeric(12,2) not null check (amount >= 0),
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists reservations_expires_at_idx on public.reservations(expires_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;

create policy "Customers can view own orders" on public.orders for select using (auth.uid() = customer_id);
create policy "Customers can view own order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.customer_id = auth.uid()));
create policy "Customers can view own reservations" on public.reservations for select using (exists (select 1 from public.orders o where o.id = reservations.order_id and o.customer_id = auth.uid()));
create policy "Customers can view own payments" on public.payments for select using (exists (select 1 from public.orders o where o.id = payments.order_id and o.customer_id = auth.uid()));

-- Order creation, stock reservation, fee calculation and payment initialization
-- must be completed by trusted server/RPC logic after the payment provider is chosen.
-- Do not create orders directly from the browser using client-supplied prices.
