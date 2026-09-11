-- Phase 2: admin authorization foundation.
-- Admin identity is an explicit database record. Never use client-controlled
-- auth metadata as an authorization source.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = target_user_id
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create policy "Admins can view own admin record"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- Admin catalogue policies. Authorization is evaluated by the database.
drop policy if exists "Admins can insert categories" on public.categories;
create policy "Admins can insert categories" on public.categories for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories" on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories" on public.categories for delete to authenticated using (public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products for delete to authenticated using (public.is_admin());

-- Admins may inspect operational records. Customers remain restricted to their
-- own records by the policies in 0003. Order status changes use a narrow
-- trusted function so payment truth cannot be changed by an admin UI request.
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;

create policy "Admins can view all order items" on public.order_items
  for select to authenticated using (public.is_admin());

create policy "Admins can view all reservations" on public.reservations
  for select to authenticated using (public.is_admin());

create policy "Admins can view all payments" on public.payments
  for select to authenticated using (public.is_admin());

create or replace function public.admin_update_order_status(
  target_order_id uuid,
  target_status text
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
    raise exception 'NOT_AUTHORIZED';
  end if;

  if target_status not in ('pending_payment', 'paid', 'processing', 'completed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.orders
  set status = target_status,
      updated_at = now()
  where id = target_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return updated_order;
end;
$$;

revoke all on function public.admin_update_order_status(uuid, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

-- Payment status is payment-provider truth. Browser/admin roles must never be
-- able to mutate it. A future trusted provider verification path uses the
-- service role to perform the transition.
create or replace function public.prevent_payment_status_tampering()
returns trigger
language plpgsql
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'PAYMENT_STATUS_TRUSTED_PATH_ONLY';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_payment_status_tampering on public.orders;
create trigger prevent_payment_status_tampering
  before update on public.orders
  for each row
  execute function public.prevent_payment_status_tampering();

-- Safe provisioning boundary. This function is intentionally not executable by
-- browser roles. Create the auth user first, then execute this from a trusted
-- SQL/service-role context. It also removes the automatically-created customer
-- profile so an admin account does not become a customer profile.
create or replace function public.provision_admin(target_user_id uuid, target_display_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_users (user_id, display_name)
  values (target_user_id, target_display_name)
  on conflict (user_id) do update set display_name = excluded.display_name;

  delete from public.customer_profiles where id = target_user_id;
end;
$$;

revoke all on function public.provision_admin(uuid, text) from public, anon, authenticated;

comment on table public.admin_users is 'Explicit admin authorization records. Membership must be provisioned from a trusted context.';
comment on function public.provision_admin(uuid, text) is 'Trusted-only admin provisioning boundary; do not expose to browser roles.';
