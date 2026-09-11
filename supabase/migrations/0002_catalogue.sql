-- Phase 1B: live catalogue foundation.
-- Product prices/inventory are authoritative in the database.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists categories_active_idx on public.categories(is_active);

alter table public.categories enable row level security;
alter table public.products enable row level security;

drop policy if exists "Anyone can view active categories" on public.categories;
create policy "Anyone can view active categories" on public.categories for select using (is_active = true);

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products for select using (is_active = true);

-- Admin write policies are intentionally deferred until the admin identity/role
-- model is implemented. Do not use client-controlled metadata for authorization.
