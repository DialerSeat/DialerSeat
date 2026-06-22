# Database Schema

This folder is the version-controlled source of truth for the DialerSeat
Postgres/Supabase database structure.

## Files

- **`schema.sql`** — A complete baseline snapshot of the database as it existed
  on 2026-06-21, dumped directly from the live Supabase instance. It contains
  every table, constraint, index, function, view, trigger, the `ensure_rls`
  event trigger, and all RLS policies. It is organized to run top-to-bottom on
  an empty database.

## Why this exists

Until now the schema lived **only** in the live database. There was no way to:
- rebuild it from scratch after a disaster,
- review schema changes the way we review application code,
- see the history of how the schema evolved.

This baseline fixes that. From here on, treat the database structure like code.

## How to make schema changes from now on

**Do not edit the database structure directly in the Supabase dashboard** (or at
least, don't let that be the only record). Instead:

1. Create a new file in this folder named with a timestamp prefix, e.g.
   `2026-07-01-add-lead-tags.sql`, containing the `ALTER TABLE ...` (or other
   DDL) for your change.
2. Apply it to the database (via the Supabase SQL editor, the Supabase CLI, or
   your migration runner of choice).
3. Commit the migration file in the same PR as any application code that depends
   on it.

`schema.sql` is the **baseline**; the dated files are the **deltas** layered on
top of it. If you ever want to regenerate a fresh consolidated baseline, you can
re-dump the live database and replace `schema.sql` (note the date you did so).

If you adopt the Supabase CLI, `supabase db diff` and the `supabase/migrations/`
directory can automate much of this — this folder is a lightweight stand-in
until then.

## Important caveats baked into `schema.sql`

Read the comment block at the top of `schema.sql`, but the headline is:

- **RLS is enabled everywhere but is NOT the live security boundary.** The app
  uses the Supabase service-role key, which bypasses RLS. The real authorization
  is in the application layer (`requireUser` / `requireAdmin`). Most RLS policies
  key off a session variable (`app.clerk_id`) the app never sets, so they would
  not behave as written if you switched to a non-service-role key. See
  `SECURITY.md` for the full discussion.
- **No row data is included** — this is structure only.
- **Supabase-managed objects** (the `auth`/`storage` schemas, platform event
  triggers like `pgrst_ddl_watch`) are intentionally excluded; Supabase manages
  those for you.

## Rebuilding from scratch (disaster recovery sketch)

On a fresh Postgres/Supabase project:

```sql
-- 1. Run the baseline
\i schema.sql

-- 2. Apply any dated migration files in chronological order
\i 2026-07-01-add-lead-tags.sql
-- ...etc
```

Then restore row data from your backups separately. (Supabase Point-in-Time
Recovery / daily backups cover the data; this file covers the structure.)