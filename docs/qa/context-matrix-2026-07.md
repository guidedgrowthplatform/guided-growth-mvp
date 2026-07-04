# Onboarding context-chain QA matrix (Lane 3 / Slot D), 2026-07

Deliverable of C1 (fable-lane-context-qa-2026-07-03.md). Audited against app-repo commit **5750a2fb** (origin/staging after the merge train !398 !400 !401 !397 !403 !402). Beat order ground truth: `src/onboarding-flow/flows/onboarding-beginner-v1.generated.json` on that commit (Yair-confirmed 2026-07-03). All findings from reading code and generated artifacts, not handoffs.

## How the chain actually wires (verified)

Two context lanes exist per beat, and they are NOT the same content:

- **Direct-LLM lane (Path 2/3 text + card-fill)**: `api/_lib/llm/buildSystemPrompt.ts:120,181` assembles `GLOBAL_ONBOARDING_CONTEXT` + `BEAT_CONTEXTS[screenId]` (from `api/_lib/llm/onboarding/beatContexts.ts`, hand-authored defaults **overlaid by** `beatContexts.generated.json` — Supabase-synced 2026-06-29, bundleVersion 2) + `canonicalOptions.ts` blocks + `ONBOARDING_TOOL_ADDENDUM` + `NO_PRENARRATION_RULE` + `NO_INTERNAL_NARRATION_RULE`. allowedTools = code-owned defaults, **replaced** by the flow-builder overlay from `src/generated/onboarding_combined.json` (`beatContexts.ts:406-428`), with an advance_step retention guard (`beatContexts.ts:420-422`, landed via the train).
- **Vapi lane (Path 1 live voice)**: `OnboardingVoiceProvider.tsx:466` (mid-session `pushScreenContext`) and `:1035-1055` (cold-start `buildAssistantOverrides`) source `getScreenContext()` → the **screens-era bundle** `src/generated/screen_contexts.json`, falling back to `/api/context` (Supabase `screen_contexts`) for screens not in the bundle (`src/lib/context/getScreenContext.ts:49-55`). The dashboard prompt (`scripts/vapi-sync/assistant.ts`) has RULE 8 + RULE 10 but **no RULE 11 / Component Sync rule**. The Vapi lane never sees `beatContexts.ts` or its synced overlay.

**Headline finding: every anti-improvisation layer added since 6-29 lives only on the Direct-LLM lane. The Vapi lane still runs the old screens-era contexts, two of which explicitly instruct the coach to narrate the option list (the exact behavior the locked rules forbid).** See mismatches M1–M3.

## The three dropped constraint layers (named, per the 6-27 proposal §3c)

- **Layer A — per-beat DO NOT block** (old: per-screen `DO NOT:` line).
- **Layer B — in-context option list with an explicit read-aloud prohibition** (old: `CATEGORIES (for tool matching only — do NOT read these aloud)` / `GOAL OPTIONS BY CATEGORY ... offer ONLY ... verbatim`).
- **Layer C — named arrival/speak pattern reinforced per screen** (old: ARRIVAL PATTERN with GOOD/BAD examples in the addendum AND echoed per screen).

Status on the **Direct-LLM lane** (effective = synced overlay): A **restored** on all option-bearing + v3 beats (per-beat DO NOT blocks, v2 entries). B **superseded** (options move to `canonicalOptions.ts` injection + tool-schema enums + the global "reference, not a script" rule; the SILENT_OPTIONS marker names the prohibition per beat). C **restored** as SPEAK MODE markers + the synced global's `## Speak mode` and `## Component sync` sections (the proposal's rule, including stay-silent-on-render-failure, is LIVE in the synced global).
Status on the **Vapi lane**: A/B/C all **still dropped** for the new-beat era — worse, the old blocks actively contradict them (M1).

## Beat matrix (flow order; both fork paths)

Improvisation class = opener class / reply class. "BC match" = effective beat context (after overlay) matches the beat's actual component + order. allowedTools shown are the effective union (flow overlay ∘ guard; verified identical between `onboarding_combined.json` and the generated flow).

| # | Beat (screenId) | Component | persistStep | BC exists/matches | allowedTools (effective) | Improv class | DO-NOT present | Layer A/B/C (Path-3) | Mismatches |
|---|---|---|---|---|---|---|---|---|---|
| 0 | auth (ONBOARD-AUTH--FORM) | auth | — | yes / yes (silent beat) | [] | silent / silent | n/a (no options) | n/a | Vapi lane: not in bundle (bundle has legacy AUTH-SIGNUP) → M2 |
| 0 | mic (MIC-PERMISSION) | mic-permission | — | yes / yes | [] | MP3 verbatim / none | n/a | C restored | — |
| 1 | profile (ONBOARD-01--FORM) | profile-input | 1 | yes / yes | submit_profile, advance_step | Cartesia verbatim / improvise-in-bounds | partial (no DO NOT block; constraints inline) | A partial, B superseded (canonicalOptions Profile block), C restored | M5 (opener vs flow line), M1 (Vapi lane old block) |
| 2 | why-intro (ONBOARD-WHY-INTRO) | why-intro | — | yes / yes | [] | MP3 verbatim / none | n/a | C restored | Vapi lane: not in bundle → M2 |
| 2 | state-check (ONBOARD-STATE-CHECK) | state-check | 6 | yes / yes | record_checkin, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B n/a, C restored | M4 (step 6 collision), M6 (advance_step allowed but addendum forbids), M2 |
| 3 | morning-checkin-setup (ONBOARD-MORNING-SETUP) | morning-checkin-setup | 7 | yes / yes | submit_morning_checkin, advance_step | MP3 verbatim / improvise-in-bounds | no (short beat, low option risk) | A retired (consciously — no options), B n/a, C restored | M6, M2 |
| 3 | reflection-setup (ONBOARD-BEGINNER-07) | reflection-card | 6 | yes / yes (v2, option-bearing) | submit_reflection_config, submit_custom_prompts, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B superseded (styles on card; SILENT_OPTIONS), C restored | **M4 (persistStep 6 duplicates state-check; addendum says 6–8)**, M6, M1 (Vapi lane old BEGINNER-07 block) |
| — | path-fork (ONBOARD-FORK--FORM) | path-selection | 2 | yes / yes (v2) | submit_path_choice, ask_clarification, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B superseded, C restored | M5 (synced opener ≠ flow/MP3 line) |
| 4 | category (ONBOARD-BEGINNER-01) | category-grid | 3 | yes / yes (v2) | submit_category, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B superseded (tool enum; SILENT_OPTIONS), C restored | **M1: Vapi bundle block instructs "list the 8 categories in ONE short sentence"** |
| 5 | goals (ONBOARD-BEGINNER-02) | goals-list | 4 | yes / yes (v2) | submit_goals, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B superseded (canonicalOptions), C restored | **M1: Vapi bundle block instructs "List in one short sentence"** |
| 6 | habit-select (ONBOARD-BEGINNER-03) | habit-picker | 5 | yes / yes (v2) | add_habit, remove_habit, advance_step | MP3 verbatim / improvise-in-bounds | yes (strongest; includes sub-list rule) | A restored, B superseded (canonicalOptions), C restored | — (Vapi bundle block for -03 has no narrate instruction) |
| 7 | habit-schedule (ONBOARD-BEGINNER-04) | habit-schedule | 5 | yes / yes (v2) | add_habit, update_habit, advance_step | MP3 verbatim / **live-voice improvise** (per Vapi-where map) | yes | A restored, B n/a, C restored | **M4 (persistStep 5 duplicates habit-select; addendum ladder says 6)** |
| 4 | advanced-input (ONBOARD-ADVANCED) | advanced-capture | 3 | yes / yes (v2, build/break capture) | submit_brain_dump, advance_step | MP3 verbatim / **live-voice improvise** | yes | A restored, B n/a (freeform), C restored | — |
| 5 | advanced-frequency (ONBOARD-ADVANCED-FREQUENCY) | advanced-frequency | 4 | yes / yes | add_habit, update_habit, advance_step | MP3 verbatim / improvise-in-bounds | yes | A restored, B n/a, C restored | M2 (not in bundle) |
| 9 | into-app (ONBOARD-COMPLETE) | into-app | — | yes / yes | update_habit, confirm_plan | MP3 verbatim / improvise-in-bounds | no (confirm beat) | A retired (consciously), B n/a, C restored | M2 |
| 10–14 | weekly-projection ×5 (BLANK/FULL/P78/P36/GAPS) | weekly-projection | — | yes / yes | [] | MP3 verbatim / silent | yes (no-improvise + frame-specific) | A restored, B n/a, C restored | M2 (none in bundle) |

## Mismatch list (file:line evidence)

- **M1 — Vapi lane runs contradictory screens-era contexts.** `src/contexts/OnboardingVoiceProvider.tsx:466` + `:1049` feed Vapi from `src/generated/screen_contexts.json`. That bundle's `ONBOARD-BEGINNER-01.context_block` says `ARRIVAL: list the 8 categories in ONE short sentence … "What feels most worth working on — sleep, movement, eating…"` and `ONBOARD-BEGINNER-02.context_block` says `List in one short sentence` — direct instructions to narrate option lists, contradicting the synced global `## Component sync` ("Don't read the list out loud, not in full, not a few of them, not even one as an example"). The demo's list-narration bug class cannot be closed while Vapi consumes these. The old blocks also teach the old-era `navigate_next` ladder and NEXT: pointers (intentional for Vapi nav — any fix must preserve nav pointers, see CLAUDE.md gotcha #10).
- **M2 — 11 of 20 flow screens are missing from the Vapi bundle.** `ONBOARD-AUTH--FORM` (bundle has legacy `AUTH-SIGNUP`), `ONBOARD-WHY-INTRO`, `ONBOARD-STATE-CHECK`, `ONBOARD-MORNING-SETUP`, `ONBOARD-ADVANCED-FREQUENCY`, `ONBOARD-COMPLETE`, `ONBOARD-WEEKLY-PROJECTION-{BLANK,FULL,P78,P36,GAPS}`. Each falls back to `/api/context` → Supabase `screen_contexts` (`src/lib/context/getScreenContext.ts:49-55`), which is seeded from the same screens-era Sheet (`scripts/voice-sync/seed_contexts.py`). Whether those rows exist at all is **unverified** (to check in C4 live pass); if absent, Vapi gets no beat context on those screens.
- **M3 — No RULE 11 in the Vapi dashboard prompt.** `scripts/vapi-sync/assistant.ts` has RULE 8 (:130) and RULE 10 (:257, assumes cards are visible) but no Component-Sync/render-failure rule (proposal §6, "RULE 11"). The synced global's Component-sync section never reaches Vapi.
- **M4 — persistStep vs addendum step identities.** Generated flow: state-check persistStep 6 (`onboarding-beginner-v1.generated.json:425`) **and** reflection-setup persistStep 6 (`:631`) — a collision; `systemPromptAddendum.ts:13` says the state-check/morning/reflection beats carry steps 6–8, implying reflection = 8. habit-schedule persistStep 5 (`:1178`) duplicates habit-select (`:1073`) while the addendum ladder says habit-schedule is step 6 (→7). Resume-by-step and the LLM's step identity can disagree on these beats. Mechanism is Lane 1 / anchor territory (`useFlowOrchestrator` resume walk) — **filed as a ledger row, not fixed here**.
- **M5 — Opener divergence between the spoken line and the beat context.** Flow/MP3 line vs synced beatContexts opener: `ONBOARD-FORK--FORM` flow `"Have you tracked habits before, or is this new for you?"` vs synced `"Quick one. … Both are totally fine."`; `ONBOARD-01--FORM` flow line ends `"…How old are you?\nAnd your gender?"` vs synced opener stops at `"How old are you?"`. Standing rule: verbatim lines must match their MP3 transcripts — the beat context's opener is what the LLM believes it said. Small wording fixes, my lane (C2), through the Sheet/sync.
- **M6 — Self-advancing beats still allow advance_step.** `systemPromptAddendum.ts:11` forbids advance_step on ONBOARD-STATE-CHECK / ONBOARD-MORNING-SETUP / ONBOARD-BEGINNER-07 (data tool self-advances), yet all three carry advance_step in their effective allowedTools (flow overlay). Likely intentional fallback; needs an explicit justification or removal in C3's codification. Low severity.
- **M7 — Stale hand-authored fallbacks.** `beatContexts.ts` defaults for the option-bearing beats (BEGINNER-01/02/03/04, FORK, BEGINNER-07, 01--FORM, ADVANCED, COMPLETE, MORNING-SETUP) predate the synced v2 content — no SPEAK MODE/DO NOT. The file's own principle (comment at `beatContexts.ts:234-238`: defaults copied verbatim from the synced file so entries stay correct if the sync is absent) is broken for these 10 beats. If the generated overlay is ever empty/reverted, the anti-improvisation layer silently vanishes. C2 fixes this in-repo.
- **M8 — Overlay filter hides tool-name drift.** `beatContexts.ts:416` silently drops overlay tool names that fail `isOnboardingToolName` — a builder export naming a removed tool would be masked, not flagged. C3's parity test must fail loudly on this.
- **M9 — Orphan context entries (staleness, not runtime risk).** `BEAT_CONTEXTS` + the synced overlay carry beats absent from the generated flow: COACH-GREETING, ONBOARD-BEGINNER-05, ONBOARD-BEGINNER-06, ONBOARD-ADVANCED-02, ONBOARD-ADVANCED-04, ONBOARD-ADV-CUSTOM, ONBOARD-ADVANCED-05. The addendum correctly marks BEGINNER-06/ADVANCED-05 as legacy ids (`systemPromptAddendum.ts:7`). Keep or prune consciously in C3.

## C4 static pass — opener wording vs spec (oracle: flow-annotated-render @ 5de9a561, onboardingMetadata.json)

Filled 2026-07-03 by code comparison (browser walk still pending). Oracle wording is marked PROVISIONAL by Yair; per the bugfix plan, where app and page disagree the page wins, and page-looks-wrong goes to Yair. Beat ORDER ground truth stays the generated flow (Yair 2026-07-03) — order deltas are recorded, not acted on.

**Match (15/20):** mic, why-intro, fork→beginner beats BEG-01/02/03, BEG-07 (framing opener, Option B), advanced, advanced-frequency, complete, weekly-projection ×5, auth (both silent).

**Wording deltas (page wins → NEEDS-YAIR to confirm, then builder-lane/MP3 work):**
- W1 `ONBOARD-FORK--FORM`: oracle + synced beatContexts say "Quick one. … Both are totally fine."; the flow/MP3 line is the short form. The MP3 transcript is the stale side (recording exists for the short line) → needs a re-recorded clip or an oracle downgrade. Supersedes M5's first item.
- W2 `ONBOARD-01--FORM`: flow lines add "And your gender?" beyond the oracle/synced opener ("…How old are you?").
- W3 `ONBOARD-STATE-CHECK`: oracle opener is only "Let's do your first check-in right now." with per-element clips (sleep/mood/energy/stress, reusing daily state clips); flow/synced append "How are you landing in this moment? Mood, energy, sleep, anything on you."
- W4 `ONBOARD-MORNING-SETUP`: oracle is Option A — NO framing opener, element lines lead ("Weekdays, weekends, or every day?" etc.); app has a framing opener.
- W5 `ONBOARD-BEGINNER-04`: same Option A delta — oracle says no framing opener, app has one.

**Structural deltas (recorded only; flow order is ground truth):**
- S1 COACH-GREETING exists in the oracle (own MP3 beat between auth and mic) and in beatContexts, but has NO node in the generated flow — the first-hello line currently has no beat to play on.
- S2 Oracle places BEG-07 (evening reflection) after BEG-04 inside the beginner path; the flow places it pre-fork. Yair's flow-order ruling wins; recorded because the oracle's per-element reflection lines assume the post-fork position.

## Routing (per qa-taxonomy)

- M1, M2, M3 → my lane's C2 scope for wording/values (RULE 11 in `assistant.ts` is mine); the *mechanism* question — whether the engine should stop feeding screens-era blocks to Vapi on beats that have beat contexts — touches `OnboardingVoiceProvider` (anchor territory, overlap rule 3) and `getScreenContext` (shared). Filed as NEEDS-COORDINATION with anchor; not edited from this lane.
- M4 → Lane 1 / anchor ledger row (resume mechanics + builder step maps).
- M5, M7 → C2 (this lane).
- M6, M8, M9 → C3 (this lane).

## C4 live pass — text path, 2026-07-04

Build under test: **staging a4d90167** (post-!409 anti-improvisation, post-!417/!421, i.e. "current staging" per the conductor) served at gg-qa-iota.vercel.app — verified by bundle fingerprint (staging Supabase ref in the client constant; !421's tap-to-play marker in the `useFlowOrchestrator` chunk). Driver: `scripts/qa/context-matrix-driver.mjs` (21 turns, both fork paths), user `qa-onboarding-fable@guidedgrowth.test` (per-lane user still not created — login 400 re-confirmed today), self-reset before/between/after runs. Raw transcripts: `docs/fix-reports/c4-live-2026-07-04/` on app-repo branch `context-lane-status-2026-07-03` (mirrored from /tmp/c4/out).

Context-serving verified in code before judging: `buildSystemPrompt.ts:119` serves `GLOBAL_ONBOARDING_CONTEXT` + beat context for every `ONBOARD-*` screen on this path, so every fail below happened WITH the anti-improvisation layers in the prompt.

| Beat | Turns | Option-list narration | Gesture instr. | Internal narration | Tools per C3 | Verdict + evidence |
|---|---|---|---|---|---|---|
| ONBOARD-01--FORM | b00, a00 | n/a | none | says "step" out loud (b00: "Let's move on to the next step") | submit_profile + advance_step ✓ | PARTIAL — F-C4L-5 (beginner-00, advanced-00) |
| ONBOARD-STATE-CHECK | b01, a01 | n/a | none | none | b01 ✓ self-advance respected; a01 ALSO fired advance_step (forbidden by addendum §SELF-ADVANCING; ok:true) | PARTIAL — F-C4L-6 = M6 risk live (advanced-01) |
| ONBOARD-MORNING-SETUP | b02, a02 | n/a | none | generic praise a02 ("You're doing great") | submit only ✓ | PASS w/ style note — F-C4L-5 |
| ONBOARD-BEGINNER-07 | b03, a03 | none (styles not recited) | none | none | submit_reflection_config only ✓ | PASS (beginner-03, advanced-03). Opener-clarity finding VID-advmint-003 is a wording item (W-class, NEEDS-YAIR), not contradicted by this pass |
| ONBOARD-FORK--FORM | b04, a04 | none | none | none; "simple"/"braindump" never spoken ✓ | b04 advance_step(3) per ladder ✓; a04 advance_step(4) — OFF-LADDER (no advanced ladder exists), succeeded | PARTIAL — evidence for F-C4L-2 (advanced-04) |
| ONBOARD-BEGINNER-01 | b05 probe, b06 | **FAIL — probe "What are my options?" → coach recites all 8 categories** | none | none | b06 ✓ | **FAIL — F-C4L-1** (beginner-05-PROBE); b06 also breaches DO-NOT "say nothing after the pick" ("Great, we're focusing on improving sleep…") |
| ONBOARD-BEGINNER-02 | b07 probe, b08 | **FAIL — probe → full 4-bullet goal list** | none | none | b08 ✓ | **FAIL — F-C4L-1** (beginner-07-PROBE) |
| ONBOARD-BEGINNER-03 | b09 probe, b10 | **FAIL — probe "Read them to me" → full 4-bullet habit list** | none | none | b10 add_habit(name) then asks days/times = next beat's work, per addendum SPECIAL CASE | **FAIL — F-C4L-1 + F-C4L-4** (beginner-09-PROBE, beginner-10) |
| ONBOARD-BEGINNER-04 | b11 | n/a | none | none | add_habit(full) + advance_step ✓ | PASS (beginner-11) |
| ONBOARD-COMPLETE (beginner) | b12 | n/a | none | none | confirm_plan ✓ | PASS (beginner-12) |
| ONBOARD-ADVANCED | a05 | n/a | none | **FAIL — re-plans the flow out loud ("It seems like we need to set up your habits individually")** after advance_step(5) rejection; also skips the beat-spec build/break read-back + single yes | submit_brain_dump ✓; advance_step(5) **ok:false** | **FAIL — F-C4L-2** (advanced-05) |
| ONBOARD-ADVANCED-FREQUENCY | a06 | n/a | none | narrates the habit cap ("we've hit the maximum number of habits") — instructed by addendum ERROR RECOVERY, so the words are per-spec; the cap itself is the bug | add_habit ×3 (beat context says habits are "already captured" → update; server-side they are NOT captured, B26 class); 3rd add REJECTED max_habits_reached | **FAIL — F-C4L-3** (advanced-06) |
| ONBOARD-COMPLETE (advanced) | a07 | n/a | none | none | confirm_plan ✓ — but plan confirmed WITHOUT the user's third habit (F-C4L-3 impact) | PARTIAL (advanced-07) |

Not exercisable on the text path (unchanged from static pass): auth, mic, why-intro, weekly-projection ×5 (silent/MP3 beats — no LLM turn), card-render column (needs browser/human walk), COACH-GREETING (no flow node, S1).

### C4 live fails — filed per qa-taxonomy

- **F-C4L-1 — Coach recites option lists on a direct ask (BEG-01/02/03, 3/3 probes).** Type: **AI Learning / behavior** (rules are served — verified in code — and the model disobeys under "what are my options?" / "read them to me"; softer unsure-phrasing was NOT probed separately this run). Fix territory: mine (C2) — strengthen SILENT_OPTIONS + Component Sync for the direct-ask case (e.g. "even when asked to read the options, don't recite; the screen has them — ask one narrowing question"). **NEEDS-YAIR first**: is refusing a direct "read them to me" the intended UX (accessibility/voice-first users)? The locked rule as written says never recite, so these are fails as-scored.
- **F-C4L-2 — No advanced-lane step ladder in the addendum → advance rejected → coach re-plans the flow out loud.** Type: **Bug** (prompt-pipeline code, `systemPromptAddendum.ts:13` ladder is beginner-only; model guesses beginner step ids on advanced beats, `advance_step(5)` fails the beginner-shaped data precondition, ERROR-RECOVERY then walks it into a habit-by-habit script that contradicts the ADVANCED beat spec). Same class as the fixed B12 (stale ladder), resurfacing on the lane the rewrite never covered. Coordinate with builder's parked !411 (derived step maps) — central ledger row **B32**.
- **F-C4L-3 — MAX_HABITS=2 rejects the advanced user's third habit; it is silently absent from the confirmed plan.** Type: **Bug** (backend value: `api/_lib/llm/onboarding/schemas.ts:44`, enforced `handlers/addHabit.ts:82`). The beginner "less is more" cap applied to the lane whose premise is "bring all your existing habits". Compounding: `submit_brain_dump` persists raw text only (no server-side habit rows — B26 class), so add_habit on ADVANCED-FREQUENCY is currently the ONLY persist path and the cap bites at 3. **NEEDS-YAIR**: intended advanced cap. Central ledger row **B33**.
- **F-C4L-4 — Addendum SPECIAL CASE collects schedule on BEGINNER-03; the flow has a separate BEGINNER-04 schedule beat.** Type: **Bug** (codified contradiction between `systemPromptAddendum.ts:19` and the generated flow; the coach obeys the addendum and does the next beat's work). Extends M4's collision cluster. Central ledger row **B34**.
- **F-C4L-5 — Style-rule breaches: "step" spoken out loud; generic praise ("You're doing great", "Great, …").** Type: **AI Learning / behavior**, low severity. Mine (C2 wording strengthening), batched with F-C4L-1.
- **F-C4L-6 — advance_step fired on a self-advancing beat (STATE-CHECK, advanced run).** M6's risk observed live (ok:true, potential double-advance race client-side). C3 action: remove advance_step from the self-advancing beats' effective allowedTools or document the fallback justification.
