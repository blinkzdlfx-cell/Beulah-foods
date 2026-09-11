-- 0001_customer_profiles.sql
--
-- Feature: CUSTOMER AUTHENTICATION
--
-- Auth identity (email, password hash, sessions) lives entirely in
-- Supabase's built-in `auth.users` table — nothing here duplicates or
-- stores that. This table holds ONLY the customer-facing profile
-- fields needed so far: name, phone, address.
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once a
-- project exists. See supabase/README.md for full setup steps.

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_profiles is
  'Customer-facing profile data only. Auth identity (email, password, sessions) stays in auth.users and is never duplicated here.';

alter table public.customer_profiles enable row level security;

-- A customer can see only their own profile row.
create policy "Customers can view own profile"
  on public.customer_profiles
  for select
  using (auth.uid() = id);

-- A customer can update only their own profile row.
create policy "Customers can update own profile"
  on public.customer_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Intentionally no INSERT or DELETE policy for customers:
--   - Rows are created automatically by the trigger below, not by a
--     direct client insert.
--   - Customers cannot delete their own profile row from the browser.
-- Row Level Security defaults to "deny" for any action without a
-- matching policy, so both are blocked without extra rules.

-- Keep updated_at accurate on every update, automatically.
create or replace function public.set_customer_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customer_profiles_set_updated_at
  before update on public.customer_profiles
  for each row
  execute function public.set_customer_profile_updated_at();

-- Auto-create a profile row the moment an account is created.
--
-- This runs as SECURITY DEFINER (elevated privilege), which is why it
-- can insert even before the customer has an active session (e.g.
-- before they've confirmed their email) — it does not go through the
-- RLS policies above, by design. This is the one place a
-- customer_profiles row is allowed to be created.
--
-- IMPORTANT: this fires for every new row in auth.users, with no role
-- check. Earlier this checked a `role: "customer"` value the client
-- passed in at signup — that was removed on purpose. Auth metadata set
-- by the signup request is browser-controlled input; it cannot be
-- trusted to decide something a database trigger relies on. Right now
-- every account is created through the customer signup flow, so
-- "every new auth.users row is a customer" is true and safe.
--
-- Admin authorization has not been designed yet. Whatever that design
-- turns out to be — a separate table, a server-side-only flag, a
-- distinct signup path — THIS TRIGGER MUST BE REVISITED before admin
-- accounts can be created, so it doesn't also stamp a customer_profiles
-- row onto an admin account. Do not reintroduce a client-supplied
-- role/flag as the fix.
--
-- full_name IS read from client-supplied auth metadata here, and that
-- is intentional and fine: unlike a role/permission flag, a display
-- name carries no security meaning, so there's nothing to "trust" —
-- worst case a customer enters a silly name for their own account.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row
  execute function public.handle_new_customer();
