-- Qualify the cart variable in the read RPC as well.

create or replace function public.get_customer_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  v_cart_id uuid;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;

  select c.id
    into v_cart_id
    from public.customer_carts c
   where c.customer_id = customer;

  if v_cart_id is null then return result; end if;

  update public.customer_cart_items i
     set quantity = least(i.quantity, p.stock_quantity),
         updated_at = now()
    from public.products p
   where i.cart_id = v_cart_id
     and p.id = i.product_id;

  delete from public.customer_cart_items i
   where i.cart_id = v_cart_id
     and not exists (
       select 1
         from public.products p
        where p.id = i.product_id
          and p.is_active = true
          and p.stock_quantity > 0
     );

  select coalesce(
    jsonb_agg(
      jsonb_build_object('productId', i.product_id, 'quantity', i.quantity)
      order by i.created_at
    ),
    '[]'::jsonb
  )
    into result
    from public.customer_cart_items i
   where i.cart_id = v_cart_id;

  return result;
end;
$$;

revoke all on function public.get_customer_cart() from public, anon;
grant execute on function public.get_customer_cart() to authenticated;
