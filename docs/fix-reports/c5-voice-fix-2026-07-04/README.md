# C5 fix — repeated identical voice turns reached zero /api/llm dispatches

Repro package: `docs/fix-reports/c5-voice-2026-07-04/` on branch
`context-lane-status-2026-07-03`. Five consecutive identical voice turns
produced ZERO `/api/llm` dispatches with no errors; alternating texts
dispatched 7/7. Users repeating themselves in voice mode got silence.

## Root cause — two silent-drop mechanisms in the send path

**1. `useOnboardingChat.sendUserTurn`: unreachable queue branch (primary).**
The hook passed `llm.isStreaming` into `routeOrbSend`, which returns `'noop'`
for any turn arriving mid-stream — so the turn returned silently _before_
reaching the queue-and-cancel branch written for exactly that case (dead
code). Any turn landing while a reply or opener stream was in flight (or
stalled — see the B11 wedge family) vanished with no error. Users repeat
themselves precisely when the coach seems busy or silent, so repeats died
systematically while "polite" alternating-cadence turns landed in idle gaps
and dispatched.

Proof: `src/hooks/__tests__/useOnboardingChat.repeatTurns.test.tsx` —
"a repeat landing while the reply is still streaming is queued, not dropped"
**fails on unpatched staging** (1 dispatch instead of 2) and passes with the
fix.

**2. Utterance-aggregation flush starvation (secondary, both voice surfaces).**
`OnboardingVoiceProvider` and `useCoachChat` re-arm the adaptive end-of-turn
pause (900/2000/2800 ms) on _every_ interim/final with no ceiling. A repeat
cadence faster than the pause window re-arms forever: the buffer grows, the
flush never fires, nothing dispatches. Fixed with `TURN_HOLD_MAX_MS` (6 s)
via `clampFlushDelayMs` — buffered speech flushes at the cap even if the user
is still talking; the remainder becomes the next turn. Livelock proof:
`src/lib/voice/turnDecision.test.ts` ("repeat-cadence livelock breaks").

**Untouched (deliberate):** the `detectAffirmation` revisit shortcut
(sanctioned non-dispatch with an explicit response), multi-final merge into
one turn, and the Vapi transcript 1.5 s bubble dedup (display-only).

## After — fake-mic verification on the fix preview

Preview `https://gg-c2dw54ul7-guided-growths-projects.vercel.app` (branch
`fix/identical-turn-drop`, commit f50343c8, deployed to gg-qa). Harness:
`verify-harness.mjs` (adapted from the repro package's `session-harness.mjs`)
— QA login as `qa-onboarding-fable@guidedgrowth.test` via `/onboarding/qa`,
then `/onboarding-flow-preview?startAt=category` with a fake-mic WAV of the
SAME utterance 5× ("I want to exercise more often", 1.3 s gaps, Chrome loops
the file).

Result (`llm-requests.jsonl`, `timeline.log`): every identical repeat
dispatched — 5–6 `POST /api/llm` per 26 s WAV pass, 25 turn dispatches over
the session, first five at 33.6 / 36.7 / 39.8 / 43.1 / 46.2 s. One turn
landed as a legitimate two-rep merge ("…often. …often."), i.e. the
double-fire aggregation still works. Assistant replies stream but are
barge-in-cancelled by the next loop pass — expected full-duplex behavior
against a WAV that never stops talking; a real user who pauses gets the
reply.

Voice budget: 2 live sessions (S1 burned discovering the preview needs a QA
login for `/api/soniox-temp-key`; S2 above is the verification). Both killed
after their check.
