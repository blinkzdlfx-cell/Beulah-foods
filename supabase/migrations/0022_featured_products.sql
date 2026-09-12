-- Homepage merchandising: featured products are explicitly controlled by Admin.
-- Default false keeps existing catalogue products out of the featured section until selected.

alter table public.products
  add column if not exists is_featured boolean not null default false;

create index if not exists products_featured_active_idx
  on public.products(is_featured, is_active, sort_order, name);
