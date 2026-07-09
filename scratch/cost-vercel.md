# Vercel cost-safety audit — guided-growth-mvp build/preview/QA flow

Read-only audit, 2026-07-09. Question: does the build/preview/deploy flow burn Yair's
PERSONAL Vercel minutes?

## 1. Render (gg-onboarding-render) — Cloudflare Pages, confirmed

- The render tool deploys via wrangler directly to Cloudflare Pages:
  `"$HOME/Developer/gg-cron-worker/node_modules/.bin/wrangler" pages deploy dist-flow
  --project-name gg-onboarding-render --branch main --commit-dirty=true`
  (source: `HANDOFF-onboarding-render-to-engine.md`)
- Live at `https://gg-onboarding-render.pages.dev`. This is a Cloudflare Pages project,
  zero Vercel involvement. Render iteration/build work costs no Vercel minutes,
  personal or otherwise.

## 2. App + QA (gg-qa-iota, guided-growth-mvp) — Vercel, but on a SEPARATE team account

Deploy path: GitLab (`gitlab.guidedgrowthapp.com/guidedgrowth-group/guided-growth-mvp`,
source of truth) → mirrored to GitHub (`github.com/guidedgrowthplatform/guided-growth-mvp`,
Alejandro's org) → Vercel's native GitHub App integration auto-deploys on every push.
No scripted `vercel deploy` step exists in `.github/workflows/*.yml` — confirmed by grep,
only one `vercel.app` string reference (a hardcoded prod URL var). So Vercel is watching
the GitHub mirror directly, not invoked from CI. `vercel.json` in the repo only sets
build/output/headers/rewrites, no `ignoreCommand` or build-skip directive (checked, none
present — Ignored Build Step is a dashboard-only setting in Vercel anyway, not stored in
`vercel.json`).

**Account separation — this is the load-bearing fact.** As of `HANDOFF-llm-cost-azure.md`
(2026-07-09), both live Vercel projects sit under Vercel TEAM `guided growth's projects`
(`team_3MU2ra11JF8dS5seiSygFwYr`), owned by `tech@guidedgrowthapp.com`:
- `gg-qa` (`prj_4bEo8YFvVau9Zciyma4hiTkrvFxM`) — the iota QA/fleet-testing target, the
  dominant build-volume project (every convo-harness / MR-preview run hits it).
- `guided-growth-mvp` (`prj_Cl6B1Jq4lTimyqIFpjjULDPVtfnN`) — real production, git-linked,
  prodBranch `production`.

Verified LIVE via the Vercel CLI (`vercel project ls --scope yair-1950s-projects`, this
machine's authed personal account `yair-1950`): personal scope only contains
`fearless-site`, `fearless-offer`, `ggmvp-local-test`, `ggmvp-his`, and a
`guided-growth-mvp` entry with **zero deployments** (orphaned/stale, see caveat below).
No `gg-qa` project, no alias, no domain for it exists under the personal scope
(`vercel alias ls` / `vercel domains ls` show only the two Fearless Life sites). All the
GG build/QA/swarm traffic is provably NOT hitting Yair's personal Vercel account.

**This matches what Yair recalls.** A scratch plan from 2026-06-29
(`Yair-Context/scratch/big-update-2026-06-27/team-ops-plan-full-2026-06-29.md`) flagged:
"Right now the project is personal-scope... The Vercel-personal-scope constraint is the
one hard prerequisite Yair must resolve before anything else," and recommended
transferring the project to a Vercel Team. That migration is DONE — the 2026-07-09
handoff confirms the team + the `tech@guidedgrowthapp.com` owner. So the "setting a
session applied" was this account migration, and it is in effect.

## Caveats / loose ends

1. **Stale orphaned project in personal scope.** `vercel project inspect
   guided-growth-mvp` (name-matched, personal scope) returns a project
   (`prj_U0dDA8O6NSZUD1xHAQCokOa0Vft5`, created 2026-07-03, "No deployments found").
   This is NOT the linked/live project (that's `prj_Cl6B1Jq4lTimyqIFpjjULDPVtfnN` under
   the GG team) — it looks like a leftover from an earlier local `vercel link` done from
   this machine before the team migration, or a duplicate created by name collision. It
   is dead (zero deployments) but its mere existence in Yair's personal namespace is a
   trap: if anyone runs `vercel link` from this repo without `--scope`, or `vercel deploy`
   without an explicit team scope, it could silently start deploying (and billing) to
   this personal project instead of the GG team one. Recommend deleting it.
2. **No Vercel Spend Management cap set yet on the GG team account itself.**
   `HANDOFF-llm-cost-azure.md` lists this as an explicit open to-do (task 3, "Hard caps
   (Yair, dashboards): ... Vercel Spend Management (Vercel Settings, Billing, Spend
   Management)") — not yet done. This doesn't touch Yair's PERSONAL account, but the GG
   team account itself has no ceiling on build/bandwidth spend.
3. **No build-skip/ignoreCommand exists anywhere** — every push to the GitHub mirror
   still triggers a Vercel build (this is by design for per-branch previews per
   `docs/ENVIRONMENTS.md`). Cost containment here comes from account separation, not from
   reduced build volume. Given the volume of MR/harness preview builds seen in
   `gg-spec/tools/convo-harness/reports/*.md` (dozens of distinct preview URLs), build
   volume on the GG team account is high — worth the Spend Management cap in #2.

## Bottom line

Personal-account exposure: NONE currently, confirmed live. The fix already applied
(team migration) is holding. Two follow-ups worth doing, neither touches Yair's personal
account: (a) delete the orphaned `guided-growth-mvp` project sitting in the personal
scope so nobody can accidentally deploy/bill to it, (b) set a Vercel Spend Management cap
on the GG team account (`guided growth's projects`, team_3MU2ra11JF8dS5seiSygFwYr) since
none exists yet.
