-- Trusted server clients need explicit table privileges even though service_role
-- bypasses RLS. Browser roles remain limited to the public-safe column grants.
grant select,insert,update,delete on
  public.shops,
  public.shop_members,
  public.products,
  public.booth_settings,
  public.payment_settings,
  public.orders,
  public.order_items
to service_role;
