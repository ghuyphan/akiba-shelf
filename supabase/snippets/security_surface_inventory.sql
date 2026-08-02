with
functions as (
  select coalesce(
    jsonb_agg(to_jsonb(function_row) order by function_row.signature),
    '[]'::jsonb
  ) as value
  from (
    select
      p.oid::regprocedure::text as signature,
      pg_get_function_result(p.oid) as result_type,
      p.prosecdef as security_definer,
      coalesce(p.proconfig, '{}'::text[]) as configuration,
      pg_get_userbyid(p.proowner) as owner,
      coalesce(
        array_agg(
          distinct case when privileges.grantee = 0 then 'PUBLIC' else grantee.rolname end
          order by case when privileges.grantee = 0 then 'PUBLIC' else grantee.rolname end
        ) filter (where privileges.privilege_type = 'EXECUTE'),
        '{}'::text[]
      ) as execute_roles
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral aclexplode(
      coalesce(p.proacl, acldefault('f'::"char", p.proowner))
    ) privileges on true
    left join pg_roles grantee on grantee.oid = privileges.grantee
    where n.nspname = 'public'
    group by p.oid
  ) function_row
),
relations as (
  select coalesce(
    jsonb_agg(to_jsonb(relation_row) order by relation_row.name),
    '[]'::jsonb
  ) as value
  from (
    select
      c.relname as name,
      case c.relkind
        when 'r' then 'table'
        when 'p' then 'partitioned table'
        when 'v' then 'view'
        when 'm' then 'materialized view'
      end as kind,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      pg_get_userbyid(c.relowner) as owner,
      coalesce(
        array_agg(
          distinct concat(
            case when privileges.grantee = 0 then 'PUBLIC' else grantee.rolname end,
            ':',
            privileges.privilege_type
          )
          order by concat(
            case when privileges.grantee = 0 then 'PUBLIC' else grantee.rolname end,
            ':',
            privileges.privilege_type
          )
        ) filter (where privileges.privilege_type is not null),
        '{}'::text[]
      ) as grants
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join lateral aclexplode(
      coalesce(c.relacl, acldefault('r'::"char", c.relowner))
    ) privileges on true
    left join pg_roles grantee on grantee.oid = privileges.grantee
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
    group by c.oid
  ) relation_row
),
policies as (
  select coalesce(
    jsonb_agg(to_jsonb(policy_row) order by policy_row.table_name, policy_row.policy_name),
    '[]'::jsonb
  ) as value
  from (
    select
      tablename as table_name,
      policyname as policy_name,
      permissive,
      roles,
      cmd as command,
      qual as using_expression,
      with_check as check_expression
    from pg_policies
    where schemaname = 'public'
  ) policy_row
),
triggers as (
  select coalesce(
    jsonb_agg(to_jsonb(trigger_row) order by trigger_row.table_name, trigger_row.trigger_name),
    '[]'::jsonb
  ) as value
  from (
    select
      c.relname as table_name,
      t.tgname as trigger_name,
      p.oid::regprocedure::text as function_signature,
      t.tgenabled as enabled_mode,
      pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and not t.tgisinternal
  ) trigger_row
),
views as (
  select coalesce(
    jsonb_agg(to_jsonb(view_row) order by view_row.name),
    '[]'::jsonb
  ) as value
  from (
    select
      c.relname as name,
      c.relkind = 'm' as materialized,
      coalesce(c.reloptions @> array['security_invoker=true'], false) as security_invoker,
      pg_get_viewdef(c.oid, true) as definition
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm')
  ) view_row
)
select jsonb_pretty(
  jsonb_build_object(
    'generated_at', current_timestamp,
    'database', current_database(),
    'functions', functions.value,
    'relations', relations.value,
    'policies', policies.value,
    'triggers', triggers.value,
    'views', views.value
  )
) as security_surface
from functions, relations, policies, triggers, views;
