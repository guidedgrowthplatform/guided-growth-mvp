# Reflection Mode + Editable Prompts — Deep Implementation Plan

**Date:** 2026-06-17 · **Author:** Yonas (+ Claude research)
**Status:** DRAFT — pending Figma (runtime + EDIT-REFLECTION screens) and onboarding-ownership sync with Jamy.

---

## 0. Decisions locked

| Decision         | Choice                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| Guided prompts   | **Fully editable** — guided & custom collapse into ONE editable list           |
| Mode model       | **`'prompts' \| 'freeform'`** (NOT the spec's 3-way guided/custom/freeform)    |
| Depth            | **Full stack** — onboarding (both paths) + DB + tools + runtime + edit surface |
| Storage          | **Proper DB modeling** — dedicated runtime table, read at runtime              |
| Visual reference | gg-spec packets + advanced code now; **Figma to refine runtime/edit screens**  |

### Canonical model (single source of truth for the whole feature)

```ts
type ReflectionMode = 'prompts' | 'freeform';

interface ReflectionSettings {
  mode: ReflectionMode;
  prompts: string[]; // used when mode==='prompts'; defaults pre-filled; user-editable
  time: string; // 'HH:MM'
  days: number[]; // 0..6
  reminder: boolean;
  schedule: string; // 'Weekday' | 'Weekend' | 'Every day' (derived label)
}

const DEFAULT_PROMPTS = [
  'What am I proud of today?',
  'What do I forgive myself for today?',
  'What am I grateful for today?',
];
```

> **Why this resolves the spec contradiction:** gg-spec `ONBOARD-BEGINNER-07/08` lists guided/custom/freeform; `ONBOARD-ADVANCED-04` lists only custom/freeform. "Guided" was just "the default 3, not editable." Making guided editable means guided == custom == "prompts mode with a (possibly default) list." Two modes only. This is a deliberate, documented divergence from the spec — flag to Yair/product.

> **Voice framing stays "three styles" (Figma-confirmed):** the onboarding coach bubble says _"Three styles: guided prompts, your own questions, or freeform."_ That copy is fine and need not change — the three _styles_ map onto the two _modes_: guided = prompts mode with `DEFAULT_PROMPTS` untouched, "your own questions" = prompts mode edited, freeform = freeform. The data model is `prompts | freeform`; the UX language is three options.

---

## 1. Current state (verified by research)

### What exists

- **Beginner onboarding** `src/pages/onboarding/beginner/Step6Page.tsx` (screenId `ONBOARD-BEGINNER-07`, route `/onboarding/step-6`) → renders `src/components/onboarding/DailyReflectionCard.tsx`: 3 **hardcoded** questions (display-only, not selectable) + time/days/reminder. **No mode choice, no "Create My Own Prompts".**
- **Advanced onboarding** already has the mode UI:
  - `src/pages/onboarding/advanced/AdvancedStep6Page.tsx` (`ONBOARD-ADVANCED-04`) — "Optional: Create My Own Prompts" button.
  - `src/pages/onboarding/advanced/AdvancedCustomPromptsPage.tsx` (`ONBOARD-ADV-CUSTOM`) — "How do you want to journal?", `journalMode: 'freeform' | 'custom'`, full prompt editor, voice `fill_field customPrompts[N]`.
- **Tools (×4):** `submit_reflection_config` + `submit_custom_prompts`, each in `api/_lib/vapi/handlers/` and `api/_lib/llm/onboarding/handlers/`. Schemas in `api/_lib/llm/tools.onboarding.ts` (Vapi) and `api/_lib/llm/onboarding/schemas.ts` (Direct-LLM).
- **Voice action mapping:** `src/lib/onboarding/toolEventToVoiceActions.ts` (`set_reflection_config`, `fill_field customPrompts[N]`).
- **Runtime journal:** `src/pages/JournalFlowPage.tsx` (guided/freeform tabs) → `src/api/journal.ts` → `api/reflections/[...path].ts` → `journal_entries` + `journal_entry_fields`. Guided template_id hardcoded `'daily-reflection'`.

### The gaps (the actual work)

1. **`journalMode` is never persisted** — UI-only state in `AdvancedCustomPromptsPage`, dropped on navigation. No `journalMode` in `OnboardingStepData`, no tool param, no write.
2. **`customPrompts` saved to `onboarding_states.data` but never read at runtime** — `GuidedTab.tsx:3-7` hardcodes prompts.
3. **`reflectionConfig` also never materialized to runtime** — onboarding-complete (`api/onboarding/[...path].ts`) writes habits → `user_habits` but **no reflection config anywhere runtime-readable**.
4. **`reflection_configs` table was DROPPED** (`supabase/migrations/042_drop_legacy_reflections.sql`). There is no runtime reflection-settings store today.
5. **Prompts hardcoded at DISPLAY time in 2 places** — `GuidedTab.tsx` and `ReflectionDetailPage.tsx:12-16` (note: even the wording differs from onboarding — two independent hardcoded arrays). Editable prompts ⇒ historical entries mis-render unless snapshotted.
6. **No post-onboarding edit surface** — `EditJournalPage.tsx` is onboarding-only (redirects without nav state); `SettingsPage.tsx` has check-in times only. Spec `EDIT-REFLECTION-01/02` = no code, AI blocks all `TODO`.
7. **Beginner mode-choice screen (`ONBOARD-BEGINNER-08`) does not exist** in routes; advanced has its equivalent.

---

## 2. Target architecture

```
ONBOARDING (both paths)                 RUNTIME
──────────────────────                  ───────
mode + prompts + schedule  ──complete──▶ reflection_settings (NEW table, anon_id)
captured via shared UI                          │
+ tools (mode-aware)                            ├─▶ GET /api/reflections/config  ──▶ useReflectionSettings()
                                                │        │
                                                │        ├─▶ JournalFlowPage (which tabs / default)
                                                │        └─▶ GuidedTab (renders user's prompts)
                                                │
                                                └─▶ SettingsPage reflection editor
                                                         └─▶ PUT /api/reflections/config

ENTRY SAVE: snapshot prompts onto the entry  ──▶ ReflectionDetailPage renders entry's OWN prompts
```

---

## 3. Data model & migrations

### 3.1 New table `reflection_settings` (runtime source of truth)

New migration, e.g. `supabase/migrations/0XX_reflection_settings.sql`. Mirror existing anon_id-keyed pattern (see `025_anon_id.sql`, `user_preferences`).

```sql
CREATE TABLE reflection_settings (
  anon_id      UUID PRIMARY KEY REFERENCES profiles(anon_id) ON DELETE CASCADE,
  mode         VARCHAR(20) NOT NULL DEFAULT 'prompts'
               CHECK (mode IN ('prompts','freeform')),
  prompts      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- string[]; empty when freeform
  time         VARCHAR(5),                            -- 'HH:MM'
  days         JSONB NOT NULL DEFAULT '[]'::jsonb,    -- number[]
  reminder     BOOLEAN NOT NULL DEFAULT true,
  schedule     VARCHAR(20),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- RLS: follow gotcha #5 — service-role bypasses RLS; enforce `WHERE anon_id = $1` in every query. Add a fail-closed policy mirroring other tables for defense-in-depth.
- **Decision point:** dedicated table (recommended — clean, queryable, matches `user_habits` materialization pattern) vs. columns on `user_preferences`. Going with dedicated table. (Old `reflection_configs` name avoided to prevent confusion with the dropped legacy table.)

### 3.2 Per-entry prompt snapshot (historical integrity)

The hard requirement from gap #5. Two options:

- **Option A (recommended): add `prompts_snapshot JSONB` to `journal_entries`.**
  ```sql
  ALTER TABLE journal_entries ADD COLUMN prompts_snapshot JSONB;  -- string[] for template entries
  ```
  At save, write the exact prompt list shown. `ReflectionDetailPage` renders `entry.prompts_snapshot[i]` instead of hardcoded `GUIDED_PROMPTS`. Backfill existing template entries with `DEFAULT_PROMPTS` in the migration.
- **Option B:** change `journal_entry_fields.field_key` from index → prompt text. More invasive (touches list/preview formatters keyed by `'0'`), and breaks `previewText()` assumptions. **Reject.**

### 3.3 Shared types (`packages/shared/src/types/index.ts`)

- Extend `OnboardingStepData`: add `reflectionMode?: 'prompts' | 'freeform'` (keep `customPrompts`, `reflectionConfig`).
- New runtime types: `ReflectionSettings`, `ReflectionSettingsUpdate`.
- Extend `JournalEntry` + `JournalEntryCreate`: add `prompts_snapshot?: string[] | null`.

---

## 4. Backend — API & tools

### 4.1 Reflection-config endpoint (mind the 12-function limit)

Add **sub-routes inside the existing catch-all** `api/reflections/[...path].ts` — do NOT add a new top-level function (currently 8/12, but stay disciplined).

- `GET  /api/reflections/config` → read `reflection_settings` (default `{ mode:'prompts', prompts: DEFAULT_PROMPTS, ... }` if no row).
- `PUT  /api/reflections/config` → upsert (validate mode, prompts ≤10 × ≤280 chars reusing existing `submitCustomPrompts` limits, time/days/schedule via `validation.ts`).
- Add `vercel.json` rewrite for the bare path if needed.

### 4.2 Tools — make them mode-aware (all 4 handlers + 2 schema files)

- **Schemas:** `api/_lib/llm/tools.onboarding.ts` (Vapi) + `api/_lib/llm/onboarding/schemas.ts` (Direct-LLM):
  - Add `mode: 'prompts' | 'freeform'` param to `submit_reflection_config` (or a new `set_reflection_mode` tool — see decision below).
  - Keep `submit_custom_prompts` (rename concept to "edit prompts"); ensure it sets `reflectionMode='prompts'`.
- **Handlers (×4):** `submitReflectionConfig.ts` + `submitCustomPrompts.ts` in both `api/_lib/vapi/handlers/` and `api/_lib/llm/onboarding/handlers/`:
  - Accept + persist `reflectionMode` into `onboarding_states.data`.
  - `submit_custom_prompts` → also set `reflectionMode='prompts'` (filling prompts implies prompts mode, matching the frontend auto-switch).
- **Decision:** fold `mode` into `submit_reflection_config` (fewer tools, simpler screen tool-lists) vs. a dedicated `set_reflection_mode`. Lean **fold-in** unless Figma's BEGINNER-08 needs a standalone mode call. Revisit after Figma.

### 4.3 Onboarding-complete handoff (the missing materialization)

`api/onboarding/[...path].ts` complete handler (~lines 49-148): after habits → `user_habits`, **also upsert `reflection_settings`** from `onboarding_states.data` (`reflectionMode`, `customPrompts` or `DEFAULT_PROMPTS`, `reflectionConfig.{time,days,reminder,schedule}`). This is net-new — reflection config is currently dropped on the floor at completion.

### 4.4 Voice action mapping (`src/lib/onboarding/toolEventToVoiceActions.ts`)

- Extend `submit_reflection_config` → include `mode` in `set_reflection_config` params.
- Confirm `submit_custom_prompts` → `fill_field customPrompts[N]` still drives the editor; add a mode signal if a standalone tool is chosen.

### 4.5 Screen contexts

- `src/generated/screen_contexts.json` + DB `screen_contexts` (read by `api/_lib/llm/buildSystemPrompt.ts`): add/update blocks + ALLOWED TOOLS for `ONBOARD-BEGINNER-08`, `ONBOARD-ADVANCED-04`, and the new EDIT-REFLECTION screens. Keep the Direct-LLM `stripForwardPointers` behavior (gotcha #10) intact.

---

## 5. Frontend — onboarding (both paths, unified)

### 5.1 Shared mode component

Generalize `AdvancedCustomPromptsPage`'s mode+editor into a reusable component (e.g. `src/components/onboarding/ReflectionModeEditor.tsx`): props `mode`, `prompts`, `onModeChange`, `onPromptsChange`. Used by both paths and (read-mostly variant) by the runtime Settings editor.

- Keep `DailyReflectionCard` for schedule controls; add the "Create My Own Prompts" entry button to the beginner card.

### 5.2 Beginner path — add `ONBOARD-BEGINNER-08`

- New page `src/pages/onboarding/beginner/Step6PromptPage.tsx` (route between current step-6 and step-7), screenId `ONBOARD-BEGINNER-08`, rendering `ReflectionModeEditor`.
- Register route in `src/routes/index.tsx` (lazy import + `<Route>`).
- `Step6Page.tsx`: change `navigate('/onboarding/step-7')` → new screen; on continue, `saveStepAsync` with `reflectionMode` + `customPrompts`.
- **Voice auto-nav caveat (`useAgentNavigation`):** if the agent bumps `current_step` past the new screen, it's skipped. Mitigate by (a) agent setting mode/prompts via tool before `navigate_next`, and/or (b) renumber steps so the screen has its own index. Decide during impl; lean on (a) since tools already fire before nav.
- `useStepTiming` / `STEP_TO_SCREEN_ID` / PostHog `configure_journal`: update step numbering.

### 5.3 Advanced path — persist what's already collected

- `AdvancedCustomPromptsPage` / `AdvancedStep6Page`: write `reflectionMode` (not just `customPrompts`) through `saveStepAsync`. Trace the exact drop point (return nav `state` only) and replace with persistence.

### 5.4 Plan review (`PlanReviewPage` + `PlanSummaryCard` + `planReviewDerive.ts`)

- Surface mode + prompts on the reflection summary card (today shows only cadence + reminder). Add `customPrompts`/`mode` to `deriveStateFromOnboarding` and the card props (or a `ReflectionPlanSummaryCard`).

---

## 6. Frontend — runtime (make it actually use the config)

### 6.1 Read hook + wiring

- New `src/hooks/useReflectionSettings.ts` → `GET /api/reflections/config` (React Query).
- `JournalFlowPage.tsx`: **per-night toggle (decided)** — ALWAYS render both Guided/Freeform tabs; `mode` only sets the _default_ active tab. The user can flip guided↔freeform any night without editing settings. Pass user prompts into the guided tab.
- `GuidedTab.tsx`: replace hardcoded `PROMPTS` with prompts from settings.
- **Save:** include `prompts_snapshot` in `JournalEntryCreate` (the exact prompts shown).

### 6.2 Display past entries correctly

- `ReflectionDetailPage.tsx`: render `entry.prompts_snapshot[i]` (fallback to `DEFAULT_PROMPTS` for legacy/backfilled entries) instead of hardcoded `GUIDED_PROMPTS`.
- `reflectionFormatters.ts` `previewText()`: unaffected (keys by answer), but verify.

### 6.3 Post-onboarding edit surface (EDIT-REFLECTION-01/02)

- Add a **Reflection** section to `SettingsPage.tsx` (mode, prompts editor, time/days/reminder) → `PUT /api/reflections/config`. Reuse `ReflectionModeEditor` + existing schedule pickers / `ReminderSheet` pattern.
- **Figma-dependent:** exact layout of EDIT-REFLECTION-01 (entry card + "Create My Own Prompts") and -02 (mode + prompt list). Hold final UI until links arrive.

---

## 7. Phasing (suggested PR breakdown)

1. **PR1 — Data + handoff (no UI behavior change):** `reflection_settings` table + `prompts_snapshot` column + backfill; shared types; onboarding-complete materialization; `GET/PUT /api/reflections/config`. Ships dormant.
2. **PR2 — Runtime reads config:** `useReflectionSettings`, `GuidedTab`/`JournalFlowPage` read prompts, entry save writes `prompts_snapshot`, `ReflectionDetailPage` reads snapshot. (Now editable prompts are _honored_ even though only defaults exist yet.)
3. **PR3 — Onboarding parity:** mode-aware tools/handlers/voice actions; advanced persists `reflectionMode`; beginner gets `ONBOARD-BEGINNER-08` + `ReflectionModeEditor`; plan-review shows mode/prompts; screen_contexts updated.
4. **PR4 — Settings edit surface (EDIT-REFLECTION):** Settings reflection section + Figma-final UI.

Each PR: `npx tsc --noEmit`, `npm run build`, `npx vitest run`. Add unit tests for the config endpoint validation + snapshot rendering.

---

## 8. Open questions / needs from you

**Resolved (2026-06-17):**

- ~~Ownership~~ — Yonas works in the onboarding/reflection domain; no cross-owner gating needed.
- ~~Mode at runtime~~ — **per-night toggle**: always show both tabs, `mode` sets the default (Section 6.1).
- ~~Onboarding Figma~~ — received (Images #2/#3); confirms reflection card + "Create My Own Prompts" + mode-choice; voice framing "three styles" kept.

**Still open:**

1. **Figma for runtime + edit screens** — EVENING-REFLECTION-GUIDED/FREEFORM, EDIT-REFLECTION-01/02, HOME-DAILY-REFLECTION. All Figma shared so far is onboarding. Planning these from gg-spec packets + reused onboarding components until/unless designs arrive.
2. **Mode tool shape:** fold `mode` into `submit_reflection_config` vs. standalone `set_reflection_mode`. Lean fold-in (BEGINNER-08 is a sub-flow off the reflection card, not a hard separate step in the Figma).
3. **Spec divergence sign-off:** collapsing guided/custom → "prompts" — OK to flag to Yair as an intentional spec deviation?

---

## 9. File-change index (quick reference)

**Migrations:** new `reflection_settings` table; `ALTER journal_entries ADD prompts_snapshot`.
**Shared types:** `packages/shared/src/types/index.ts`.
**API:** `api/reflections/[...path].ts` (config sub-routes), `api/onboarding/[...path].ts` (materialize), `vercel.json`.
**Tools:** `api/_lib/llm/tools.onboarding.ts`, `api/_lib/llm/onboarding/schemas.ts`, `api/_lib/{vapi,llm/onboarding}/handlers/submitReflectionConfig.ts` + `submitCustomPrompts.ts`, `src/lib/onboarding/toolEventToVoiceActions.ts`, `src/generated/screen_contexts.json` (+ DB rows).
**Onboarding FE:** `src/pages/onboarding/beginner/Step6Page.tsx` (+ new `Step6PromptPage.tsx`), `src/pages/onboarding/advanced/AdvancedStep6Page.tsx` + `AdvancedCustomPromptsPage.tsx`, `src/routes/index.tsx`, `src/components/onboarding/DailyReflectionCard.tsx` (+ new `ReflectionModeEditor.tsx`), `src/pages/onboarding/shared/PlanReviewPage.tsx` + `PlanSummaryCard.tsx` + `planReviewDerive.ts`, `src/hooks/useOnboarding*`.
**Runtime FE:** new `src/hooks/useReflectionSettings.ts`, `src/pages/JournalFlowPage.tsx`, `src/components/journal/GuidedTab.tsx`, `src/pages/ReflectionDetailPage.tsx`, `src/api/journal.ts`, `src/pages/SettingsPage.tsx`.
</content>
</invoke>
