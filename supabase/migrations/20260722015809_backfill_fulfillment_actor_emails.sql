-- Preserve the staff identity for fulfilment actions recorded before the
-- denormalized email label was introduced.
update public.orders target
set fulfillment_updated_by_email = lower(btrim(actor.email))
from auth.users actor
where target.fulfillment_updated_by = actor.id
  and nullif(btrim(target.fulfillment_updated_by_email), '') is null
  and nullif(btrim(actor.email), '') is not null;

-- Historical preparing rows were created by payment confirmation, so the
-- confirming actor is also the reliable initial fulfilment actor.
update public.orders
set fulfillment_updated_by = confirmed_by,
    fulfillment_updated_by_email = coalesce(
      nullif(btrim(fulfillment_updated_by_email), ''),
      confirmed_by_email
    )
where fulfillment_status = 'preparing'
  and fulfillment_updated_by is null
  and confirmed_by is not null;
