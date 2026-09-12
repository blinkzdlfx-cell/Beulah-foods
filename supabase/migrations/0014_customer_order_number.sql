-- Give every order one stable Beulah Foods customer-facing number.
-- Example: BF-58030001
-- Paystack references remain separate provider transaction identifiers.

create sequence if not exists public.beulah_order_number_seq
  start with 58030001
  increment by 1;

alter table public.orders
  add column if not exists order_number text;

update public.orders
set order_number = 'BF-' || nextval('public.beulah_order_number_seq')::text
where order_number is null;

alter table public.orders
  alter column order_number set not null;

create unique index if not exists orders_order_number_uidx
  on public.orders(order_number);

alter table public.orders
  alter column order_number set default ('BF-' || nextval('public.beulah_order_number_seq')::text);

comment on column public.orders.order_number is
  'Stable customer-facing Beulah Foods order number. Paystack provider_reference remains separate.';

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
  order_number_value text;
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
  v_delivery_enabled boolean := false;
  v_free_delivery_enabled boolean := false;
  v_promo_code text := null;
  v_promo_discount_type text := null;
  v_promo_discount_value numeric(12,2) := null;
  v_promo_minimum_order numeric(12,2) := null;
  v_promo_maximum_discount numeric(12,2) := null;
  normalized_promo text := nullif(lower(trim(coalesce(requested_promo_code, ''))), '');
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(delivery_name), '') is null
     or nullif(trim(delivery_phone), '') is null
     or nullif(trim(delivery_address), '') is null then
    raise exception 'DELIVERY_DETAILS_REQUIRED';
  end if;
  if jsonb_typeof(cart_items) <> 'array' or jsonb_array_length(cart_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  perform public.release_expired_reservations();

  select delivery_fee, free_delivery_threshold, is_delivery_enabled, is_free_delivery_enabled
    into delivery_row
    from public.delivery_settings
    where is_active = true
    order by updated_at desc
    limit 1;

  if found then
    v_delivery_enabled := coalesce(delivery_row.is_delivery_enabled, false);
    v_free_delivery_enabled := coalesce(delivery_row.is_free_delivery_enabled, false);
    if v_delivery_enabled and delivery_row.delivery_fee is null then
      raise exception 'DELIVERY_CONFIGURATION_INVALID';
    end if;
    if v_free_delivery_enabled and delivery_row.free_delivery_threshold is null then
      raise exception 'DELIVERY_CONFIGURATION_INVALID';
    end if;
  end if;

  insert into public.orders (
    customer_id, status, payment_status, delivery_name, delivery_phone, delivery_address
  )
  values (
    customer, 'pending_payment', 'pending', trim(delivery_name), trim(delivery_phone), trim(delivery_address)
  )
  returning id, order_number into order_id, order_number_value;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    requested_quantity := (item ->> 'quantity')::integer;
    if requested_quantity is null or requested_quantity <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select id, name, price, stock_quantity, reserved_quantity, is_active
      into product_row
      from public.products
      where id = (item ->> 'productId')::uuid
      for update;

    if not found or not product_row.is_active then
      raise exception 'PRODUCT_UNAVAILABLE:%', item ->> 'productId';
    end if;
    if product_row.stock_quantity < requested_quantity then
      raise exception 'INSUFFICIENT_STOCK:%', product_row.name;
    end if;

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

  if v_delivery_enabled then
    v_delivery_fee := delivery_row.delivery_fee;
    if v_free_delivery_enabled and v_subtotal >= delivery_row.free_delivery_threshold then
      v_delivery_fee := 0;
    end if;
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
    v_promo_code := promo_row.code;
    v_promo_discount_type := promo_row.discount_type;
    v_promo_discount_value := promo_row.discount_value;
    v_promo_minimum_order := promo_row.minimum_order_amount;
    v_promo_maximum_discount := promo_row.maximum_discount_amount;

    if v_subtotal < promo_row.minimum_order_amount then
      raise exception 'PROMO_MINIMUM_NOT_MET:%', promo_row.minimum_order_amount;
    end if;

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
      promo_code = v_promo_code,
      promo_discount_type = v_promo_discount_type,
      promo_discount_value = v_promo_discount_value,
      promo_minimum_order = v_promo_minimum_order,
      promo_maximum_discount = v_promo_maximum_discount,
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
    'order_number', order_number_value,
    'reservation_id', reservation_id,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'delivery_enabled', v_delivery_enabled,
    'free_delivery_enabled', v_free_delivery_enabled,
    'discount', v_discount,
    'total', v_total,
    'promo_code', v_promo_code,
    'expires_at', v_expires_at
  );
exception when others then
  if order_id is not null then delete from public.orders where id = order_id; end if;
  raise;
end;
$$;

revoke all on function public.create_pending_order(jsonb, text, text, text, text) from public, anon;
grant execute on function public.create_pending_order(jsonb, text, text, text, text) to authenticated;
