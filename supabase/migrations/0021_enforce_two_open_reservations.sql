-- Phase 5 correction: enforce the two-open-reservation policy at the
-- reservation boundary used by the existing 5-argument checkout RPC.
-- Migration 0020 accidentally created a 4-argument overload, while the
-- storefront calls the existing 5-argument function. Remove that overload.

drop function if exists public.create_pending_order(jsonb, text, text, text);

create or replace function public.enforce_two_open_reservations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid;
  open_reservations integer := 0;
begin
  select customer_id into customer
    from public.orders
   where id = new.order_id;

  if customer is null then
    raise exception 'ORDER_CUSTOMER_NOT_FOUND';
  end if;

  -- Serialize reservation creation for the customer. This prevents two
  -- simultaneous checkout attempts from both passing the count.
  perform pg_advisory_xact_lock(hashtextextended(customer::text, 0));

  -- Expire genuinely elapsed reservations before counting open reservations.
  perform public.release_expired_reservations();

  select count(*)::integer
    into open_reservations
    from public.reservations r
    join public.orders o on o.id = r.order_id
   where o.customer_id = customer
     and o.payment_status = 'pending'
     and o.status = 'pending_payment'
     and r.status = 'active'
     and r.expires_at > now();

  if open_reservations >= 2 then
    raise exception 'MAX_OPEN_RESERVATIONS_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_two_open_reservations() from public, anon, authenticated;

 drop trigger if exists enforce_two_open_reservations on public.reservations;
create trigger enforce_two_open_reservations
before insert on public.reservations
for each row
execute function public.enforce_two_open_reservations();

-- One-time repair for reservations created before the limit was correctly
-- attached to the checkout path. For each customer, retain the two newest
-- genuinely open reservations and cancel older excess reservations while
-- returning their stock and promo usage.
do $$
declare
  excess record;
  item_row record;
  order_promo text;
begin
  perform public.release_expired_reservations();

  for excess in
    with ranked as (
      select
        r.id as reservation_id,
        r.order_id,
        row_number() over (
          partition by o.customer_id
          order by r.created_at desc, r.id desc
        ) as reservation_rank
      from public.reservations r
      join public.orders o on o.id = r.order_id
      where r.status = 'active'
        and r.expires_at > now()
        and o.payment_status = 'pending'
        and o.status = 'pending_payment'
    )
    select reservation_id, order_id
      from ranked
     where reservation_rank > 2
  loop
    for item_row in
      select product_id, quantity
        from public.order_items
       where order_id = excess.order_id
         and product_id is not null
    loop
      update public.products
         set stock_quantity = stock_quantity + item_row.quantity,
             reserved_quantity = greatest(0, reserved_quantity - item_row.quantity),
             updated_at = now()
       where id = item_row.product_id;
    end loop;

    select promo_code into order_promo
      from public.orders
     where id = excess.order_id;

    if order_promo is not null then
      update public.promo_codes
         set usage_count = greatest(0, usage_count - 1),
             updated_at = now()
       where code = order_promo
         and usage_count > 0;
    end if;

    update public.reservations
       set status = 'cancelled', updated_at = now()
     where id = excess.reservation_id
       and status = 'active';

    update public.orders
       set status = 'cancelled', updated_at = now()
     where id = excess.order_id
       and payment_status = 'pending';
  end loop;
end;
$$;

comment on function public.enforce_two_open_reservations() is 'Trusted reservation boundary enforcing a maximum of two simultaneously open reservations per customer.';
