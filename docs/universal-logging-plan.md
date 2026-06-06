# Universal Logging — implementation plan & handoff

**Audience:** a fresh Claude Code session (possibly on a different account) that will implement
this in `~/Developer/guided-growth-mvp/`. This doc is self-contained. You do not need the prior
conversation. Read it top to bottom, then execute Steps 1-6.

**Status:** planned, not started. Launch-blocking-ish (Yair wants it in before the founding-user
launch). Owner: Yonas primary, Mint heads-up (see Owners).

---

## Goal

Let any user, at any time, on any screen, log anything they say about their life:
"I did a Fearless Life mission", "spoke to 3 people today", "bought 10 bananas", "ate a lot",
"want to buy a new guitar". Capture it as structured-enough data we can analyze later. The coach
captures it SILENTLY and does NOT derail the current screen's flow.

---

## What already exists (grounded in the repo, verified)

- Mature Supabase schema, 41 migrations in `supabase/migrations/`. Closest analogs:
  `journal_entries` (006), `session_log` (016/017), `chat_messages` (035), anon identity
  `anon_id` (025), `metrics` (041).
- Tool-calling pipeline in `api/llm/[...path].ts`. Tools are SCREEN-GATED via registries:
  `getOnboardingTools(screenId)` / `getCheckinTools(screenId)` are assembled into `requestTools`
  (~lines 449-478). Existing structured loggers `log_metric`, `log_reflection`, `record_checkin`
  exist but ONLY on check-in screens. There is NO universal, always-on logger today.
- Tool schemas live in `api/_lib/llm/tools.ts` (base set), `tools.onboarding.ts`,
  `checkin/schemas.ts`.
- System prompt is built centrally in `api/_lib/llm/buildSystemPrompt.ts`
  (`buildSystemPromptForRequest`), passed to the model as `instructions`.

---

## The design (3 pieces, reuses all existing infra)

1. A new `user_logs` table. ONE flexible table covers every log type. No per-type tables.
2. A new `log_entry` tool in the ALWAYS-ON tool set, so it is present on every screen (unlike
   the screen-gated onboarding/check-in tools).
3. A permanent UNIVERSAL LOGGING block in the global system prompt.

**Key principle:** one flexible table + a controlled vocabulary. The taxonomy below is just the
`category` / `kind` vocabulary and prompt guidance, NOT new tables. Adding log types later means
extending an enum, never a migration.

---

## The taxonomy (the heart of it)

Two axes capture essentially everything a user might log.

### Axis A — `category` (the domain / "kind of log")

| category     | covers                                                               |
| ------------ | -------------------------------------------------------------------- |
| `fitness`    | workouts, exercise, runs, steps, sets/reps                           |
| `nutrition`  | food, meals, what was eaten, portions, hydration, caffeine/alcohol   |
| `health`     | sleep, weight, mood, energy, symptoms, meds, supplements, meditation |
| `social`     | people spoken to, calls, meetings, dates                             |
| `mission`    | Fearless Life missions, coaching actions (GG-specific)               |
| `work`       | tasks done, deep work, accomplishments                               |
| `purchase`   | things bought, spending                                              |
| `wishlist`   | things to buy / things wanted (future)                               |
| `media`      | books, videos, podcasts, music consumed                              |
| `place`      | places visited, travel, events                                       |
| `reflection` | thoughts, ideas, wins, gratitude, learnings                          |
| `intention`  | goals, plans, reminders, "I want to / I'll do"                       |
| `misc`       | anything else                                                        |

### Axis B — `kind` (disposition / tense)

| kind   | meaning               |
| ------ | --------------------- |
| `did`  | it happened (default) |
| `want` | a desire / wish       |
| `plan` | an intention to act   |
| `felt` | a feeling / state     |

### Worked examples

| user says                      | category  | kind | structured                           |
| ------------------------------ | --------- | ---- | ------------------------------------ |
| "bought 10 bananas"            | purchase  | did  | `{"qty":10,"item":"bananas"}`        |
| "want to buy a new guitar"     | wishlist  | want | `{"item":"guitar"}`                  |
| "spoke to 3 people today"      | social    | did  | `{"count":3,"unit":"people"}`        |
| "did my Fearless Life mission" | mission   | did  | `{}`                                 |
| "ate a lot"                    | nutrition | felt | `{"amount":"a lot"}`                 |
| "ran 5k this morning"          | fitness   | did  | `{"distance_km":5,"activity":"run"}` |
| "slept badly"                  | health    | felt | `{"quality":"bad","metric":"sleep"}` |

---

## Artifacts (paste-ready)

### 1. Migration `supabase/migrations/042_user_logs.sql`

> NOTE: Yair is creating this table LIVE in Supabase himself (he pastes the SQL below into the
> Supabase SQL editor). Your only job here is to commit this IDENTICAL SQL as the migration file
> so the repo matches the live DB. It is idempotent (IF NOT EXISTS + guarded policies), so it is
> safe even though the table already exists. Do NOT design a different policy shape: this mirrors
> `chat_messages` (035/036), the current standard. This app keys on `anon_id` (UUID, FK
> `profiles.anon_id`), NOT `auth.users`. Backend writes go through `supabaseAdmin` (service_role,
> which bypasses RLS); the `anon_isolation` policy is for direct authenticated client reads.

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS user_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id     UUID NOT NULL,
  content     TEXT NOT NULL CHECK (length(content) <= 8000),
  category    TEXT,        -- Axis A: fitness|nutrition|health|social|mission|work|purchase|wishlist|media|place|reflection|intention|misc
  kind        TEXT,        -- Axis B: did|want|plan|felt
  structured  JSONB,       -- optional extracted fields, e.g. {"qty":10,"item":"bananas"}
  source      TEXT,        -- screen id, or 'voice' / 'text'
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_logs_anon_fk
    FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_logs_anon ON user_logs (anon_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_category ON user_logs (anon_id, category);

ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_isolation" ON public.user_logs;
CREATE POLICY "anon_isolation" ON public.user_logs
  FOR ALL
  TO authenticated
  USING      (anon_id = (auth.jwt() ->> 'anon_id')::uuid)
  WITH CHECK (anon_id = (auth.jwt() ->> 'anon_id')::uuid);

DROP POLICY IF EXISTS "service_role_only" ON public.user_logs;
CREATE POLICY "service_role_only" ON public.user_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
```

### 2. `log_entry` tool schema (add to the base set in `api/_lib/llm/tools.ts`)

```json
{
  "name": "log_entry",
  "description": "Capture anything the user states about their life as data: an action they did, something they want or plan, a quantity, food, an errand, a Fearless Life mission, people they spoke to, etc. Call this whenever the user volunteers such a fact, even if it is off the current screen's topic. Silent capture, do not derail the conversation.",
  "parameters": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The user's statement, verbatim or lightly cleaned."
      },
      "category": {
        "type": "string",
        "enum": [
          "fitness",
          "nutrition",
          "health",
          "social",
          "mission",
          "work",
          "purchase",
          "wishlist",
          "media",
          "place",
          "reflection",
          "intention",
          "misc"
        ],
        "description": "Best-guess domain, use misc if unsure."
      },
      "kind": {
        "type": "string",
        "enum": ["did", "want", "plan", "felt"],
        "description": "Did it happen (did), is it a wish (want), an intention (plan), or a feeling/state (felt)."
      },
      "structured": {
        "type": "object",
        "description": "Optional extracted fields, e.g. {\"qty\":10,\"item\":\"bananas\"} or {\"count\":3,\"unit\":\"people\"}."
      }
    },
    "required": ["content"],
    "additionalProperties": false
  }
}
```

### 3. Global system-prompt block (add to `api/_lib/llm/buildSystemPrompt.ts`)

```
UNIVERSAL LOGGING. At any moment the user may volunteer something about their life: an action
they took, something they want, plan, ate, or bought, a Fearless Life mission, people they
spoke to, a quantity, anything. Whenever they do, silently call log_entry to capture it as data,
even if it is unrelated to the current screen. Pick the best category and kind from the allowed
lists. Capture first, then continue exactly where you were. Do NOT switch topics, start coaching
on it, or treat it as a new thread. A brief acknowledgement ("got it, logged") is fine, derailing
is not. This ability is always available to you, on every screen.
```

---

## Steps to execute (in order)

1. **Migration 042** above: table + RLS mirroring the current standard table. Run via
   `scripts/run-migration.mjs`. (backend / data = Yonas)
2. **Register `log_entry`** in the base tool set in `api/_lib/llm/tools.ts`.
3. **Make it global:** in `api/llm/[...path].ts` where `requestTools` is assembled (~lines
   449-478), concat `log_entry` for EVERY screen, not gated by the onboarding/check-in
   registries. This is the one subtle bit: the other tools are screen-scoped on purpose;
   log_entry must escape that gating.
4. **Wire the handler:** in the tool-execution path of `api/llm/[...path].ts`, on
   `name === 'log_entry'`, insert into `user_logs` (user_id / anon_id from the request,
   content / category / kind / structured from args, source = screenId) via `supabaseAdmin`.
5. **Add the global prompt block** to `buildSystemPrompt.ts` so it is in every system prompt.
6. **Smoke test** each worked example above. Confirm a `user_logs` row lands with the right
   category / kind / structured, AND the coach does not change topic.

---

## Product-consistency guardrail (do not skip)

GG's locked rule: the coach must NOT engage with off-topic input (off-topic engagement is a
known AI-Learning finding, and the feedback session uses a drift redirect to evening reflection
or daily check-in, not free coaching). This feature CAPTURES silently and stays on the current
flow. Capture is not engage. The prompt block enforces this. Keep it exactly as written.

---

## Owners

- **Yonas** (backend / platform / anon_id data): Step 1 (migration 042) and Step 4 (the
  log_entry handler insert).
- **Mint** (LLM brain): Steps 2, 3, 5 (tool schema + global tool wiring + global prompt) are
  normally his surface. Small enough that Yonas can do all six solo for launch; if so, give Mint
  a heads-up since the prompt and tool set are his.

---

## Phase 2 (post-launch, the "see all the common ones" idea — do NOT build for launch)

The payoff of capturing this data is surfacing it back:

- A **Logs view** in the app grouping `user_logs` by category, newest first.
- A periodic **insights / rollup pass** (cheap model, e.g. Haiku, scheduled, NOT an in-session
  tool) that reads recent logs and summarizes: "this week: 4 workouts, 11 people, 2 missions,
  3 grocery runs, 1 wishlist item." This is the "separate agent" Yair mentioned: a background
  job, not something running inside every coach turn (keeps cost off the per-session path).
- Optional: promote high-value categories (fitness, nutrition) into typed views or link them to
  the existing `metrics` / habit tables so they roll into the check-in experience.

Ship Pieces 1-3 first. Phase 2 is a separate, later effort.

```

```
