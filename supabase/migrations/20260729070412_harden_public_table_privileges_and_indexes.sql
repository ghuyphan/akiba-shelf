-- Public Data API roles must never retain table-level capabilities that bypass
-- row policies or mutate database structure. CRUD grants remain explicit in
-- the owning migrations and RPCs.
revoke truncate, references, trigger on all tables in schema public
from anon, authenticated;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger on tables
from anon, authenticated;

-- Index the foreign-key side used by creator/audit lookups and joins.
create index if not exists offline_event_sessions_created_by_idx
  on public.offline_event_sessions (created_by);

notify pgrst, 'reload schema';
