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
-- own records by the policies in 0003.
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items" on public.order_items for select to authenticated using (public.is_admin());

drop policy if exists "Admins can view all reservations" on public.reservations;
create policy "Admins can view all reservations" on public.reservations for select to authenticated using (public.is_admin());

drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments" on public.payments for select to authenticated using (public.is_admin());

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
