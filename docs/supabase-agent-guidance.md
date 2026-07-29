# Supabase agent guidance

Read only for Supabase, auth, API data, Edge Function, migration, SQL, RLS, or
database work.

- Change schema, RLS, grants, functions, and policies only through a new file in
  `supabase/migrations/`. Never rely on Dashboard-only production edits.
- Enable RLS on exposed tables and grant Data API access explicitly and
  minimally. `TO authenticated` alone is not authorization; scope rows to the
  caller/shop. UPDATE policies need both `USING` and `WITH CHECK`.
- Treat `SECURITY DEFINER` as privileged API code. Use a safe `search_path`,
  verify the caller inside the function, revoke default/public execution, and
  grant only intended roles.
- Preserve `create_order`: validate the cart, lock product rows in stable order,
  read current prices/promotions, reserve stock, and create order records
  atomically.
- Every `VITE_*` variable is public. Service-role, OAuth, SMTP, checkout salt,
  and VAPID private values belong in provider or Edge Function secrets.
- Before a linked deployment, compare migration history, run a dry-run, apply
  only pending migrations, verify the resulting schema, and run security and
  performance advisors. Never use `--include-all` to hide drift.
- A local Supabase database is supplemental when the checkout is linked. Do not
  block a requested linked deployment on Docker.
- Follow `.agents/skills/supabase/SKILL.md`; for SQL, query, or schema work also
  follow `.agents/skills/supabase-postgres-best-practices/SKILL.md`.
- `.agents/` is ignored. Migrations and `docs/operations.md` are the portable
  source of truth for production procedures.
