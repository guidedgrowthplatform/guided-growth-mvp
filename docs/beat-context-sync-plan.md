# Beat-context sync — how it works + integration plan

_Authored 2026-06-28 (Yonas track). Status verified live against prod `pmunbflbjpoawicgimyc`._

## STATUS — STOOD UP 2026-06-28

The pipeline is now live. Migration 052 ran on prod; `beat_contexts` (15 onboarding
rows) + `onboarding_globals/default` (the onboarding global, 3889 chars) are populated
from the Sheet; `beatContexts.generated.json` is synced (15 beats) and the overlay is
active. Decision taken: **all beats incl. new-order copy** + a **durable Sheet→Supabase
sync** (`scripts/voice-sync/sync_beats_context.py`). type-check clean, 1331 tests pass.

⚠️ **Known desync (accepted):** the Sheet copy is new-order, this branch's engine is
old-order. `BEGINNER-06` now reads "here's your starting plan, ready to start?" while the
engine still routes plan-review → MORNING-SETUP → COMPLETE (those two code-only beats keep
their code defaults — not in the Sheet). Fully consistent only once the held onboarding
order change lands in the engine. The generated.json is committed but NOT yet deployed.

## TL;DR

The beat-context sync is a **one-way Supabase → repo file** pipeline that lets coach
copy be edited outside code. It is **fully built but never stood up**: migration 052's
tables don't exist on prod, the seed has never run, and `beatContexts.generated.json` is
the empty placeholder. So today the coach runs entirely on the **hand-authored defaults**
baked into `beatContexts.ts` — which is exactly what the engine-resync wrote, so nothing
is broken. This doc explains the machine and lays out how to turn it on.

---

## 1. How the sync actually works

### Two separate content pipelines (they diverge — this is the core mess)

| | **Path 1 — Vapi** | **Path 3 — Direct-LLM** |
|---|---|---|
| Reads at runtime | `src/generated/screen_contexts.json` bundle | `beatContexts.ts` (+ `beatContexts.generated.json` overlay) |
| DB table | `screen_contexts` — **59 rows on prod ✅** | `beat_contexts` + `onboarding_globals` — **missing ❌** |
| Seed source | Master Sheet "Screens" tab → `seed_contexts.py` | hand-authored `beatContexts.ts` → `seed_beat_contexts.py` |
| Sync to repo | `seed_contexts.py` writes bundle (Vapi has NO global) | `sync_beat_contexts.py` writes generated.json |
| Global context | a **separate copy** in the Vapi "Coach Yair" system prompt (drifts) | `GLOBAL_ONBOARDING_CONTEXT` in code / `onboarding_globals` |

The Vapi side is live and seeded. The Direct-LLM beat-context side is the one that was
built but never turned on.

### The Direct-LLM beat-context pipeline (the subject of this plan)

```
                       (1) seed once                 (2) sync (cron/on-demand)
 beatContexts.ts  ───────────────────────►  Supabase  ───────────────────────►  beatContexts.generated.json
 (hand-authored,   seed_beat_contexts.py    beat_contexts +    sync_beat_contexts.py   (committed to repo)
  code-owned)                               onboarding_globals                          │
       │                                          ▲                                     │ (3) overlay at import
       │                                          │ editors edit here                   ▼
       │                                     (Supabase / Sheet                    beatContexts.ts merges:
       └──────────── allowedTools never leaves code ◄── Beat Contexts tab)        generated overrides win for
                     (code-owned safety gate)                                      context+opener; allowedTools
                                                                                   + defaults stay from code
```

Three moving parts, all present in the repo **today**:

1. **`supabase/migrations/052_beat_contexts.sql`** — creates `beat_contexts`
   (PK `screen_id`, `context`, `opener`, `version`, `content_hash`) and
   `onboarding_globals` (single `id='default'` row: `global_context` + `bundle_version`).
   RLS on, no policies (service role bypasses). **Not run on prod.**

2. **`scripts/voice-sync/seed_beat_contexts.py`** — pushes content INTO Supabase to
   bootstrap. ⚠️ It reads an **inlined copy** of the beat data (lines ~68–300,
   "Update this block whenever beatContexts.ts changes meaningfully"), NOT the live
   `.ts`. Risk: this block may be **stale** vs. the resync's `beatContexts.ts`.

3. **`scripts/voice-sync/sync_beat_contexts.py`** — reads Supabase, writes
   `beatContexts.generated.json`. Idempotent (only writes on real change). Safe as a cron.

### The overlay (the only part already wired in app code — `beatContexts.ts`)

- Imports `beatContexts.generated.json`.
- `GLOBAL_ONBOARDING_CONTEXT = generated.global ?? DEFAULT_GLOBAL_ONBOARDING_CONTEXT`.
- For each beat in `generated.beats`, overrides `context` (+ `opener` if present),
  **keeping `allowedTools` and all other defaults from code**.
- Generated file empty → no-op → hand-authored defaults. **This is the current state.**

### Migration mechanics (important gotcha)

- Migrations are run **manually**: `node scripts/run-migration.mjs 052`
  (matches by filename prefix, runs against `DATABASE_URL` from `.env.local`).
- There is **no `schema_migrations` ledger** on prod — nothing records what's been run.
  So "which migrations are live" is tribal knowledge, not queryable. Worth fixing
  separately (out of scope here, but flag it).

---

## 2. Current state (verified live, 2026-06-28)

- prod `beat_contexts` / `onboarding_globals` → **do not exist**.
- `beatContexts.generated.json` → empty placeholder (`global: null`, `beats: {}`).
- ⇒ coach copy = hand-authored `beatContexts.ts` defaults (the resync content). **Working.**
- `screen_contexts` → 59 rows (Vapi pipeline, separate, already live).

**Consequence:** standing the sync up is **not required to test the beat→tool→persist
loop** (Yair confirmed). It's required to (a) let non-engineers edit copy, and (b) stop
the Vapi-prompt-vs-code global from drifting.

---

## 3. The plan

### Phase 0 — DECIDE source of truth (blocks everything; Yair's call)

Pick one model and write it down:

- **(A) Code-authored, Supabase as a cache** — keep editing `beatContexts.ts` in code;
  seed→sync is just a publish step. Simplest; no editor workflow. _Recommended for now_
  since the resync just rewrote the copy in code and we ship fast.
- **(B) Supabase-authored** — bootstrap once from code, then editors own copy in Supabase
  (or the Sheet "Beat Contexts" tab); code defaults become only a fallback. This is what
  the README assumes. More moving parts; needs the Sheet→Supabase path confirmed.

Until this is decided, do NOT seed — seeding picks the winner.

### Phase 1 — Run the migration (prod)
```bash
node scripts/run-migration.mjs 052
```
Verify both tables exist + RLS on. (Optionally add a `schema_migrations` row-keeping
convention while here.)

### Phase 2 — De-stale the seed (only if seeding)
Reconcile `seed_beat_contexts.py`'s inlined block against the **current**
`beatContexts.ts` (the resync changed beats; the inline copy likely lags). Either
hand-update the block, or — better — refactor the seed to import/parse the real source so
it can't drift again. Diff before trusting it.

### Phase 3 — Seed Supabase
```bash
cd scripts/voice-sync && python seed_beat_contexts.py --dry-run   # preview
python seed_beat_contexts.py                                       # write
```

### Phase 4 — Sync back + commit
```bash
python sync_beat_contexts.py --dry-run
python sync_beat_contexts.py          # writes api/_lib/llm/onboarding/beatContexts.generated.json
```
Commit the regenerated JSON. After this, `generated.global` and per-beat overrides are
non-empty and the overlay starts winning over defaults.

### Phase 5 — Local dev + CI story ("rethink my local dev")
- **Local dev needs NOTHING new.** App falls back to committed defaults when the generated
  file is empty/absent. A dev only runs `sync_beat_contexts.py` if they want live Supabase
  copy locally — and only needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (no Sheets).
- **CI cron:** add a GitHub Action that runs `sync_beat_contexts.py` on a schedule (or on
  dispatch), commits the JSON if changed. Idempotent, so a no-op when nothing changed.
- Decide whether the generated file stays **committed** (recommended — deploys are
  deterministic, no runtime DB read on cold start) vs. generated at build.

### Phase 6 — (stretch, from Yair's "Open") Unify the global context
Yair flagged: the Vapi "Coach Yair" system-prompt global is a **separate copy** from the
code global, and the `{{initial_screen_context}}` slot appears **twice** in the Vapi
prompt. Once `onboarding_globals` exists, make BOTH paths read one source (the Supabase
global), and dedupe the slot. This is the real fix for prompt drift — but it touches the
shared Vapi assistant config, so **flag before changing** (same caution as the idle toggle).

---

## 3b. Sheet-vs-code divergence (from Yonas's 2026-06-28 Beat Context paste)

The Sheet "Beat Context" tab is authored for the **NEW onboarding order** (reflection →
plan-review-FINAL-with-confirm_plan, no morning-setup). The code on this branch is the
**OLD order** (plan-review → MORNING-SETUP → COMPLETE-with-confirm_plan) — the order
change Yair is holding. So the content does NOT cleanly drop in.

Column mapping: the code `context` field == the Sheet **Context** column only (the
`BEAT:` paragraph). The Sheet's Expected-answers / Reactions / Tool-notes columns are
QA/authoring reference and are NOT synced into code today. `allowedTools` is code-owned
(never synced). So a sync only ever writes `context` + `opener`.

**Per-beat verdict (onboarding):**

| screen_id | context | opener | safe to sync? |
|---|---|---|---|
| ONBOARD-01--FORM | identical | identical | ✅ |
| ONBOARD-FORK--FORM | identical | identical | ✅ |
| ONBOARD-BEGINNER-01 | identical | identical | ✅ |
| ONBOARD-BEGINNER-02 | identical | identical | ✅ |
| ONBOARD-BEGINNER-03 | identical | identical | ✅ |
| ONBOARD-BEGINNER-05 | identical | (both none) | ✅ |
| ONBOARD-ADVANCED-02 | identical | identical | ✅ |
| ONBOARD-ADVANCED-04 | identical | identical | ✅ |
| ONBOARD-ADV-CUSTOM | identical | identical | ✅ |
| ONBOARD-ADVANCED-05 | identical | identical | ✅ |
| ONBOARD-BEGINNER-04 | "Habit Configuration" vs code "Habit schedule" | Sheet (none) vs code line | ⚠️ order-tied |
| ONBOARD-BEGINNER-07 | ~close | "One last thing…" (implies last) vs code | ⚠️ order-tied |
| ONBOARD-BEGINNER-06 | **plan-review FINAL + confirm_plan** vs code advance_step-then-more | "…before we start" vs "…keep going" | ❌ ORDER COLLISION |
| ONBOARD-ADVANCED | wording differs | "Tell me everything…" vs "Read me the habits…" | ⚠️ |

Code-only (not in Sheet): `ONBOARD-AUTH--FORM` (silent, fine), `ONBOARD-MORNING-SETUP`,
`ONBOARD-COMPLETE` — the last two are old-order beats the new order drops.

**Why the collision bites:** if we sync BEGINNER-06's Sheet copy ("here's your starting
plan, want to start?") onto this branch, the coach says "let's start" but the engine then
routes to MORNING-SETUP — coach copy desyncs from engine flow. So **10 beats are safe to
sync now; 4 are order-tied and must wait for (or trigger) the order change.**

**Check-in section of the paste** (GLOBAL + morning_*/evening_*/reflection/are_you_done)
is a SEPARATE target — `beat_contexts`/`beatContexts.ts` is onboarding-only. Check-in beat
copy has no `beat_contexts` consumer wired yet (Yair: check-in flows built, not wired), so
it's out of scope for this sync until a consumer exists.

## 4. Open questions for Yair

1. **Source-of-truth (Phase 0):** model A (code-authored) or B (Supabase/Sheet-authored)?
2. **Is the Sheet "Beat Contexts" tab wired to Supabase at all,** or is `seed_beat_contexts.py`
   (from code) the only writer? (Migration header implies the Sheet feeds it; the README
   says code-only. They disagree.)
3. **Seed inline block** — do you know if `seed_beat_contexts.py`'s inlined copy was updated
   in the resync, or should I treat it as stale and rebuild from `beatContexts.ts`?
4. **Global unify (Phase 6)** — OK to make Vapi read the Supabase global so it stops drifting
   from code? That edits the shared Coach Yair assistant prompt.
5. **Migration ledger** — want me to add a `schema_migrations` table/convention so we stop
   guessing what's been run on prod?
```

