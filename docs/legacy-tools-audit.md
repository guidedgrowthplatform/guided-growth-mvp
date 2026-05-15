# Legacy Tool Definitions Audit — P1-08

This audit predates the deletion of `scripts/cartesia-line-agent/`. It records
every LLM tool defined in the legacy Python prototype and maps each one to its
status under the post-Vapi-pivot architecture so future work has a paper trail
for what was carried forward, what was rolled into a generic surface, and what
deliberately wasn't ported yet.

## Context

- The Cartesia Line agent was a Python prototype deployed to Cartesia's hosted
  realtime-voice platform. It was never deployed from this repo's CI — its
  entry point was `cartesia deploy` from `scripts/cartesia-line-agent/`.
- The 2026-05-05 v2 plan ("Vapi pivot") rerouted onboarding voice through
  `@vapi-ai/web` running in the browser, with the assistant config + tool
  webhooks managed in Vapi cloud. The Python prototype became dead weight.
- P1-07 landed a TypeScript shared module at `api/_lib/llm/tools.ts` that both
  the Vapi webhook (P1-11) and the `callLLM` wrapper (P1-10) will route
  through. P1-08 deletes the Python prototype.
- This audit is the SETUP criterion for P1-08.

## The 8 legacy tools

| Legacy `tools.py` function  | Location     | P1-07 status                                                    |
| --------------------------- | ------------ | --------------------------------------------------------------- |
| `record_onboarding_profile` | tools.py:39  | Superseded by `update_profile(field, value)` — per-field writes |
| `get_user_context`          | tools.py:102 | ✅ Same name in P1-07 (`api/_lib/llm/tools.ts`)                 |
| `log_checkin`               | tools.py:185 | Out of scope — Stage 5 work (P2-29..P2-37)                      |
| `get_habits`                | tools.py:224 | Out of scope — can fold into expanded `get_user_context` later  |
| `log_goal`                  | tools.py:274 | Out of scope — overlaps with goals work in Stage 5              |
| `navigate_next`             | tools.py:310 | ✅ Same name in P1-07                                           |
| `update_onboarding_data`    | tools.py:353 | Superseded by `update_profile` per-field writes                 |
| `update_profile`            | tools.py:421 | ✅ Same name + widened to typed columns in P1-07                |

## Mapping detail

### Carried forward verbatim (3)

- `get_user_context(screen_id)` — returns the screen context block. P1-07
  reads from `screen_contexts` directly. Same semantic contract.
- `navigate_next(target_screen)` — server-side `session_log` row tagged
  `source: llm_tool`. The client picks up the tool-call event over the
  WebRTC data channel and performs the actual route change. The Python
  version did roughly the same.
- `update_profile(field, value)` — writes a single field. P1-07 widens the
  whitelist to `name | nickname | age_group | gender | referral_source` and
  enforces per-field length + regex checks. The `PATCH /api/onboarding/profile`
  endpoint was extended to match.

### Superseded by `update_profile`'s per-field surface (2)

- `record_onboarding_profile(nickname, age_group, gender, referral_source)` —
  one tool that wrote four fields in a single call. P1-07 trades the bulk
  signature for repeated per-field calls (each with its own validation and a
  smaller blast radius if the LLM hallucinates a value). The whitelist is
  identical.
- `update_onboarding_data(field, value)` — was already per-field. Same
  semantic surface as P1-07's `update_profile`; merged.

### Out of scope for Phase 1 (3)

- `log_checkin(date, sleep, mood, energy, stress)` — daily check-in capture.
  Belongs to Stage 5 (P2-29..P2-37). When that lands, it should ride P1-07's
  `dispatchToolCall` rather than re-introduce a parallel tool registry.
- `get_habits()` — returns active habits with today's completion status.
  Likely folded into a future expanded `get_user_context` payload (state
  delta already covers habit-add/complete events). No need for a standalone
  tool today.
- `log_goal(date, goal)` — daily goal/intention. Same disposition as
  `log_checkin`: Stage 5 territory.

## What is NOT touched by P1-08

These layers reference Cartesia but are still live during the Vapi pivot:

- `src/lib/services/cartesia-agent.ts` — frontend client wrapper still used by
  `useRealtimeVoice` and `useOnboardingAgent`. The Vapi path is being phased
  in alongside; both coexist.
- `api/cartesia-agent-token.ts` — token-minting endpoint for the same client.
- `scripts/cartesia-agent-smoke.mjs` + the `smoke:agent` npm script — protocol
  smoke test against the cloud-deployed agent. Slated for replacement by a
  Vapi smoke command but unrelated to P1-08.

## Verification

After deletion, the criterion grep:

```
grep -rnE "^async def |^def .*_tool|TOOL_DEFINITIONS|TOOL_HANDLERS|dispatchToolCall" \
  --include='*.py' --include='*.ts' \
  scripts/ api/ src/
```

should match only `api/_lib/llm/tools.ts`. (The earlier `export.*Tool` pattern
incidentally matched `Tooltip` component exports in `src/components/onboarding/` —
unrelated to LLM tools.)

There are no Python tests in this repo, so the "legacy tests still pass"
criterion is vacuously satisfied.
