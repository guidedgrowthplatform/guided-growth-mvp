# Onboarding Voice Engine: Metadata Export Analysis + Work Plan

Date: 2026-07-01
Branch (foundation): `feat/onboarding-metadata-engine` (off `feat/soniox-profile-fill`)
Source of truth for the flow: the flow builder Export (pasted 2026-07-01), 25 beats.
Pairs with: Mint's `onboarding-no-vapi-plan.md`, `scratch/orchestration-2026-07-01/orchestration-plan.md`, `HANDOFF-builder-app-export-contract.md`.

---

## 0. The goal beyond onboarding (drives the whole approach)

The aim is not just to ship onboarding. It is to get the SYSTEM running correctly and flow-agnostic, so that once it works, the next flow (morning check-in) is authored in the builder, exported, and runs with no new engineering. Onboarding is flow #1. Morning is flow #2, an export, not a rebuild.

What this means for the build:
- The foundation must run ANY exported flow, keyed by a flow id, not hardcoded to onboarding. The loader, transform, and engine all read the export's metadata; adding a flow is dropping in a new export.
- So wire onboarding through the generic mechanism (export -> source file -> flow:sync -> engine reads meta), never an onboarding-specific shortcut. The same pipe carries the morning flow next.
- Order below is unchanged (foundation, then A + B, then reconcile). The foundation's done-condition gains one line: a second flow (morning) could be dropped in as an export with zero engine changes.

---

## 1. What the new metadata says

The export is the whole onboarding as data. 24 beats (beat 0 QA through 13e). The engine picks per beat from the metadata: MP3 carries the fixed lines, Cartesia does the name, and Vapi runs wherever a beat calls for it. Soniox is always listening, and the brain that fills every interactive card is the Direct-LLM coach. In the current onboarding metadata, the lines are MP3-dominant with one Cartesia beat; no beat is set to Vapi yet, but Vapi stays a per-beat option (flip `voiceEngine` in the metadata).

Engine per beat:

| Beat | Screen | voiceEngine | Fills the card | Notes |
|---|---|---|---|---|
| 0-3 | qa, splash, get-started, splash-intro | none | none | pre-coach, no meta |
| 4 | auth-signup | None | none | tap Apple/Google/email; directLlmAllowed false |
| 5 | mic-permission | MP3 | none | verbatim coach line, tap Allow |
| 6 | profile | **Cartesia** | direct-llm | the ONE live-TTS beat; `{name}` greeting, verbatim, captures age+gender |
| 7 | why-intro | MP3 | none | say-only, auto-advance |
| 8a | state-check | MP3 | direct-llm | perElement sleep/mood/energy/stress |
| 8b | morning-setup | MP3 | direct-llm | openerMode A, perElement schedule/when/how-often/reminder |
| 9 | reflection-setup | MP3 | direct-llm | openerMode B, 6 perElement |
| 10 | path-fork | MP3 | direct-llm | routes new vs experienced |
| 11a | category | MP3 | direct-llm | maxSelections 1 |
| 11b | goals | MP3 | direct-llm | maxSelections 2 |
| 11c | habit-picker | MP3 | direct-llm | maxSelections 2, custom allowed |
| 11d | habit-schedule | MP3 | direct-llm | openerMode A, perElement schedule/when/how-often/reminder |
| 11e | advanced-capture (exp) | MP3 | direct-llm | brain dump |
| 11f | advanced-frequency (exp) | MP3 | direct-llm | day circles |
| 12 | into-app (complete) | MP3 | direct-llm | plan confirm |
| 13a-13e | weekly-projection x5 | MP3 | none | say-only, tap Next |

What is now IN the metadata (rich, and new):
- `spokenContent`: the exact words for every MP3 beat. So the clips can be rendered from the metadata, verbatim.
- `perElement`: per-card sub-lines with `order` and `showsAsBubble` (sleep/mood/energy/stress, schedule/when/reminder, the 6 reflection elements). This is the AV-sync data: each element has its own line, so an element can fade in as its line plays.
- `allowedTools` per beat (submit_profile, record_checkin, submit_path_choice, submit_category, submit_goals, add_habit, submit_brain_dump, confirm_plan, ...).
- `engine`: persistStep, captureFields, pathField, maxSelections, optionSource, voiceExpectsInput, voiceDirectLlmAllowed, backId.
- `openerShowsAsBubble`, `expectedResponse`, `openerMode` (A/B, semantics to confirm with the builder), `variable` (the `{name}` beat).

What is NOT in the export (the gap):
- `mp3Assets` is empty on every beat. The words are here; the audio files are not. So the clips still need to exist and be referenced (see 3 + workstream A).

---

## 2. Foundation first: wire the export in (the connector step everything rides on)

Nothing below matters until the app actually runs this export. Three pieces, in order:

2.1 Land the export as the app's designer source. Save it as the JSON the transform reads and point `flow:sync` at it, dropping the hand-typed `designerSource.ts` mirror. Then the app takes the flow from the builder and nowhere else.

2.2 Fix `resolveMeta` so `fill.brain` comes from the authored metadata, not the scatter. Today (`transform/designerToFlow.ts:~608`): `fillBrain = isVapiBeat || voiceOutEngine === 'vapi' ? 'vapi' : 'direct-llm'`, where `isVapiBeat` is `CHAT_VAPI_BEAT_SCREENS.has(screenId)`. With the real export, that would still tag category/goals/habits/path as Vapi even though the metadata says MP3. Change: when authored `voiceEngine` is present, derive `fill.brain` from it plus `engine.voiceDirectLlmAllowed` / `voiceExpectsInput` / `allowedTools`:
- voiceEngine None and not directLlmAllowed -> `none` (auth, mic: taps)
- voiceEngine MP3/Cartesia with allowedTools or voiceExpectsInput -> `direct-llm`
- voiceEngine MP3 say-only (no tools, auto-advance: why-intro, projections) -> `none`
- voiceEngine Vapi -> `vapi` (none in this export)
The scatter stays only as the fallback for a beat with no authored meta.

2.3 Reconcile the beat set. The export is 25 beats; the current generated flow is 20. Feeding the export changes the graph (new beats: morning-setup, the 5 weekly-projections, advanced-frequency; reordered tail). So `resumeToServerStep`, `stepModelParity.test`, and the two order models must reconcile to THIS export as the canonical order. The export carries `engine.persistStep` per beat, which is the anchor for resume.

Done-condition: the app renders the 24-beat flow, each beat's engine read from its meta, spot-checked on profile (Cartesia), one MP3 interactive beat (direct-llm fill), and a say-only projection (none); tsc + tests green.

---

## 3. Opinion on the sound thing

The new metadata makes the sound problem easier, not harder, because every line is now fixed text.

1. Pre-render the MP3s from `spokenContent`. Every MP3 beat has its exact words in the metadata. Render them once (Cartesia, Yair voice) into clips and reference them in `mp3Assets`. Only the profile/name beat stays live Cartesia (it has `{name}`). Fixed clips mean known, stable durations.
2. The cutoffs are a timing problem, not an STT problem. Soniox works (proven at 6am). The first-word clip is the 2.5s grace vs 1.5s prebuffer mismatch; the "not listening on load" is the mic not being armed yet. Fix both by arming the mic early (at mic-permission grant, keep the stream warm across beats) and by making prebuffer >= grace, or dropping grace on MP3 beats.
3. Key the "start listening" moment off the MP3's end. Because the clips are pre-rendered with known duration, the app knows exactly when the coach stops talking, so it can open the mic at that instant instead of guessing. That removes the race that eats the first word.
4. Autoplay: keep `unlockTTS()` on mic grant so the first clip plays without a gesture wall.

Net: fixed lines -> pre-rendered clips -> known durations -> precise mic arming. The metadata is what unlocks that.

---

## 4. The two developer workstreams (parallel, non-conflicting)

Split by area, ordered within each, with a shared contract so they never touch the same logic.

### Workstream A: voice + audio pipeline (the sound thing)
Owns everything from "coach speaks" to "we have the user's words." Voice-in Soniox + voice-out MP3/Cartesia.

- A1. Render the MP3 clips from each beat's `spokenContent` (Cartesia, Yair voice), store them (public/voice or Supabase storage), and put the file refs into the beat metadata `mp3Assets`. This closes the export's MP3-file gap.
- A2. Arm the mic early: grant + warm the Soniox stream at mic-permission, keep it alive across beats (Bug B). iOS caveat: NSMicrophoneUsageDescription.
- A3. Kill the first-word cutoff: prebuffer >= grace, or skip grace on MP3 beats (Bug A).
- A4. MP3 playback + autoplay unlock: `unlockTTS()` on mic grant; every MP3 opener plays and the karaoke caption tracks the audio.
- A5. Open the mic at the MP3's end: use the clip's known duration as the arm signal (from 3.3).
- A6. Profile/name beat: live Cartesia render with `{name}` substitution, verbatim.
Files: `OnboardingVoiceProvider` (audio lifecycle), `useBeatOpenerMp3`, `renderer/BeatView` (caption), the Soniox stream + mic-source code, the Cartesia TTS path.
Done-condition: on a fresh onboarding, every MP3 line plays, the name beat speaks the name, and Soniox catches the user's first word on each interactive beat with no clip.

### Workstream B: coach + LLM fill + tools + context
Owns everything from "we have the user's words" to "the card is filled and saved." The Direct-LLM brain.

- B1. Direct-LLM fills every interactive card from the Soniox transcript (the `/api/llm` path). Each beat's `allowedTools` must be wired so the coach fires the right tool and the card fills (submit_profile, record_checkin, submit_category, submit_goals, add_habit, submit_path_choice, submit_brain_dump, confirm_plan, ...).
- B2. Re-verify the realtime fill on the Direct-LLM route: tool webhook -> onboarding_states write -> postgres_changes -> frontend auto-fill. Mint's plan flags this as the thing most affected by Vapi off, so confirm it end to end without Vapi.
- B3. Feed beat context from the export into the coach's per-beat system prompt: the `context` paragraphs (the BEAT: ... path guidance) plus `spokenContent`. The coach should get exactly the beat's authored context.
- B4. Per-element asks: the `perElement` lines drive the coach through a card's sub-questions in order (sleep -> mood -> energy -> stress, etc), matching the AV-sync so an element's line plays as it reveals.
- B5. Delete the abandoned local parser (`parseProfileSpeech` + test). The coach fills, not a local parse.
Files: `/api/llm` + `buildSystemPromptForRequest`, the tool registry, the realtime fill path, beat-context bundling, `parseProfileSpeech.ts` (delete).
Done-condition: speaking (or typing) an answer on each interactive beat fills the card via the coach's tool call and persists, on the Direct-LLM route.

### The seam (why A and B do not collide)
A produces two things and hands them off: the transcript, and a "user finished this turn" signal. B consumes those and fills the card. Keep A out of `/api/llm` and the tool registry. Keep B out of the mic, MP3, and Cartesia timing. The one shared file is `OnboardingVoiceProvider`: A owns its audio lifecycle; B only reads the transcript at the hand-off point. Agree that boundary first and the two never overwrite each other.

---

## 5. Cross-cutting (after A and B each work)

- Beat-order + resume reconciliation to the export's canonical order (anchored on `engine.persistStep`); extend `stepModelParity.test`.
- package.json: take staging's `@dnd-kit/*` (do not re-drop; it crashes FlowBuilder).
- Consolidate to staging: upstream the additive files, hand-merge the QAControlScreen collision, announce the voice.ts + classification changes, verify analytics still fire on the Direct-LLM path.

---

## 6. Order of execution

1. Foundation (connector): wire the export in (section 2). Everything depends on it.
2. A and B in parallel (section 4), coordinating only on the seam contract.
3. Cross-cutting reconciliation (section 5).
4. Consolidate to staging.

The flow ships when foundation + A + B are green on a fresh onboarding walkthrough. Vapi turns on for any beat by setting `voiceEngine: Vapi` in that beat's metadata (plus the global toggle), riding on the same engine, no re-architecture. Same for any future flow.
