-- Follow-up hardening for 0017: qualify cart-item columns so the PL/pgSQL
-- cart_id variable cannot be confused with a table column.

create or replace function public.merge_customer_cart(cart_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  v_cart_id uuid;
  item jsonb;
  product_row record;
  requested_quantity integer;
  existing_quantity integer;
  final_quantity integer;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(cart_items) <> 'array' then raise exception 'CART_INVALID'; end if;

  insert into public.customer_carts (customer_id)
  values (customer)
  on conflict (customer_id) do update set updated_at = now()
  returning id into v_cart_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    if nullif(trim(item ->> 'productId'), '') is null then continue; end if;
    requested_quantity := greatest(1, coalesce((item ->> 'quantity')::integer, 1));

    select p.id, p.stock_quantity, p.is_active
      into product_row
      from public.products p
     where p.id = (item ->> 'productId')::uuid;

    if not found or not product_row.is_active or product_row.stock_quantity <= 0 then continue; end if;

    select i.quantity
      into existing_quantity
      from public.customer_cart_items i
     where i.cart_id = v_cart_id
       and i.product_id = product_row.id
     for update;

    final_quantity := least(
      product_row.stock_quantity,
      greatest(requested_quantity, coalesce(existing_quantity, 0))
    );

    insert into public.customer_cart_items (cart_id, product_id, quantity, updated_at)
    values (v_cart_id, product_row.id, final_quantity, now())
    on conflict (cart_id, product_id) do update
      set quantity = excluded.quantity,
          updated_at = now();
  end loop;

  update public.customer_carts set updated_at = now() where id = v_cart_id;

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

create or replace function public.set_customer_cart(cart_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  v_cart_id uuid;
  item jsonb;
  product_row record;
  requested_quantity integer;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(cart_items) <> 'array' then raise exception 'CART_INVALID'; end if;

  insert into public.customer_carts (customer_id)
  values (customer)
  on conflict (customer_id) do update set updated_at = now()
  returning id into v_cart_id;

  delete from public.customer_cart_items i where i.cart_id = v_cart_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    requested_quantity := greatest(1, coalesce((item ->> 'quantity')::integer, 1));

    select p.id, p.stock_quantity, p.is_active
      into product_row
      from public.products p
     where p.id = (item ->> 'productId')::uuid;

    if not found or not product_row.is_active or product_row.stock_quantity <= 0 then continue; end if;

    insert into public.customer_cart_items (cart_id, product_id, quantity, updated_at)
    values (v_cart_id, product_row.id, least(requested_quantity, product_row.stock_quantity), now());
  end loop;

  update public.customer_carts set updated_at = now() where id = v_cart_id;

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

revoke all on function public.merge_customer_cart(jsonb) from public, anon;
revoke all on function public.set_customer_cart(jsonb) from public, anon;
grant execute on function public.merge_customer_cart(jsonb) to authenticated;
grant execute on function public.set_customer_cart(jsonb) to authenticated;
