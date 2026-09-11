-- Phase 2: trusted checkout foundation.
-- Provider-neutral: creates a pending-payment order and a 15-minute stock reservation.
-- Payment initialization/verification is intentionally not included.

alter table public.products
  add column if not exists reserved_quantity integer not null default 0 check (reserved_quantity >= 0);

create index if not exists products_available_stock_idx on public.products(stock_quantity, reserved_quantity);

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
    where r.status = 'active' and r.expires_at <= now()
    for update
  loop
    for item_row in
      select product_id, quantity
      from public.order_items
      where order_id = reservation_row.order_id and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + item_row.quantity,
          reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
          updated_at = now()
      where id = item_row.product_id;
    end loop;

    update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id;
    update public.orders set status = 'cancelled', updated_at = now() where id = reservation_row.order_id and payment_status = 'pending';
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
  delivery_address text
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
  requested_quantity integer;
  v_subtotal numeric(12,2) := 0;
  item_total numeric(12,2);
  v_expires_at timestamptz;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(delivery_name), '') is null or nullif(trim(delivery_phone), '') is null or nullif(trim(delivery_address), '') is null then
    raise exception 'DELIVERY_DETAILS_REQUIRED';
  end if;
  if jsonb_typeof(cart_items) <> 'array' or jsonb_array_length(cart_items) = 0 then raise exception 'CART_EMPTY'; end if;

  perform public.release_expired_reservations();

  insert into public.orders (customer_id, status, payment_status, delivery_name, delivery_phone, delivery_address)
  values (customer, 'pending_payment', 'pending', trim(delivery_name), trim(delivery_phone), trim(delivery_address))
  returning id into order_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    requested_quantity := greatest(1, (item ->> 'quantity')::integer);
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

  -- Fees remain zero until explicit store fee rules are approved/configured.
  update public.orders
  set subtotal = v_subtotal, fees = 0, total = v_subtotal, updated_at = now()
  where id = order_id;

  v_expires_at := now() + interval '15 minutes';
  insert into public.reservations (order_id, status, expires_at)
  values (order_id, 'active', v_expires_at)
  returning id into reservation_id;

  insert into public.payments (order_id, status, amount)
  values (order_id, 'pending', v_subtotal);

  return jsonb_build_object('order_id', order_id, 'reservation_id', reservation_id, 'subtotal', v_subtotal, 'fees', 0, 'total', v_subtotal, 'expires_at', v_expires_at);
exception when others then
  if order_id is not null then
    delete from public.orders where id = order_id;
  end if;
  raise;
end;
$$;

revoke all on function public.create_pending_order(jsonb, text, text, text) from public, anon;
grant execute on function public.create_pending_order(jsonb, text, text, text) to authenticated;

comment on function public.create_pending_order(jsonb, text, text, text) is 'Trusted order creation: rechecks live prices/stock, snapshots items, reserves stock for 15 minutes, and creates a pending payment. No payment success is asserted.';
