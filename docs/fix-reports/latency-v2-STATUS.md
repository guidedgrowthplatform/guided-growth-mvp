# Latency lane v2 STATUS

Lane docs: gg-spec docs/latency-diagnosis-2026-07.md (phase 1 deliverable),
docs/latency-baseline-2026-07.md (5-run baseline, merged). No em dashes here by rule.

## 2026-07-06, end of day

PHASE 1: items 1, 2, 6, 7 DONE. Items 3, 4, 5 blocked on machine access, see below.

- P1.1 client-gap decomposition: DONE, measured. Cold start 2.5-3.1s (majority of the
  3.9s gap) + handler pre-work before the server timer (documented ~2.8s cold pg pooler)
  - chat bootstrap round trips. Evidence: diagnosis doc + .frugal-fable/p1-client-gap/.
- P1.2 cold-start profile: DONE. Warm instance survives 1 min, dead by 10 min.
  LLM 2934-3613ms cold vs 368-671ms warm; Cartesia 1046-1368ms cold vs ~400ms warm.
- P1.6 regression runner: DONE. gg-spec tools/latency/pull-spans.mjs + README.
  Nightly schedule id 1 ACTIVE (03:00 UTC) but currently targeting the
  latency-v2-phase1-2026-07 branch because gg-spec main is push-protected for this
  account (see blockers). Retarget to main after the branches merge.
- P1.7 diagnosis doc: DONE v1 with ranked fixes, pending sections marked.

PHASE 2 (gate OPEN per conductor 2026-07-06, consolidation seed in e5453bc1):

- Fix 1 WARMER: SHIPPED as draft MR !459 (branch latency-fix1-warmer-2026-07-06).
  GET /api/llm/warmup (no auth, SELECT 1, { warm, db_ms }) + GET warmup on
  /api/cartesia-tts + app-open fire-and-forget client warmer + span
  warmup_roundtrip_ms for before/after proof. Tests 5/5, tsc parity 14=14.
  QA re-measurement to be posted on the MR before merge.
- Next in ranked order: server_prework_ms span, bootstrap collapse, history trim
  (trim policy awaits the P1.3 curve).

OTHER LANE DELIVERABLES AWAITING MERGE:

- M1 semantic turn-end wiring: draft MR !457 (dark flags, approved rollout:
  SONIOX_V5 first on QA, then SEMANTIC_TURN_END).
- gg-spec branches pushed, NOT mergeable by this account (protected main):
  latency-m2-stt-routing-reco-2026-07 and latency-v2-phase1-2026-07.

## Blockers for the conductor

1. BROWSER ACCESS: this machine's browser automation cannot reach
   gg-qa-iota.vercel.app (extension domain grant pending on the operator). This
   blocks P1.3 (history curve 5/15/30 turns), P1.4 (Soniox time-to-first-partial)
   AND P1.5: the Vapi session-start benchmark turns out to REQUIRE the engine
   build. Verified empirically today on the old !415 preview: with the Vapi QA
   toggle ON and a fresh onboarding, the flow still runs the DIRECT Soniox path
   (stt_connect_ms + cartesia fired, no Vapi call). Per ruling 6, the QA harness
   machine can run all three; the exact methods are written in the diagnosis doc
   sections 3-5. Alternatively the operator grants the domain and the lane runs
   them from here.
2. GG-SPEC MAIN PROTECTED: direct-push rejected by the pre-receive hook for this
   account despite the direct-push ruling. Merge the two lane branches from your
   side or raise the account role, then retarget nightly schedule id 1 to main.
3. VAPI SPEND: unblocked by ruling, but 0 of 6 sessions used today because of
   blocker 1. The one live session accidentally started was a DIRECT-path session
   (no Vapi credits) and was killed within seconds of detection.

## Standing facts

- QA build alias: gg-qa-iota.vercel.app, repointed by every main pipeline.
- Baseline: opener llm_ttft ~7.1s client / ~3.2s server; chat server tail 7.8s;
  mp3 pool healthy (not a target).
- Bonus samples today (direct path, old preview): stt_connect_ms totals 1849ms
  and 2168ms clean legs (mic 262/982, ws 762/878), one ambient-noise LLM turn
  observed when the mic went live, which is exactly the class of accident the
  kill-on-confirm rule exists for.
