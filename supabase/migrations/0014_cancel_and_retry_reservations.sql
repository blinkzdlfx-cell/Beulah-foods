-- Allow an authenticated customer to cancel only their own pending payment reservation.
-- Cancellation returns reserved stock to available stock and rolls back promo usage.
-- The order remains in history as cancelled; the browser cart is untouched.

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
  released boolean := false;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;

  select id, customer_id, status, payment_status, promo_code
    into order_row
    from public.orders
   where id = target_order_id
   for update;

  if not found or order_row.customer_id <> customer then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.status <> 'pending_payment' or order_row.payment_status <> 'pending' then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  select id, status, expires_at
    into reservation_row
    from public.reservations
   where order_id = target_order_id
   for update;

  if found and reservation_row.status = 'active' then
    for item_row in
      select product_id, quantity
        from public.order_items
       where order_id = target_order_id
         and product_id is not null
    loop
      update public.products
         set stock_quantity = stock_quantity + item_row.quantity,
             reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
             updated_at = now()
       where id = item_row.product_id;
    end loop;

    update public.reservations
       set status = 'expired', updated_at = now()
     where id = reservation_row.id;
    released := true;

    update public.promo_codes p
       set usage_count = greatest(0, usage_count - 1), updated_at = now()
     where p.code = order_row.promo_code
       and p.usage_count > 0;
  end if;

  update public.orders
     set status = 'cancelled', updated_at = now()
   where id = target_order_id;

  return jsonb_build_object(
    'order_id', target_order_id,
    'status', 'cancelled',
    'reservation_released', released
  );
end;
$$;

revoke all on function public.cancel_pending_order(uuid) from public, anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
