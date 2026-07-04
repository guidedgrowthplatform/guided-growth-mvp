# Builder-to-engine lane (Slot B) — STATUS

Lane doc: gg-spec/docs/fable-lane-builder-engine-2026-07-03.md (parent: fable-window-plan-2026-07-03.md).
Base: origin/staging @ 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged).

**MERGE HOLD LIFTED** (observed 2026-07-03 ~22:00 EAT): Yair merged the whole chain
!408 !412 !413 !414 !416 !418 !410 !419 into staging 16:10-16:39 EAT. Remaining: !411 only
(L1-3 derive-maps), reconciled with the landed chain (planned generate-flow.ts conflict
resolved keeping both sides), un-parked and marked READY for review. The orb bug this lane
reported also landed as fix B27 (fix/orb-overlay-tap-clearance-b27).

**PRIORITY CHANGE (Yair, 2026-07-03 ~13:50)**: after L1-LOOP-1, jump to L1-LOOP-3
(L1-5/6/7) then L1-LOOP-4 (L1-8) BEFORE L1-LOOP-2 (L1-3/L1-4). Flows live first,
hardening after. L1-3 was already built when the change arrived; parked as draft !411.

| ID   | Item                                                                                                                                               | Status | MR  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --- |
| L1-1 | Validate at the boundaries (zod Export schema, throw on unknown type, post-transform checks)                                                       | open   |     |
| L1-2 | Typed registries (satisfies Record<FlowComponentType,...>, kill beatEngineMeta JSON re-import)                                                     | open   |     |
| L1-3 | Derive step maps from flow JSON (ENTRY_SERVER_STEP, STEP_TO_SCREEN_ID, SCREEN_TO_STEP, beatForStep, LLM addendum, preconditions)                   | open   |     |
| L1-4 | Canonical artifact (delete/demote designerSource.ts mirror + onboarding-beginner-v1.ts fallback)                                                   | open   |     |
| L1-5 | Multi-flow enablement (flow registry, conditional fork passes, new TYPE_TO_COMPONENT entries, per-flow persistence, generic /flow-preview/:flowId) | open   |     |
| L1-6 | Morning check-in from the builder                                                                                                                  | open   |     |
| L1-7 | Evening check-in from the builder                                                                                                                  | open   |     |
| L1-8 | App tour from the builder (stretch)                                                                                                                | open   |     |

RESOLVED BLOCKER: conductor granted exclusive use of qa-onboarding-fable@guidedgrowth.test
(2026-07-03 ~16:20); all walks done with it. REMAINING permission gate: account RESET
(mirror of qa-reset deletes) was denied by the session permission layer, so a
STANDALONE !408 onboarding re-walk is parked (chain build contains !408; artifacts
byte-identical, so coverage is substantive). QA_RESET_TOKEN is not in .env.local;
operator can reset via the token'd endpoint or grant the delete permission if a
standalone walk is wanted.

STAGING MOVED 15:38 EAT (R2 resume fix 3ee5bb27 landed during the hold, presumably anchor demo-blocking): all 10 lane branches staging-synced via cascade merges, zero conflicts, suites green at chain tip (1516) and !411 (1499). Lane merge-hold discipline unchanged: drafts only.

NEW BUG (proposed B24, NOT this lane's to fix - orb surface is anchor/Lane-2 territory):
the floating voice orb overlay (pointer-events-auto) COVERS the check-in card's Continue
CTA and swallows taps - flow wedges at the state check. Reproduced on STAGING (gg-qa-iota,
pre-existing, not a lane regression) AND at phone viewport 375x812 (button y=717 center
under the orb) - real users cannot finish a check-in by tap wherever the orb overlaps.
Evidence: elementFromPoint at CTA center returns the orb div; JS .click() bypass advances
fine. Found while browser-verifying L1-6 on preview gg-n0667ti91.

Lane fix shipped meanwhile: check-in Exports now author voiceEngine none (generated meta
had defaulted openers to Cartesia - 401 TTS calls on preview + audio-gated reveal;
render parity with the meta-less hand defs restored; cascaded through the chain).

Preview walks DONE without the QA test user (auth-free routes): morning + evening
check-ins and the 5-beat tour all VERIFIED end-to-end on preview (build gg-n0667ti91).
Still needing the test user (operator blocker stands): full ONBOARDING walk + persist=real saves.

ADD-ON (conductor, 2026-07-04): B28+B29 fixed in ONE draft MR !421 (anchor authorized the
voice surfaces). Tap-to-play affordance + 4s text fallback on autoplay holds (B28), reveal
un-pinned while audio plays without duration metadata (B29), gesture bless of the pooled
clips on Get-started/QA-tile taps. B4 hold/settle semantics preserved and pinned by the new
openerRevealPin unit matrix. Verified on the fix preview with autoplay BLOCKED: 5/5
scenarios pass; before-run on staging shows the b1 frozen hold (pill=false, rejected=2).
Conductor merges.

Updated: 2026-07-04 04:4x EAT — !421 (B28+B29) MERGED by the conductor after an independent verification pass on the fix preview; !411 re-synced with staging (absorbed the reflection-setup persistStep fix cleanly, suite green) and remains the ONLY open lane item, awaiting review
