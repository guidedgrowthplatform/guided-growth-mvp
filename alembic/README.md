# Alembic Migrations

Database migrations for guided-growth-mvp. Supersedes `supabase/migrations/`
for all schema changes from `0002_*` onward.

## Conventions

- **Raw SQL only.** Write DDL inside `op.execute("""...""")`. Do not define
  SQLAlchemy models — the schema source of truth is the TypeScript types in
  `packages/shared/src/types/index.ts`, and autogenerate would drift.
- **One logical change per revision.** Easier to review, easier to revert.
- **Reversible `downgrade()` required.** If a change is irreversible (e.g.,
  data loss), say so explicitly in the revision docstring and leave
  `downgrade()` as `pass` with a comment.
- **No `DROP` on live columns/tables in a single step.** Use expand/contract:
  one revision to deprecate, a later revision (after code rollout) to drop.
- **Every query still filters by `user_id`.** RLS is not relied upon (see
  CLAUDE.md §"RLS Policies Are NOT Functional"). Migrations don't change
  that invariant.

## Local usage

```bash
# One-time setup
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .

# Create .env.local with DATABASE_URL pointing at your dev DB
echo "DATABASE_URL=postgresql://..." > .env.local

# Create a revision
npm run db:revision -- "add notes column to entries"

# Apply migrations
npm run db:migrate

# Roll back one revision
npm run db:downgrade

# Render SQL without applying (offline/dry-run)
alembic upgrade head --sql
```

## Baseline

`0001_baseline.py` is intentionally empty. It represents the state of
production as of the cutover from Supabase CLI migrations. On any existing
database, run once:

```bash
alembic stamp 0001_baseline
```

This marks the DB as up-to-date without executing anything. New work starts
at `0002_*`.

## CI/CD

- **Pull requests** run `alembic upgrade head --sql` in dry-run mode and
  post the rendered SQL as a PR check. Reviewers see exactly what will run.
- **Merges to `main`** gate on the `production-migrations` GitHub
  Environment (manual approval required) before `alembic upgrade head`
  executes against prod.
- Vercel builds never run migrations. Schema changes must merge and apply
  **before** code that depends on them.
