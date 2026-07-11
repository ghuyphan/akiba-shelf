create index if not exists orders_created_at_id_idx
  on public.orders (created_at desc, id desc);

create index if not exists orders_status_created_at_id_idx
  on public.orders (status, created_at desc, id desc);
