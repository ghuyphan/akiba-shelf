-- Generate readable, collision-safe shop URLs from the requested slug or name.
-- The advisory lock serializes shops sharing the same base slug so concurrent
-- creation cannot race between the existence check and insert.
create or replace function public.create_shop(p_name text,p_slug text default null)
returns public.shops
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.shops;
  base_slug text;
  candidate_slug text;
  suffix integer := 2;
  suffix_text text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 100 then
    raise exception 'Shop name must contain between 1 and 100 characters';
  end if;

  base_slug := trim(both '-' from regexp_replace(
    lower(btrim(coalesce(nullif(p_slug,''),p_name))),
    '[^a-z0-9]+','-','g'
  ));
  if base_slug = '' then base_slug := 'shop'; end if;
  base_slug := left(base_slug,63);
  if length(base_slug) < 2 then base_slug := base_slug || '-shop'; end if;

  perform pg_advisory_xact_lock(hashtextextended('shop-slug:'||base_slug,0));
  candidate_slug := base_slug;
  while exists(select 1 from public.shops where slug=candidate_slug) loop
    suffix_text := '-'||suffix::text;
    candidate_slug := left(base_slug,63-length(suffix_text))||suffix_text;
    suffix := suffix+1;
  end loop;

  insert into public.shops(name,slug,created_by)
  values(btrim(p_name),candidate_slug,auth.uid())
  returning * into s;
  insert into public.shop_members(shop_id,user_id,role)
  values(s.id,auth.uid(),'owner');
  insert into public.booth_settings(id,shop_id,booth_name)
  values(s.id::text,s.id,btrim(p_name));
  insert into public.payment_settings(id,shop_id)
  values(s.id::text,s.id);
  return s;
end
$$;

revoke all on function public.create_shop(text,text) from public,anon,authenticated;
grant execute on function public.create_shop(text,text) to authenticated;
