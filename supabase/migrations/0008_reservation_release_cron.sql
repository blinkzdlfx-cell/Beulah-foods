-- Phase 2: automatic reservation expiry cleanup.
-- Supabase projects with pg_cron enabled can run this every five minutes.

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
      select product_id, quantity from public.order_items where order_id = reservation_row.order_id and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + item_row.quantity,
          reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
          updated_at = now()
      where id = item_row.product_id;
    end loop;

    update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id;
    update public.orders set status = 'cancelled', updated_at = now() where id = reservation_row.order_id and payment_status = 'pending';

    update public.promo_codes p
    set usage_count = greatest(0, usage_count - 1), updated_at = now()
    where p.code = (select o.promo_code from public.orders o where o.id = reservation_row.order_id)
      and p.usage_count > 0;

    released := released + 1;
  end loop;
  return released;
end;
$$;

revoke all on function public.release_expired_reservations() from public, anon, authenticated;

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

  select p.id, p.order_id, p.status, p.amount into payment_row
  from public.payments p where p.provider = 'paystack' and p.provider_reference = target_reference for update;
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
      for item_row in select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null loop
        update public.products set reserved_quantity = greatest(0, reserved_quantity - item_row.quantity), updated_at = now() where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'confirmed', updated_at = now() where id = reservation_row.id;
    end if;
  else
    if payment_row.status = 'failed' then return jsonb_build_object('order_id', order_row.id, 'payment_status', 'failed', 'already_processed', true); end if;
    update public.payments set status = 'failed', raw_response = target_raw_response, updated_at = now() where id = payment_row.id;
    if reservation_row.id is not null and reservation_row.status = 'active' then
      for item_row in select product_id, quantity from public.order_items where order_id = order_row.id and product_id is not null loop
        update public.products set stock_quantity = stock_quantity + item_row.quantity, reserved_quantity = greatest(0, reserved_quantity - item_row.quantity), updated_at = now() where id = item_row.product_id;
      end loop;
      update public.reservations set status = 'expired', updated_at = now() where id = reservation_row.id;
    end if;
    update public.promo_codes p set usage_count = greatest(0, usage_count - 1), updated_at = now() where p.code = order_row.promo_code and p.usage_count > 0;
    update public.orders set payment_status = 'failed', status = 'cancelled', updated_at = now() where id = order_row.id;
  end if;

  return jsonb_build_object('order_id', order_row.id, 'payment_status', case when final_status = 'success' then 'successful' else 'failed' end, 'already_processed', false);
end;
$$;

revoke all on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_paystack_payment(text, text, bigint, jsonb, timestamptz) to service_role;

-- The extension and schedule are intentionally idempotent. If pg_cron is not
-- available on the target project, the migration should be applied after
-- enabling it in Supabase, or the equivalent scheduled invocation can be used.
create extension if not exists pg_cron with schema extensions;
select cron.schedule('beulah-release-expired-reservations', '*/5 * * * *', $$select public.release_expired_reservations();$$)
where not exists (select 1 from cron.job where jobname = 'beulah-release-expired-reservations');
