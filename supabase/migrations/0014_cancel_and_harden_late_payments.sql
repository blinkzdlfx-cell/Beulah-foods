-- Customer cancellation and late-payment hardening for 15-minute reservations.
-- Cancellation is idempotent for an already-released pending order.

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
  restored boolean := false;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into order_row
  from public.orders
  where id = target_order_id and customer_id = customer
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  select * into reservation_row
  from public.reservations
  where order_id = target_order_id
  for update;

  if order_row.status = 'cancelled' and order_row.payment_status = 'pending'
     and (reservation_row.id is null or reservation_row.status = 'expired') then
    return jsonb_build_object('order_id', target_order_id, 'status', 'cancelled', 'already_cancelled', true);
  end if;

  if order_row.status <> 'pending_payment' or order_row.payment_status <> 'pending' then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  if reservation_row.id is not null and reservation_row.status = 'active' then
    for item_row in
      select product_id, quantity
      from public.order_items
      where order_id = target_order_id and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + item_row.quantity,
          reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
          updated_at = now()
      where id = item_row.product_id;
    end loop;
    update public.reservations
    set status = 'expired', updated_at = now()
    where id = reservation_row.id and status = 'active';
    restored := true;

    update public.promo_codes p
    set usage_count = greatest(0, usage_count - 1), updated_at = now()
    where p.code = order_row.promo_code and p.usage_count > 0;
  end if;

  update public.orders
  set status = 'cancelled', updated_at = now()
  where id = target_order_id and status = 'pending_payment' and payment_status = 'pending';

  return jsonb_build_object(
    'order_id', target_order_id,
    'status', 'cancelled',
    'already_cancelled', false,
    'stock_restored', restored
  );
end;
$$;

revoke all on function public.cancel_pending_order(uuid) from public, anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;

-- Harden Paystack finalization so late success events cannot resurrect an expired/cancelled order.
-- The payment remains truthful as successful, while the order remains cancelled for manual refund/handling.
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
  late_payment boolean := false;
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

  if payment_row.status = 'successful' then
    return jsonb_build_object('order_id', order_row.id, 'payment_status', 'successful', 'order_status', order_row.status, 'already_processed', true, 'late_payment', order_row.status = 'cancelled');
  end if;

  if final_status = 'success' then
    if order_row.status <> 'pending_payment'
       or reservation_row.id is null
       or reservation_row.status <> 'active'
       or reservation_row.expires_at <= now() then
      -- The provider confirms money was received, but the reservation is no longer valid.
      -- Release any still-active reservation exactly once before leaving the order cancelled.
      if reservation_row.id is not null and reservation_row.status = 'active' then
        for item_row in
          select product_id, quantity
          from public.order_items
          where order_id = order_row.id and product_id is not null
        loop
          update public.products
          set stock_quantity = stock_quantity + item_row.quantity,
              reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
              updated_at = now()
          where id = item_row.product_id;
        end loop;
        update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id and status = 'active';
        update public.promo_codes p
        set usage_count = greatest(0, usage_count - 1), updated_at = now()
        where p.code = order_row.promo_code and p.usage_count > 0;
      end if;

      update public.payments
      set status = 'successful', raw_response = target_raw_response, updated_at = now()
      where id = payment_row.id;
      update public.orders
      set payment_status = 'successful', status = 'cancelled', updated_at = now()
      where id = order_row.id;
      late_payment := true;

      return jsonb_build_object(
        'order_id', order_row.id,
        'payment_status', 'successful',
        'order_status', 'cancelled',
        'already_processed', false,
        'late_payment', late_payment
      );
    end if;

    update public.payments
    set status = 'successful', raw_response = target_raw_response, updated_at = now()
    where id = payment_row.id;
    update public.orders
    set payment_status = 'successful', status = 'paid', updated_at = now()
    where id = order_row.id;

    for item_row in
      select product_id, quantity
      from public.order_items
      where order_id = order_row.id and product_id is not null
    loop
      update public.products
      set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity), updated_at = now()
      where id = item_row.product_id;
    end loop;
    update public.reservations set status = 'confirmed', updated_at = now() where id = reservation_row.id and status = 'active';

  else
    if payment_row.status = 'failed' then
      return jsonb_build_object('order_id', order_row.id, 'payment_status', 'failed', 'order_status', order_row.status, 'already_processed', true, 'late_payment', false);
    end if;

    update public.payments
    set status = 'failed', raw_response = target_raw_response, updated_at = now()
    where id = payment_row.id;

    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in
        select product_id, quantity
        from public.order_items
        where order_id = order_row.id and product_id is not null
      loop
        update public.products
        set stock_quantity = stock_quantity + item_row.quantity,
            reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
            updated_at = now()
        where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id and status = 'active';
      update public.promo_codes p
      set usage_count = greatest(0, usage_count - 1), updated_at = now()
      where p.code = order_row.promo_code and p.usage_count > 0;
    end if;

    update public.orders
    set payment_status = 'failed', status = 'cancelled', updated_at = now()
    where id = order_row.id and payment_status = 'pending';
  end if;

  return jsonb_build_object(
    'order_id', order_row.id,
    'payment_status', case when final_status = 'success' then 'successful' else 'failed' end,
    'order_status', case when final_status = 'success' then 'paid' else 'cancelled' end,
    'already_processed', false,
    'late_payment', false
  );
end;
$$;

revoke all on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) to service_role;
