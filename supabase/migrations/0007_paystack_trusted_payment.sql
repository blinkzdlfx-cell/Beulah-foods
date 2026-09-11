-- Phase 2: trusted Paystack payment finalization.
-- Browser redirects/callbacks never directly change payment truth.

create unique index if not exists payments_provider_reference_idx
  on public.payments(provider_reference)
  where provider_reference is not null;

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
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'TRUSTED_PAYMENT_PATH_ONLY';
  end if;

  if final_status not in ('success','failed') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  select p.id, p.order_id, p.status, p.amount
    into payment_row
    from public.payments p
    where p.provider = 'paystack' and p.provider_reference = target_reference
    for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  expected_amount_kobo := round(payment_row.amount * 100)::bigint;
  if target_amount_kobo is not null and target_amount_kobo <> expected_amount_kobo then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  select * into order_row from public.orders where id = payment_row.order_id for update;
  select * into reservation_row from public.reservations where order_id = order_row.id for update;

  if final_status = 'success' then
    if payment_row.status = 'successful' then
      return jsonb_build_object('order_id', order_row.id, 'payment_status', 'successful', 'already_processed', true);
    end if;

    update public.payments
      set status = 'successful', raw_response = target_raw_response, updated_at = now()
      where id = payment_row.id;

    update public.orders
      set payment_status = 'successful', status = 'paid', updated_at = now()
      where id = order_row.id;

    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in
        select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null
      loop
        update public.products
        set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity), updated_at = now()
        where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'confirmed', updated_at = now() where id = reservation_row.id;
    end if;
  else
    if payment_row.status = 'failed' then
      return jsonb_build_object('order_id', order_row.id, 'payment_status', 'failed', 'already_processed', true);
    end if;

    update public.payments
      set status = 'failed', raw_response = target_raw_response, updated_at = now()
      where id = payment_row.id;

    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in
        select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null
      loop
        update public.products
        set stock_quantity = stock_quantity + item_row.quantity,
            reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
            updated_at = now()
        where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id;
    end if;

    update public.orders
      set payment_status = 'failed', status = 'cancelled', updated_at = now()
      where id = order_row.id;
  end if;

  return jsonb_build_object('order_id', order_row.id, 'payment_status', case when final_status = 'success' then 'successful' else 'failed' end, 'already_processed', false);
end;
$$;

revoke all on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) from public, anon, authenticated;
-- Service-role requests bypass RLS and may execute this trusted boundary.
grant execute on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) to service_role;

comment on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) is 'Trusted-only Paystack payment finalization. Verifies expected amount, updates payment/order truth, and confirms/releases the stock reservation.';
