-- Phase 6: make stock_quantity the physical stock and reserved_quantity the held stock.
-- Storefront availability is always stock_quantity - reserved_quantity.
-- This prevents admin stock edits from being double-counted when reservations expire.

-- Convert existing rows from the old model, where stock_quantity represented
-- currently available stock, into physical stock without changing availability.
update public.products
set stock_quantity = stock_quantity + reserved_quantity,
    updated_at = now()
where reserved_quantity > 0;

alter table public.products
  drop constraint if exists products_stock_not_below_reserved;

alter table public.products
  add constraint products_stock_not_below_reserved
  check (stock_quantity >= reserved_quantity);

-- Reservation release now returns only the reservation counter. Physical stock
-- never changes until a successful payment consumes the reserved units.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer := 0;
  reservation_row record;
  item_row record;
begin
  for reservation_row in
    select r.id, r.order_id
      from public.reservations r
     where r.status = 'active'
       and r.expires_at <= now()
     for update
  loop
    for item_row in
      select product_id, quantity
        from public.order_items
       where order_id = reservation_row.order_id
         and product_id is not null
    loop
      update public.products
         set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
             updated_at = now()
       where id = item_row.product_id;
    end loop;

    update public.reservations
       set status = 'expired', updated_at = now()
     where id = reservation_row.id;

    update public.orders
       set status = 'cancelled', updated_at = now()
     where id = reservation_row.order_id
       and payment_status = 'pending';

    released := released + 1;
  end loop;

  return released;
end;
$$;

revoke all on function public.release_expired_reservations() from public, anon, authenticated;

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
  available_quantity integer;
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
    if v_delivery_enabled and delivery_row.delivery_fee is null then raise exception 'DELIVERY_CONFIGURATION_INVALID'; end if;
    if v_free_delivery_enabled and delivery_row.free_delivery_threshold is null then raise exception 'DELIVERY_CONFIGURATION_INVALID'; end if;
  end if;

  insert into public.orders (
    customer_id, status, payment_status, delivery_name, delivery_phone, delivery_address
  ) values (
    customer, 'pending_payment', 'pending', trim(delivery_name), trim(delivery_phone), trim(delivery_address)
  ) returning id into order_id;

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

    available_quantity := greatest(0, product_row.stock_quantity - product_row.reserved_quantity);
    if available_quantity < requested_quantity then
      raise exception 'INSUFFICIENT_STOCK:%', product_row.name;
    end if;

    item_total := round(product_row.price * requested_quantity, 2);
    v_subtotal := v_subtotal + item_total;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total
    ) values (
      order_id, product_row.id, product_row.name, product_row.price, requested_quantity, item_total
    );

    update public.products
       set reserved_quantity = reserved_quantity + requested_quantity,
           updated_at = now()
     where id = product_row.id;
  end loop;

  if v_delivery_enabled then
    v_delivery_fee := delivery_row.delivery_fee;
    if v_free_delivery_enabled and v_subtotal >= delivery_row.free_delivery_threshold then v_delivery_fee := 0; end if;
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

    if v_subtotal < promo_row.minimum_order_amount then raise exception 'PROMO_MINIMUM_NOT_MET:%', promo_row.minimum_order_amount; end if;

    if promo_row.discount_type = 'percentage' then
      v_discount := round(v_subtotal * promo_row.discount_value / 100, 2);
      if promo_row.maximum_discount_amount is not null then v_discount := least(v_discount, promo_row.maximum_discount_amount); end if;
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

create or replace function public.cancel_pending_order(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  order_row record;
  reservation_row record;
  item_row record;
  final_reservation_status text;
  was_released boolean := false;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;

  select id, customer_id, status, payment_status, promo_code
    into order_row
    from public.orders
   where id = target_order_id
   for update;

  if not found or order_row.customer_id <> customer then raise exception 'ORDER_NOT_FOUND'; end if;

  if order_row.payment_status <> 'pending' or order_row.status <> 'pending_payment' then
    if order_row.status = 'cancelled' and order_row.payment_status = 'pending' then
      return jsonb_build_object('order_id', order_row.id, 'status', 'cancelled', 'already_cancelled', true);
    end if;
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  select id, status, expires_at
    into reservation_row
    from public.reservations
   where order_id = order_row.id
   order by created_at desc
   limit 1
   for update;

  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  if reservation_row.status = 'active' then
    final_reservation_status := case when reservation_row.expires_at <= now() then 'expired' else 'cancelled' end;

    for item_row in
      select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null
    loop
      update public.products
         set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
             updated_at = now()
       where id = item_row.product_id;
    end loop;

    was_released := true;
    update public.reservations set status = final_reservation_status, updated_at = now() where id = reservation_row.id;

    if order_row.promo_code is not null then
      update public.promo_codes
         set usage_count = greatest(0, usage_count - 1), updated_at = now()
       where code = order_row.promo_code and usage_count > 0;
    end if;

    update public.orders set status = 'cancelled', updated_at = now() where id = order_row.id;
    return jsonb_build_object('order_id', order_row.id, 'status', 'cancelled', 'reservation_status', final_reservation_status, 'stock_released', was_released);
  end if;

  if reservation_row.status in ('expired', 'cancelled') then
    update public.orders set status = 'cancelled', updated_at = now() where id = order_row.id;
    return jsonb_build_object('order_id', order_row.id, 'status', 'cancelled', 'reservation_status', reservation_row.status, 'stock_released', false);
  end if;

  raise exception 'ORDER_NOT_CANCELLABLE';
end;
$$;

revoke all on function public.cancel_pending_order(uuid) from public, anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;

create or replace function public.retry_expired_pending_order(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  order_row record;
  reservation_row record;
  item_row record;
  released boolean := false;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;

  select id, customer_id, status, payment_status, promo_code
    into order_row
    from public.orders
   where id = target_order_id
   for update;

  if not found or order_row.customer_id <> customer then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.payment_status <> 'pending' then raise exception 'ORDER_NOT_RETRYABLE'; end if;
  if order_row.status not in ('pending_payment', 'cancelled') then raise exception 'ORDER_NOT_RETRYABLE'; end if;

  select id, status, expires_at
    into reservation_row
    from public.reservations
   where order_id = target_order_id
   order by created_at desc
   limit 1
   for update;

  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if reservation_row.status = 'active' and reservation_row.expires_at > now() then raise exception 'RESERVATION_STILL_ACTIVE'; end if;

  if reservation_row.status = 'active' then
    for item_row in
      select product_id, quantity from public.order_items where order_id = target_order_id and product_id is not null
    loop
      update public.products
         set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
             updated_at = now()
       where id = item_row.product_id;
    end loop;

    update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id and status = 'active';
    released := true;

    if order_row.promo_code is not null then
      update public.promo_codes
         set usage_count = greatest(0, usage_count - 1), updated_at = now()
       where code = order_row.promo_code and usage_count > 0;
    end if;
  elsif reservation_row.status not in ('expired', 'cancelled') then
    raise exception 'ORDER_NOT_RETRYABLE';
  end if;

  update public.orders set status = 'cancelled', updated_at = now() where id = target_order_id and payment_status = 'pending';
  return jsonb_build_object('order_id', target_order_id, 'status', 'cancelled', 'reservation_released', released);
end;
$$;

revoke all on function public.retry_expired_pending_order(uuid) from public, anon;
grant execute on function public.retry_expired_pending_order(uuid) to authenticated;

-- Successful payment consumes physical stock and releases the reservation.
-- Failed payment only releases the reservation.
create or replace function public.finalize_paystack_payment(
  target_reference text,
  target_status text,
  target_amount_kobo bigint,
  target_raw_response jsonb,
  target_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row record;
  order_row record;
  reservation_row record;
  item_row record;
  expected_amount_kobo bigint;
  final_status text := lower(target_status);
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'TRUSTED_PAYMENT_PATH_ONLY'; end if;
  if final_status not in ('success','failed') then raise exception 'INVALID_PAYMENT_STATUS'; end if;

  select p.id, p.order_id, p.status, p.amount
    into payment_row
    from public.payments p
   where p.provider = 'paystack' and p.provider_reference = target_reference
   for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  expected_amount_kobo := round(payment_row.amount * 100)::bigint;
  if target_amount_kobo is not null and target_amount_kobo <> expected_amount_kobo then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;

  select * into order_row from public.orders where id = payment_row.order_id for update;
  select * into reservation_row from public.reservations where order_id = order_row.id for update;

  if final_status = 'success' then
    if payment_row.status = 'successful' then return jsonb_build_object('order_id', order_row.id, 'payment_status', 'successful', 'already_processed', true); end if;

    update public.payments set status = 'successful', raw_response = target_raw_response, updated_at = now() where id = payment_row.id;
    update public.orders set payment_status = 'successful', status = 'paid', updated_at = now() where id = order_row.id;

    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null
      loop
        update public.products
           set stock_quantity = greatest(0, stock_quantity - item_row.quantity),
               reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
               updated_at = now()
         where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'confirmed', updated_at = now() where id = reservation_row.id;
    end if;
  else
    if payment_row.status = 'failed' then return jsonb_build_object('order_id', order_row.id, 'payment_status', 'failed', 'already_processed', true); end if;

    update public.payments set status = 'failed', raw_response = target_raw_response, updated_at = now() where id = payment_row.id;

    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null
      loop
        update public.products
           set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
               updated_at = now()
         where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id;
    end if;

    update public.orders set payment_status = 'failed', status = 'cancelled', updated_at = now() where id = order_row.id;
  end if;

  return jsonb_build_object('order_id', order_row.id, 'payment_status', case when final_status = 'success' then 'successful' else 'failed' end, 'already_processed', false);
end;
$$;

revoke all on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) to service_role;
