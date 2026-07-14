alter table public.booth_settings
  add column if not exists instagram_visible boolean not null default true,
  add column if not exists facebook_visible boolean not null default true,
  add column if not exists tiktok_visible boolean not null default true,
  add column if not exists x_url text not null default '',
  add column if not exists x_visible boolean not null default true,
  add column if not exists threads_url text not null default '',
  add column if not exists threads_visible boolean not null default true,
  add column if not exists youtube_url text not null default '',
  add column if not exists youtube_visible boolean not null default true;

alter table public.booth_settings
  drop constraint if exists booth_settings_safe_public_urls;
alter table public.booth_settings
  add constraint booth_settings_safe_public_urls check (
    private.is_safe_public_url(logo_url)
    and private.is_safe_public_url(instagram_url)
    and private.is_safe_public_url(facebook_url)
    and private.is_safe_public_url(tiktok_url)
    and private.is_safe_public_url(x_url)
    and private.is_safe_public_url(threads_url)
    and private.is_safe_public_url(youtube_url)
    and private.is_safe_public_url(social_qr_logo_url)
  ) not valid;

grant select(
  instagram_visible,
  facebook_visible,
  tiktok_visible,
  x_url,
  x_visible,
  threads_url,
  threads_visible,
  youtube_url,
  youtube_visible
) on public.booth_settings to anon, authenticated;

comment on column public.booth_settings.x_url is
  'Public X profile URL. Display additionally requires x_visible.';
comment on column public.booth_settings.threads_url is
  'Public Threads profile URL. Display additionally requires threads_visible.';
comment on column public.booth_settings.youtube_url is
  'Public YouTube channel URL. Display additionally requires youtube_visible.';
