# Cost-safety audit: does the QA fleet hit live metered Cartesia?

Date: 2026-07-09. Read-only audit, no code changed.

## Bottom line

**NO — the swarm is not Cartesia-safe right now.** The "QA TTS stub" that is supposed to make
fleet walks free is an unmerged draft MR sitting on a badly stale branch. It is not in `main`,
not in the `gg-qa-iota` deployed build, and not wired into any fleet-runner script. A swarm
walking the coach/check-in chat path today will hit live, metered Cartesia on every
conversational turn — exactly the pattern that drove Model Credits to -144,358 on 2026-07-09.

## 1. MR !519 status (GitLab, confirmed live via API)

- `guidedgrowth-group/guided-growth-mvp!519`, title "Draft: Add VITE_QA_STUB_TTS cost guard to
  stub live Cartesia for fleet QA".
- **state: opened, draft: true, merged_at: null.** Not merged. Zero review notes/discussion.
- Source branch `feat/qa-stub-tts`, last commit 2026-07-09 00:52:09 +0300 (sha `5fccba6a`).
- **Branch divergence check:** `git log --oneline main..origin/feat/qa-stub-tts` = 835 commits,
  `origin/feat/qa-stub-tts..main` = 0. The branch was cut from a point far behind current `main`
  (the diff vs main touches hundreds of unrelated files — CI workflows, Android build files,
  Storybook config, etc. — none of which are the actual feature). This branch cannot be merged
  as-is; it needs a full rebase onto current `main` first.
- The STATUS.md ledger (gg-status conductor log) at one point narrates this as "TTS stub =
  draft !519" (accurate) but a later ledger line and the cost note both say "MR !519 ... merged
  2026-07-09" — that claim is **wrong**, contradicted by GitLab's live state. Treat the ledger's
  "merged" language as stale/premature.

## 2. What the stub, if merged, would actually do

Read directly off the draft branch (`git show origin/feat/qa-stub-tts:...`):

- New file `src/lib/services/qaStubTts.ts`: `isQaStubTtsEnabled()` reads
  `import.meta.env.VITE_QA_STUB_TTS === 'true'` (a Vite **build-time** env var, not a runtime
  toggle — it gets baked into the JS bundle at `vite build` time, so it only takes effect if the
  deployed build was compiled with that env var set).
- Two call sites patched:
  - `src/lib/services/tts-service.ts` (`synthChunk()` → `POST /api/cartesia-tts`): the
    onboarding-chunked-speech fallback + a few one-shot UI voice prompts. When stubbed, fetches a
    local `public/voice/qa-stub.mp3`.
  - `src/lib/services/cartesiaVoice.ts` (`synthChunk()` → `POST /api/cartesia-tts-sse`): **this
    is the live direct-LLM coach chat-reply path** (`useCoachChat.ts` →
    `beginVoiceTurn/pushVoiceChunk/endVoiceTurn`), fired on every conversational turn — the actual
    -144k-credit driver. When stubbed, returns a locally-built silent PCM chunk, zero network call.
- Default is `false` (real behavior unchanged); intent is ON for 7/8 fleet walks per round, OFF
  for exactly 1 canary walk that must still prove real Cartesia works.
- `public/voice/qa-stub.mp3` **does not exist on `main`** (only referenced in the draft branch;
  did not check whether the file itself was actually committed to the draft branch either — the
  file existence check was run against `main` where the whole feature is absent).

## 3. Voice-path map (confirmed in code, `main`)

- **Onboarding**: pre-recorded MP3 clips (`public/voice/ob/*.wav`), per prior team convention —
  a swarm walking pure onboarding beats is already close to free regardless of the stub.
- **Coach / check-in / free-form chat (`useCoachChat.ts`)**: live pipeline, Soniox STT → LLM →
  Cartesia TTS via `cartesiaVoice.ts` → `/api/cartesia-tts-sse`. This is the exposed path. Nothing
  on `main` gates or disables it under any QA/iota-specific env flag — no `VITE_QA_STUB_TTS`,
  no `QA_MODE`, no iota-specific branch in `cartesiaVoice.ts` or `tts-service.ts` today
  (`git grep VITE_QA_STUB_TTS main` returns nothing).
- `src/config/voiceConfig.ts` just holds the two Cartesia voice IDs (Ronald/Katie); no QA-mode
  awareness there either.

## 4. Fleet-runner wiring (gg-spec/tools/convo-harness)

Checked `run-fleet.mjs`, `run-round.mjs`, `walk-agent.mjs`, and
`docs/qa-fleet-conductor-channel.md` for any reference to `VITE_QA_STUB_TTS` / `STUB_TTS` /
"stub" — **zero matches**. Even in a hypothetical world where !519 were merged and iota were
rebuilt with the flag on, nothing in the actual fleet launch scripts sets or exports the env var
for the 7 non-canary walks. The wiring described in the MR ("export the env var only in the
fleet's walk-launch script") does not exist yet.

The runbook itself (`gg-spec/docs/qa-round-loop-runbook.md`, "Cost guard: stub live Cartesia TTS
for fleet runs" section, added 2026-07-09) still frames this as a **to-do**, not a shipped
control: "Add a QA-mode flag... Prerequisite before round 4. Small build task." That framing is
the honest, current state — the ledger's later "merged" language overstated it.

## Gap summary (in the order they'd need fixing)

1. **Not merged / stale branch**: `feat/qa-stub-tts` is 835 commits behind `main`, diff is mostly
   unrelated file noise. Needs a fresh rebase (or a clean re-implementation against current
   `main`) before it can land as a real MR.
2. **No fleet wiring**: even once merged, `run-fleet.mjs` / `run-round.mjs` need to actually set
   `VITE_QA_STUB_TTS=true` for 7-of-8 walks per round and leave exactly one canary unset.
3. **Build-time env, not runtime**: `VITE_QA_STUB_TTS` is inlined at `vite build`. The Vercel
   project that builds `gg-qa-iota` (project `prj_4bEo8`, per STATUS.md) needs this var set for
   whichever deploy the fleet targets — a per-request/runtime toggle will not work with Vite's
   `import.meta.env` substitution. This likely means either (a) a dedicated QA-stub build/branch
   with the var baked in, or (b) confirming Vercel preview-env injection actually reaches
   `import.meta.env` at that project's build step (unverified either way in this audit).
4. **Canned asset missing on main**: `public/voice/qa-stub.mp3` isn't present outside the draft
   branch (only matters for the `tts-service.ts` fallback path, not the silent-PCM coach-chat
   stub, but should ship together).

## Fix, in order

1. Rebase `feat/qa-stub-tts` onto current `main` (or re-cut the same small diff fresh), fix the
   MR to only contain the 6 real feature files, get it reviewed off draft, merge to `main`.
2. Wire `run-fleet.mjs`/`run-round.mjs` to export `VITE_QA_STUB_TTS=true` for all but one walk
   per round, per the runbook's own stated policy.
3. Confirm (build a test deploy or check Vercel project settings) that the fleet's target
   deployment actually gets built with the flag on — this is a build-time Vite substitution, so
   verify it isn't silently a no-op against a cached/prebuilt iota bundle.
4. Ship `public/voice/qa-stub.mp3` alongside.
5. Only after all four land: re-run one swarm round and check Cartesia Model Credits stay flat
   except for the single canary walk's spend.

Until step 1-3 land, any swarm agent that reaches the coach/check-in chat surface (not just
onboarding) generates real, metered Cartesia usage.
