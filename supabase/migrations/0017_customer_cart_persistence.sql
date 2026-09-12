-- Phase 3: durable customer cart persistence.
-- The database stores authenticated customer carts. Browser storage remains a local
-- cache/fallback for guests and temporary offline use; it is not the source of truth
-- once a customer is authenticated.

create table if not exists public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index if not exists customer_cart_items_cart_id_idx
  on public.customer_cart_items(cart_id);
create index if not exists customer_cart_items_product_id_idx
  on public.customer_cart_items(product_id);

alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;

drop policy if exists "Customers can view own cart" on public.customer_carts;
create policy "Customers can view own cart"
  on public.customer_carts for select
  using (auth.uid() = customer_id);

drop policy if exists "Customers can view own cart items" on public.customer_cart_items;
create policy "Customers can view own cart items"
  on public.customer_cart_items for select
  using (
    exists (
      select 1
      from public.customer_carts c
      where c.id = customer_cart_items.cart_id
        and c.customer_id = auth.uid()
    )
  );

create or replace function public.merge_customer_cart(cart_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  cart_id uuid;
  item jsonb;
  product_row record;
  requested_quantity integer;
  existing_quantity integer;
  final_quantity integer;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(cart_items) <> 'array' then
    raise exception 'CART_INVALID';
  end if;

  insert into public.customer_carts (customer_id)
  values (customer)
  on conflict (customer_id) do update
    set updated_at = now()
  returning id into cart_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    if nullif(trim(item ->> 'productId'), '') is null then
      continue;
    end if;

    requested_quantity := greatest(1, coalesce((item ->> 'quantity')::integer, 1));

    select id, stock_quantity, is_active
      into product_row
      from public.products
      where id = (item ->> 'productId')::uuid;

    if not found or not product_row.is_active or product_row.stock_quantity <= 0 then
      continue;
    end if;

    select quantity
      into existing_quantity
      from public.customer_cart_items
     where cart_id = cart_id
       and product_id = product_row.id
     for update;

    final_quantity := least(
      product_row.stock_quantity,
      greatest(requested_quantity, coalesce(existing_quantity, 0))
    );

    insert into public.customer_cart_items (cart_id, product_id, quantity, updated_at)
    values (cart_id, product_row.id, final_quantity, now())
    on conflict (cart_id, product_id) do update
      set quantity = excluded.quantity,
          updated_at = now();
  end loop;

  update public.customer_carts
     set updated_at = now()
   where id = cart_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', i.product_id,
        'quantity', i.quantity
      ) order by i.created_at
    ),
    '[]'::jsonb
  )
    into result
    from public.customer_cart_items i
   where i.cart_id = cart_id;

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
  cart_id uuid;
  item jsonb;
  product_row record;
  requested_quantity integer;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(cart_items) <> 'array' then
    raise exception 'CART_INVALID';
  end if;

  insert into public.customer_carts (customer_id)
  values (customer)
  on conflict (customer_id) do update
    set updated_at = now()
  returning id into cart_id;

  delete from public.customer_cart_items where customer_cart_items.cart_id = cart_id;

  for item in select * from jsonb_array_elements(cart_items)
  loop
    requested_quantity := greatest(1, coalesce((item ->> 'quantity')::integer, 1));

    select id, stock_quantity, is_active
      into product_row
      from public.products
      where id = (item ->> 'productId')::uuid;

    if not found or not product_row.is_active or product_row.stock_quantity <= 0 then
      continue;
    end if;

    insert into public.customer_cart_items (cart_id, product_id, quantity, updated_at)
    values (
      cart_id,
      product_row.id,
      least(requested_quantity, product_row.stock_quantity),
      now()
    );
  end loop;

  update public.customer_carts set updated_at = now() where id = cart_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('productId', i.product_id, 'quantity', i.quantity)
      order by i.created_at
    ),
    '[]'::jsonb
  )
    into result
    from public.customer_cart_items i
   where i.cart_id = cart_id;

  return result;
end;
$$;

create or replace function public.get_customer_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  cart_id uuid;
  result jsonb := '[]'::jsonb;
begin
  if customer is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select id into cart_id
    from public.customer_carts
   where customer_id = customer;

  if cart_id is null then
    return result;
  end if;

  -- Keep persisted quantities within current live stock without exposing prices
  -- or trusting client-side inventory values.
  update public.customer_cart_items i
     set quantity = least(i.quantity, p.stock_quantity),
         updated_at = now()
    from public.products p
   where i.cart_id = cart_id
     and p.id = i.product_id;

  delete from public.customer_cart_items i
   where i.cart_id = cart_id
     and not exists (
       select 1 from public.products p
       where p.id = i.product_id and p.is_active = true and p.stock_quantity > 0
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
   where i.cart_id = cart_id;

  return result;
end;
$$;

revoke all on function public.merge_customer_cart(jsonb) from public, anon;
revoke all on function public.set_customer_cart(jsonb) from public, anon;
revoke all on function public.get_customer_cart() from public, anon;
grant execute on function public.merge_customer_cart(jsonb) to authenticated;
grant execute on function public.set_customer_cart(jsonb) to authenticated;
grant execute on function public.get_customer_cart() to authenticated;

comment on function public.get_customer_cart() is 'Returns the authenticated customer cart from the database and clamps/removes items against current live catalogue stock.';
comment on function public.merge_customer_cart(jsonb) is 'Merges a browser cart into the authenticated customer cart, capped by current live stock.';
comment on function public.set_customer_cart(jsonb) is 'Replaces the authenticated customer cart with validated product IDs and stock-capped quantities.';
