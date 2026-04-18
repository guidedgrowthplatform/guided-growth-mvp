# Supabase Migrations (FROZEN)

This directory is the historical schema baseline. **New migrations go in
`alembic/versions/`**, not here.

## Why frozen

As of 2026-04-17, schema changes are managed by Alembic. The files here
(`000_schema.sql` through `009_*.sql`) represent the production state at
cutover. They are preserved for archaeology but should not be edited or
extended.

## Cutover checklist

On every environment (prod, staging, any dev branch DB), run once:

```bash
alembic stamp 0001_baseline
```

This marks the database as up-to-date with Alembic without executing any
SQL. Subsequent `alembic upgrade head` commands will only apply migrations
numbered `0002_*` and later.

## Adding new schema changes

See `alembic/README.md`. Short version:

```bash
npm run db:revision -- "your change description"
# edit the generated file in alembic/versions/
npm run db:migrate
```
