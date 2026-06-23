# Environment variable matrix

Source of truth: [`scripts/env/required-env.json`](../scripts/env/required-env.json), enforced by
[`scripts/env/check-env.mjs`](../scripts/env/check-env.mjs).

**Vercel scopes map to environments:** Production scope → prod Supabase (`pmunbflbjpoawicgimyc`);
Preview scope → staging Supabase (`ppyouymvnrqxcsllrmsl`). `VITE_*` are build-time inlined, so a
Preview build must receive staging values and a Production build prod values.

## The rule

- **Required-present** per scope: a build missing one of these is misconfigured.
- **Forbidden-in-production**: QA-only flags/secrets that must NEVER exist in Production scope —
  this is a primary prod-safety control. If any appear in prod, the QA banner / login / reset /
  bug-report surfaces could activate against prod.

## Running the check

```bash
# Against a pulled scope (needs Vercel auth):
vercel env pull /tmp/prod.env --environment=production --yes
node scripts/env/check-env.mjs production /tmp/prod.env

vercel env pull /tmp/preview.env --environment=preview --yes
node scripts/env/check-env.mjs preview /tmp/preview.env

# Against the current process env (e.g. inside a CI build job):
node scripts/env/check-env.mjs production
```

CI wiring lives in `.github/workflows/env-matrix.yml` (PR-triggered). It is **non-blocking until it
bakes green**, then promoted to a required check (see `docs/PROMOTION.md`).

## Known cleanup (manual, not yet automated)

- `QA_RESET_TOKEN` currently exists in Production scope (legacy; the endpoint is regex-guarded so
  it's inert, but it should be removed from prod). Not in the automated forbidden list yet to avoid
  a false-red before the manual cleanup; remove it from Production, then add it here.
- `GITLAB_TOKEN` is intentionally allowed in prod — `api/_lib/gitlab.ts` (read-only status
  dashboard, consumed by an external repo) needs it. The bug-report write path reuses the same env
  but is QA-gated.
