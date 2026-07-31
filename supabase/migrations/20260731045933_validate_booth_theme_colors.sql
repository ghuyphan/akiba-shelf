update public.booth_settings
set theme_primary =
  '#' ||
  substr(theme_primary, 2, 1) || substr(theme_primary, 2, 1) ||
  substr(theme_primary, 3, 1) || substr(theme_primary, 3, 1) ||
  substr(theme_primary, 4, 1) || substr(theme_primary, 4, 1)
where theme_primary ~ '^#[0-9A-Fa-f]{3}$';

update public.booth_settings
set theme_secondary =
  '#' ||
  substr(theme_secondary, 2, 1) || substr(theme_secondary, 2, 1) ||
  substr(theme_secondary, 3, 1) || substr(theme_secondary, 3, 1) ||
  substr(theme_secondary, 4, 1) || substr(theme_secondary, 4, 1)
where theme_secondary ~ '^#[0-9A-Fa-f]{3}$';

update public.booth_settings
set theme_accent =
  '#' ||
  substr(theme_accent, 2, 1) || substr(theme_accent, 2, 1) ||
  substr(theme_accent, 3, 1) || substr(theme_accent, 3, 1) ||
  substr(theme_accent, 4, 1) || substr(theme_accent, 4, 1)
where theme_accent ~ '^#[0-9A-Fa-f]{3}$';

update public.booth_settings
set theme_background =
  '#' ||
  substr(theme_background, 2, 1) || substr(theme_background, 2, 1) ||
  substr(theme_background, 3, 1) || substr(theme_background, 3, 1) ||
  substr(theme_background, 4, 1) || substr(theme_background, 4, 1)
where theme_background ~ '^#[0-9A-Fa-f]{3}$';

update public.booth_settings
set theme_primary = '#d95c64'
where theme_primary is null or theme_primary !~ '^#[0-9A-Fa-f]{6}$';

update public.booth_settings
set theme_secondary = '#2d2730'
where theme_secondary is null or theme_secondary !~ '^#[0-9A-Fa-f]{6}$';

update public.booth_settings
set theme_accent = '#f4cf78'
where theme_accent is null or theme_accent !~ '^#[0-9A-Fa-f]{6}$';

update public.booth_settings
set theme_background = '#fffaf2'
where theme_background is null or theme_background !~ '^#[0-9A-Fa-f]{6}$';

alter table public.booth_settings
  alter column theme_primary set default '#d95c64',
  alter column theme_primary set not null,
  alter column theme_secondary set default '#2d2730',
  alter column theme_secondary set not null,
  alter column theme_accent set default '#f4cf78',
  alter column theme_accent set not null,
  alter column theme_background set default '#fffaf2',
  alter column theme_background set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booth_settings_theme_colors_check'
      and conrelid = 'public.booth_settings'::regclass
  ) then
    alter table public.booth_settings
      add constraint booth_settings_theme_colors_check check (
        theme_primary ~ '^#[0-9A-Fa-f]{6}$'
        and theme_secondary ~ '^#[0-9A-Fa-f]{6}$'
        and theme_accent ~ '^#[0-9A-Fa-f]{6}$'
        and theme_background ~ '^#[0-9A-Fa-f]{6}$'
      );
  end if;
end
$$;
