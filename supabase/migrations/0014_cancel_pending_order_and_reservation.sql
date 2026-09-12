-- Customer-controlled cancellation for pending payment reservations.
-- Releases reserved stock, restores promo usage, and keeps the order/payment
-- history visible as cancelled/pending instead of deleting the purchase attempt.
-- Expired reservations are marked expired; explicit customer cancellation is
-- marked cancelled. Both paths restore stock exactly once.

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
  if customer is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select id, customer_id, status, payment_status, promo_code
    into order_row
    from public.orders
    where id = target_order_id
    for update;

  if not found or order_row.customer_id <> customer then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.payment_status <> 'pending' or order_row.status <> 'pending_payment' then
    if order_row.status = 'cancelled' and order_row.payment_status = 'pending' then
      return jsonb_build_object(
        'order_id', order_row.id,
        'status', 'cancelled',
        'already_cancelled', true
      );
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

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if reservation_row.status = 'active' then
    if reservation_row.expires_at <= now() then
      final_reservation_status := 'expired';
    else
      final_reservation_status := 'cancelled';
    end if;

    for item_row in
      select product_id, quantity
      from public.order_items
      where order_id = order_row.id
        and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + item_row.quantity,
          reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
          updated_at = now()
      where id = item_row.product_id;
    end loop;

    was_released := true;

    update public.reservations
    set status = final_reservation_status,
        updated_at = now()
    where id = reservation_row.id;

    if order_row.promo_code is not null then
      update public.promo_codes
      set usage_count = greatest(0, usage_count - 1),
          updated_at = now()
      where code = order_row.promo_code
        and usage_count > 0;
    end if;

    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = order_row.id;

    return jsonb_build_object(
      'order_id', order_row.id,
      'status', 'cancelled',
      'reservation_status', final_reservation_status,
      'stock_released', was_released
    );
  end if;

  if reservation_row.status in ('expired', 'cancelled') then
    update public.orders
    set status = 'cancelled',
        updated_at = now()
    where id = order_row.id;

    return jsonb_build_object(
      'order_id', order_row.id,
      'status', 'cancelled',
      'reservation_status', reservation_row.status,
      'stock_released', false
    );
  end if;

  raise exception 'ORDER_NOT_CANCELLABLE';
end;
$$;

revoke all on function public.cancel_pending_order(uuid) from public, anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
