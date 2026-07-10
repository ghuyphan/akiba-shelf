create or replace function public.create_order(p_customer_name text, p_items jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order public.orders;
  order_total integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart must contain between 1 and 50 items';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    where requested.product_id is null or requested.quantity is null or requested.quantity <= 0
  ) then
    raise exception 'Cart contains an invalid item';
  end if;

  -- Lock product rows in a stable order. Keep aggregation out of the locking
  -- query because PostgreSQL does not allow FOR UPDATE with GROUP BY.
  perform product.id
  from public.products as product
  where exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    where requested.product_id = product.id
  )
  order by product.id
  for update of product;

  if exists (
    select 1
    from (
      select requested.product_id, sum(requested.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
      group by requested.product_id
    ) as requested
    left join public.products as product on product.id = requested.product_id
    where product.id is null
      or not product.active
      or product.stock_status = 'sold_out'
      or product.quantity_available < requested.quantity
  ) then
    raise exception 'One or more items are sold out or no longer have enough stock';
  end if;

  select sum(product.price_vnd * requested.quantity)::integer
  into order_total
  from (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id text, quantity integer)
    group by item.product_id
  ) as requested
  join public.products as product on product.id = requested.product_id;

  insert into public.orders (customer_name, total_amount, status)
  values (nullif(btrim(left(p_customer_name, 30)), ''), order_total, 'pending')
  returning * into created_order;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select created_order.id, product.id, requested.quantity, product.price_vnd
  from (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id text, quantity integer)
    group by item.product_id
  ) as requested
  join public.products as product on product.id = requested.product_id;

  return created_order;
end;
$$;

revoke all on function public.create_order(text, jsonb) from public;
grant execute on function public.create_order(text, jsonb) to anon, authenticated;
