# Fix report: anti-improvisation fallbacks + allowedTools codification (C2/C3, context lane)

Branch: `context-lane-c2-anti-improv` | Lane: context/AI-QA (Slot D) | Base: staging 5750a2fb
Evidence base: gg-spec `docs/qa/context-matrix-2026-07.md` (C1 audit, mismatches M1–M9).

## Why it broke (root cause recap)

The 6-27 proposal's anti-improvisation structure (SPEAK MODE, per-beat DO NOT, Component Sync) was applied via the Master Sheet and landed in `beatContexts.generated.json` (synced 6-29, v2 entries). Two gaps remained:

1. **The hand-authored fallbacks never got the same content** (matrix M7). `beatContexts.ts` documents that defaults are copied verbatim from the synced file so entries stay correct if the sync is ever absent/reverted — true for the v3 beats, broken for the 10 older beats and the global. A reverted or empty sync would silently drop every constraint layer.
2. **The Vapi lane never sees any of it** (matrix M1/M3). Vapi consumes the screens-era `screen_contexts.json` (whose BEGINNER-01/02 blocks still INSTRUCT option-list narration) and a dashboard prompt with no Component-Sync rule. RULE 10 even carries the failure premise: options "the user has NOT seen yet" get spoken one at a time — exactly what happens when cards fail to render.

## What changed (and which dropped layer each restores)

- `api/_lib/llm/onboarding/beatContexts.ts`
  - `DEFAULT_GLOBAL_ONBOARDING_CONTEXT` refreshed to the synced global verbatim → restores **Layer C** (Speak-mode taxonomy) and the **Component Sync rule** (proposal §6) in the fallback path.
  - 11 stale entries (ONBOARD-01--FORM, FORK, BEGINNER-01/02/03/04/06/07, ADVANCED, MORNING-SETUP, COMPLETE) refreshed to the synced v2 content → restores **Layer A** (per-beat DO NOT) and **Layer C** (SPEAK MODE) in the fallback path. **Layer B** (in-context option lists) is consciously superseded: options now come from `canonicalOptions.ts` injections + tool enums, marked reference-only by SILENT_OPTIONS.
  - Every `allowedTools` list now carries a one-line justification; `ONBOARD-COMPLETE` base list aligned to the flow overlay (`+update_habit`). advance_step retained on the three self-advancing beats as an explicit nav fallback (matrix M6, now documented in place).
  - **Effective prompts are unchanged**: the synced overlay already supplied all of this content at runtime. This MR makes the fallback equal to it.
- `scripts/vapi-sync/assistant.ts`
  - New **RULE 11 — Component sync** (proposal §6's "RULE 11"): on-screen options are never "not seen yet"; older ARRIVAL "list the options in one short sentence" instructions in screen contexts are explicitly overridden; render-failure means stay-neutral, never recite. GOOD/BAD example parallel to RULE 10. **Not yet live**: lands on the assistant only when `npm run vapi:sync` runs — run it POST-merge (syncing now would mutate the live assistant under the human walkthroughs).
- `api/_lib/__tests__/beat-context-parity.test.ts` (new, 12 tests)
  - Loud failure when a builder export names a nonexistent tool (the overlay's `isOnboardingToolName` filter silently dropped these — matrix M8).
  - Every LLM-active beat has a context and keeps a progression tool after the overlay (guards the un-advanceable-beat class from !396's open item).
  - Anti-improvisation invariants: Component-sync in the global, SPEAK MODE + DO NOT on option-bearing beats, SILENT_OPTIONS on BEGINNER-01/02/03, openers free of em dashes and gesture words.

## What this deliberately does NOT do (upstream so the next build can't regress)

- **Sheet edits** (product-owned, NEEDS-YAIR): align the synced openers for FORK + ONBOARD-01--FORM to the MP3/flow lines (matrix M5); rewrite the screens-era ARRIVAL lines in the Screens tab so the Vapi bundle stops instructing narration at the source (matrix M1). RULE 11 neutralizes the instruction until then.
- **Feed-mechanism decision** (anchor territory): whether `OnboardingVoiceProvider` should feed beat contexts instead of screens-era blocks to Vapi on beats that have them (matrix M2 — 11/20 flow screens missing from the bundle entirely). Filed as L-CTX-1 in the lane STATUS.

## Verification

- `npx tsc --noEmit` clean; `npx vitest run` 147 files / 1485 tests green (includes vapi reconcile tests).
- Runtime-equivalence argument: every changed default is byte-identical to the synced overlay value that already wins at import; the only behavioral file (`assistant.ts`) is inert until `vapi:sync`.
- Preview walk (BEGINNER-01→03, voice OFF, own test user) executes as part of C4's live matrix on this branch's preview deploy.
