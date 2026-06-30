# Onboarding voice fixes — handoff (Yonas)

**Branch:** `fix/onboarding-voice-render-toolcalls` (off `staging`) · **Owner:** Yonas
Working the post-demo fix list. Beat order/content untouched (waiting on Yair's new flow + Flow Builder review). Commit/push ~every 1–2h; entries below newest-first.

---

## 2026-06-30 — #3 word-by-word first beat + #5 card-render diagnosis

**State:** type-check clean, full suite green (1304, exit 0).

### #3 — Cold opener rendered "filled" instead of word-by-word — FIXED

- **Root cause:** Cartesia returns **MP3** (`api/cartesia-tts.ts`: `container:'mp3'`, `audio/mpeg`). Chrome reports `HTMLAudioElement.duration === Infinity` for blob-sourced MP3, so `speakOpener`'s progress tick (`Number.isFinite(d)` guard) never fired mid-playback → `openerReveal.revealedWords` stayed 0 (bubble held by `coldOpenerPending`), then snapped to the full count at `handle.done` → the whole line appeared at once.
- **Fix:** `src/lib/voice/speakOpener.ts` — added an `estimatedDurationMs` fallback: when duration isn't finite, estimate progress from `audio.currentTime` (capped at 0.97 so it only completes on the real `onended`). `OnboardingVoiceProvider.tsx` passes `max(1200, words*310)` (~310ms/word). Real `currentTime/duration` still wins when the browser reports it. Now reveals word-by-word like the rest.
- **Can't unit-test (voice).** Needs a live mic-pass: first beat (profile) cold opener should grow word-by-word in sync with the Cartesia audio.

### #5 — Inconsistent category-card render — DIAGNOSED (engine-timing) + minimal fix

- **Verdict: engine TIMING, not prompt/context.** The interactive card was gated behind `openerPresent` (`BeatPlayer.tsx` `BeatConversation`): the card only rendered once the opener _message_ landed (cold append / warm Vapi STT) or a 12s fallback fired. So whether the card showed depended on opener/message timing vs the navigate→Realtime→advance cycle — if the coach was slow to speak the opener or the beat advanced first, the card was hidden. Nothing to do with the beat copy.
- **Fix:** `BeatPlayer.tsx` — on the **active** beat, render the card as soon as the beat is live (`active || openerPresent`); the opener still karaokes above it when it arrives. Past beats unchanged (still require the opener so the frozen receipt sits under it).
- **Note for the flow rework:** this rendering area will be touched by the new beat order; the fix is presentation-only and beat-agnostic.

### #4 — Duplicate tool calls / "data deleted" — DIAGNOSED + cheap rails

- **Not reproduced on the Vapi (demo) path.** Pulled live prod call logs (`/call?assistantId=…` with `VAPI_PRIVATE_KEY`): the two full onboarding runs fire **one tool call per action** (`submit_profile → nav → path → nav → category → nav → goals → nav → add_habit×2 → nav → update_habit×2 → nav`) — **~11 calls is the NORMAL count** (6 data tools + 5 `navigate_next`), not excess. Vapi dedups per `tool_call_id` (PK, migration 053).
- **No delete tool exists.** Zero delete/reset/clear tools exposed to the LLM (`tools.onboarding.ts`). The only data-wipe paths are `api/qa-reset.ts` / `api/qa/self-reset.ts`, gated to `qa-onboarding-*@guidedgrowth.test` emails and only firable from `/onboarding/qa`. So "data deleted" was a **QA reset press, an older build, or a replace-style re-fire**, not a coach-invoked delete.
- **All handlers merge at the top level** (replace only their own key, preserve the rest) and **reject empty** — `submit_profile`/`category`/`reflection`/`morning` use `data || {…}`; `add_habit` keys per habit id; `remove_habit` is idempotent; `submit_goals`/`submit_custom_prompts` replace only their own key. **No blanket `data` overwrite → no data-wipe is possible.**
- **Real latent gap (NOT the demo path):** the Direct-LLM (Path 3) tool path has **no server-side dedup ledger** like Vapi's (`/api/llm` only dedups when `persistChat && userTurnId`). Full hardening (a ledger + unconditional dedup) was deferred — bigger change.
- **`advanceStep` GREATEST was rejected:** it bare-sets `current_step` _by design_ (`advanceStep.ts:9`) so back-nav-then-forward re-fires `useAgentNavigation`; a GREATEST guard would break back-navigation. It's already guarded against the harmful case (`cannot_skip_steps` + `checkAdvanceData`).
- **Cheap rails shipped:** idempotent single-fire no-op on the two Direct-LLM replace handlers (`submitGoals.ts`, `submitCustomPrompts.ts`) — a re-fired call with the same value skips the redundant write + Realtime event (the unprotected path). Handlers were already safe against data loss; this trims churn.

### Mic beat — big dial stayed static instead of collapsing to the orb — FIXED

- **Symptom:** after clicking **Allow** on the mic-permission beat, the big mic dial used to disappear (the bottom orb took over); it now stays on screen, static.
- **Root cause:** the frozen-receipt feature (`4f99274` + "keep whole conversation on screen") added `'mic-permission'` to `FROZEN_CARD_TYPES` (`componentRegistry.tsx`), so the completed mic beat re-renders its big dial frozen on screen instead of collapsing. (No morph animation ever existed — the old effect was the dial collapsing away while the always-present bottom orb remained.)
- **Fix:** removed `'mic-permission'` from `FROZEN_CARD_TYPES`. The completed mic beat now collapses to its `summarizeBeat` line ("Microphone set.") and the orb is the focus again. Data beats still freeze as receipts; only the permission gate stops persisting its dial. (`auth` left frozen — only mic was flagged.)
- Needs a visual check on the preview (UI, can't unit-test).

### What's next / blocked

- Blocked: #2 beat-context modifiers (need Yair's proposal doc — not in repo), new beat order (Flow Builder review first).
- Optional follow-up (deferred, Yonas's call): full Path-3 idempotency ledger to match Vapi.
- Live mic-pass still owed for #3 (cold opener word-by-word) and #5 (category card renders on a fast navigate) — voice can't be unit-tested.
