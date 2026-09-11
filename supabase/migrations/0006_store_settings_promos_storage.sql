-- Phase 2: store settings, promo codes, and product image storage.
-- All checkout pricing remains database-authoritative.

alter table public.orders
  add column if not exists delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column if not exists promo_code text,
  add column if not exists promo_discount_type text,
  add column if not exists promo_discount_value numeric(12,2),
  add column if not exists promo_minimum_order numeric(12,2),
  add column if not exists promo_maximum_discount numeric(12,2);

create table if not exists public.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  free_delivery_threshold numeric(12,2) not null check (free_delivery_threshold >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_settings_one_active_idx
  on public.delivery_settings (is_active)
  where is_active;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  maximum_discount_amount numeric(12,2) check (maximum_discount_amount is null or maximum_discount_amount > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_dates_valid check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create unique index if not exists promo_codes_code_lower_idx on public.promo_codes (lower(code));
create unique index if not exists promo_codes_one_active_code_idx
  on public.promo_codes (lower(code))
  where is_active;

alter table public.delivery_settings enable row level security;
alter table public.promo_codes enable row level security;

drop policy if exists "Anyone can view active delivery settings" on public.delivery_settings;
create policy "Anyone can view active delivery settings"
  on public.delivery_settings for select using (is_active = true);

drop policy if exists "Admins can manage delivery settings" on public.delivery_settings;
create policy "Admins can manage delivery settings"
  on public.delivery_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can validate active promo codes" on public.promo_codes;
create policy "Anyone can validate active promo codes"
  on public.promo_codes for select using (is_active = true);

drop policy if exists "Admins can manage promo codes" on public.promo_codes;
create policy "Admins can manage promo codes"
  on public.promo_codes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Product images are stored in Supabase Storage. The browser never receives a
-- service-role key. Public storefront reads are allowed; mutations require an admin.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- Extend the trusted checkout boundary with delivery and promo rules.
drop function if exists public.create_pending_order(jsonb, text, text, text);

create or replace function public.create_pending_order(
  cart_items jsonb,
  delivery_name text,
  delivery_phone text,
  delivery_address text,
  requested_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  order_id uuid;
  reservation_id uuid;
  item jsonb;
  product_row record;
  promo_row record;
  delivery_row record;
  requested_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  item_total numeric(12,2);
  v_expires_at timestamptz;
  normalized_promo text := nullif(lower(trim(coalesce(requested_promo_code, ''))), '');
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(delivery_name), '') is null or nullif(trim(delivery_phone), '') is null or nullif(trim(delivery_address), '') is null then
    raise exception 'DELIVERY_DETAILS_REQUIRED';
  end if;
  if jsonb_typeof(cart_items) <> 'array' or jsonb_array_length(cart_items) = 0 then raise exception 'CART_EMPTY'; end if;

  perform public.release_expired_reservations();

  select delivery_fee, free_delivery_threshold
    into delivery_row
    from public.delivery_settings
    where is_active = true
    order by updated_at desc
    limit 1;

  if not found then raise exception 'DELIVERY_NOT_CONFIGURED'; end if;

  insert into public.orders (customer_id, status, payment_status, delivery_name, delivery_phone, delivery_address)
  values (customer, 'pending_payment', 'pending', trim(delivery_name), trim(delivery_phone), trim(delivery_address))
  returning id into order_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    requested_quantity := (item ->> 'quantity')::integer;
    if requested_quantity is null or requested_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;

    select id, name, price, stock_quantity, reserved_quantity, is_active
      into product_row
      from public.products
      where id = (item ->> 'productId')::uuid
      for update;

    if not found or not product_row.is_active then raise exception 'PRODUCT_UNAVAILABLE:%', item ->> 'productId'; end if;
    if product_row.stock_quantity < requested_quantity then raise exception 'INSUFFICIENT_STOCK:%', product_row.name; end if;

    item_total := round(product_row.price * requested_quantity, 2);
    v_subtotal := v_subtotal + item_total;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (order_id, product_row.id, product_row.name, product_row.price, requested_quantity, item_total);

    update public.products
    set stock_quantity = stock_quantity - requested_quantity,
        reserved_quantity = reserved_quantity + requested_quantity,
        updated_at = now()
    where id = product_row.id;
  end loop;

  if v_subtotal < delivery_row.free_delivery_threshold then
    v_delivery_fee := delivery_row.delivery_fee;
  end if;

  if normalized_promo is not null then
    select * into promo_row
    from public.promo_codes
    where lower(code) = normalized_promo
      and is_active = true
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at >= now())
      and (usage_limit is null or usage_count < usage_limit)
    for update;

    if not found then raise exception 'PROMO_INVALID'; end if;
    if v_subtotal < promo_row.minimum_order_amount then raise exception 'PROMO_MINIMUM_NOT_MET:%', promo_row.minimum_order_amount; end if;

    if promo_row.discount_type = 'percentage' then
      v_discount := round(v_subtotal * promo_row.discount_value / 100, 2);
      if promo_row.maximum_discount_amount is not null then
        v_discount := least(v_discount, promo_row.maximum_discount_amount);
      end if;
    else
      v_discount := least(promo_row.discount_value, v_subtotal);
    end if;

    update public.promo_codes
    set usage_count = usage_count + 1, updated_at = now()
    where id = promo_row.id;
  end if;

  v_total := greatest(0, round(v_subtotal + v_delivery_fee - v_discount, 2));

  update public.orders
  set subtotal = v_subtotal,
      fees = v_delivery_fee,
      delivery_fee = v_delivery_fee,
      discount_amount = v_discount,
      promo_code = case when promo_row.id is not null then promo_row.code else null end,
      promo_discount_type = case when promo_row.id is not null then promo_row.discount_type else null end,
      promo_discount_value = case when promo_row.id is not null then promo_row.discount_value else null end,
      promo_minimum_order = case when promo_row.id is not null then promo_row.minimum_order_amount else null end,
      promo_maximum_discount = case when promo_row.id is not null then promo_row.maximum_discount_amount else null end,
      total = v_total,
      updated_at = now()
  where id = order_id;

  v_expires_at := now() + interval '15 minutes';
  insert into public.reservations (order_id, status, expires_at)
  values (order_id, 'active', v_expires_at)
  returning id into reservation_id;

  insert into public.payments (order_id, provider, status, amount)
  values (order_id, 'paystack', 'pending', v_total);

  return jsonb_build_object(
    'order_id', order_id,
    'reservation_id', reservation_id,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount', v_discount,
    'total', v_total,
    'promo_code', case when promo_row.id is not null then promo_row.code else null end,
    'expires_at', v_expires_at
  );
exception when others then
  if order_id is not null then delete from public.orders where id = order_id; end if;
  raise;
end;
$$;

revoke all on function public.create_pending_order(jsonb, text, text, text, text) from public, anon;
grant execute on function public.create_pending_order(jsonb, text, text, text, text) to authenticated;

comment on table public.delivery_settings is 'Admin-controlled delivery fee and free-delivery threshold settings.';
comment on table public.promo_codes is 'Admin-controlled promotional discounts enforced by trusted checkout.';
