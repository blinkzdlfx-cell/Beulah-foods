-- Phase 2: admin authorization foundation.
-- Admin identity is stored separately from customer profile data.
-- Provision an admin by creating an auth user through the approved Supabase
-- dashboard flow, then inserting that user's UUID into admin_users. Never
-- trust client-supplied role metadata for authorization.

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view own admin record" on public.admin_users;
create policy "Admins can view own admin record"
  on public.admin_users
  for select
  using (auth.uid() = id and is_active = true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Catalogue administration.
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admin reporting access. Operational status changes use a trusted function
-- below rather than exposing broad client-side order updates.
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items"
  on public.order_items
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can view all reservations" on public.reservations;
create policy "Admins can view all reservations"
  on public.reservations
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments"
  on public.payments
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('pending_payment', 'paid', 'processing', 'completed', 'cancelled') then
    raise exception 'Invalid order status';
  end if;

  update public.orders
  set status = p_status,
      updated_at = now()
  where id = p_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order not found';
  end if;

  return updated_order;
end;
$$;

revoke all on function public.admin_update_order_status(uuid, text) from public;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

-- Admin users should never be able to alter payment truth from the browser.
-- Payment status remains controlled by the trusted payment verification path.
create or replace function public.prevent_payment_status_tampering()
returns trigger
language plpgsql
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and current_user <> 'service_role' then
    raise exception 'Payment status is controlled by the trusted payment verification path';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_payment_status_tampering on public.orders;
create trigger prevent_payment_status_tampering
  before update on public.orders
  for each row
  execute function public.prevent_payment_status_tampering();
