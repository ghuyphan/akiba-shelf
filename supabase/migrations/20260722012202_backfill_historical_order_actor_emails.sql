-- Preserve useful audit labels for terminal actions recorded before actor
-- emails were captured directly on the order row.
update public.orders as target
set confirmed_by_email = lower(btrim(actor.email))
from auth.users as actor
where target.confirmed_by = actor.id
  and nullif(btrim(target.confirmed_by_email), '') is null
  and nullif(btrim(actor.email), '') is not null;

update public.orders as target
set cancelled_by_email = lower(btrim(actor.email))
from auth.users as actor
where target.cancelled_by = actor.id
  and nullif(btrim(target.cancelled_by_email), '') is null
  and nullif(btrim(actor.email), '') is not null;
