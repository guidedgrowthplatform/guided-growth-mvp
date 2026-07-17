# Phase B Audio-Manifest Builder Report

## Delivered

- Added the beat-keyed generator at `scripts/onboarding/generate-audio-manifest.ts`.
- Generated `src/generated/onboarding_audio_manifest.json` and its exact-contract provenance sidecar `src/generated/onboarding_audio_manifest.meta.json`.
- The generator reads the Phase A-shaped fixture at `src/onboarding-flow/flows/onboarding-contract.v1.json`, produces canonical clip paths, carries legacy paths, preserves locked text and voice resolution, stamps each canonical beat with its applicable rename tombstone `contractSeq`, detects shared-clip incompatibilities, and can verify canonical assets with `--verify-assets`.
- Added a recursive no-orphan checker at `scripts/onboarding/check-audio-orphans.ts`:
  - report mode: `npm run onboarding:audio-orphans`
  - required/CI mode: `npm run onboarding:audio-orphans:required`
- Updated `docs/migrations/audio-words-check-repoint.md` so `audio_words_check.py` reads locked text and canonical paths from the new manifest.
- Generated the existing required shared beat-ID module at `packages/shared/src/onboarding/beatIds.ts`, which unblocks the repository TypeScript gate.

## Contract Sequence Stamp

The committed Phase A fixture/schema has no root-level `contractSeq`. Its only `contractSeq` values occur inside historical `renames` tombstones. Each `beats[beatId].contractSeq` is therefore the highest tombstone sequence resolving to that canonical beat, or `null` where no tombstone applies. Exact contract identity remains in the sidecar as `contractRevision` and `contractSha256`.

## Gates

- `npm ci`: dependency installation ran, but its postinstall initially failed because the pre-existing generated `packages/shared/src/onboarding/beatIds.ts` was absent. Running the repository's existing beat-ID generator restored that required artifact.
- `npx tsc --noEmit`: pass.
- `npx vitest run src/lib/onboarding/__tests__/generateAudioManifest.test.ts src/onboarding-flow/__tests__/generateAudioManifest.test.ts`: pass (7 tests).
- `npx tsx scripts/onboarding/generate-audio-manifest.ts --check`: pass.
- `npx tsx scripts/onboarding/check-audio-orphans.ts --report`: completed, 55 orphans reported.
- `npx tsx scripts/onboarding/check-audio-orphans.ts`: correctly exits non-zero with the same 55 orphan files.
- `npx tsx scripts/onboarding/generate-audio-manifest.ts --verify-assets`: expected to fail until the reviewed Phase B migration dual-publishes canonical assets; this builder does not rename, copy, or delete audio files.

## Report-Mode Orphans

No audio file was deleted or renamed. The no-orphan report scanned only `public/voice/ob/` and `public/voice/onboarding/`; check-in and other voice namespaces were not touched.

```text
public/voice/ob/close.wav
public/voice/ob/create_your_own.wav
public/voice/ob/fork_question.wav
public/voice/ob/mic_permission_1.wav
public/voice/ob/onboard_01_form_1.wav
public/voice/ob/onboard_01_form_2.wav
public/voice/ob/onboard_advanced_1.wav
public/voice/ob/onboard_advanced_frequency_1.wav
public/voice/ob/onboard_advanced_frequency_2.wav
public/voice/ob/onboard_beginner_01_1.wav
public/voice/ob/onboard_beginner_02_1.wav
public/voice/ob/onboard_beginner_02_custom_1.wav
public/voice/ob/onboard_beginner_03_1.wav
public/voice/ob/onboard_beginner_03_custom_1.wav
public/voice/ob/onboard_beginner_04_1.wav
public/voice/ob/onboard_beginner_04_2.wav
public/voice/ob/onboard_beginner_07_1.wav
public/voice/ob/onboard_complete_1.wav
public/voice/ob/onboard_fork_form_1.wav
public/voice/ob/onboard_morning_setup_1.wav
public/voice/ob/onboard_morning_setup_2.wav
public/voice/ob/onboard_state_check_1.wav
public/voice/ob/onboard_state_check_2.wav
public/voice/ob/onboard_weekly_projection_blank_1.wav
public/voice/ob/onboard_weekly_projection_full_1.wav
public/voice/ob/onboard_weekly_projection_gaps_1.wav
public/voice/ob/onboard_weekly_projection_p36_1.wav
public/voice/ob/onboard_weekly_projection_p78_1.wav
public/voice/ob/reflect_alt.wav
public/voice/ob/reflect_forgive.wav
public/voice/ob/reflect_grateful.wav
public/voice/ob/reflect_proud.wav
public/voice/ob/reflect_time.wav
public/voice/ob/state_energy.wav
public/voice/ob/state_mood.wav
public/voice/ob/state_sleep.wav
public/voice/ob/state_stress.wav
public/voice/onboarding/ONBOARD-ADVANCED-FREQUENCY.mp3
public/voice/onboarding/ONBOARD-ADVANCED.mp3
public/voice/onboarding/ONBOARD-BEGINNER-01.mp3
public/voice/onboarding/ONBOARD-BEGINNER-02.mp3
public/voice/onboarding/ONBOARD-BEGINNER-03.mp3
public/voice/onboarding/ONBOARD-BEGINNER-04.mp3
public/voice/onboarding/ONBOARD-BEGINNER-07.mp3
public/voice/onboarding/ONBOARD-COMPLETE.mp3
public/voice/onboarding/ONBOARD-FORK--FORM.mp3
public/voice/onboarding/ONBOARD-MORNING-SETUP.mp3
public/voice/onboarding/ONBOARD-STATE-CHECK.mp3
public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-BLANK.mp3
public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-FULL.mp3
public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-GAPS.mp3
public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-P36.mp3
public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-P78.mp3
public/voice/onboarding/ONBOARD-WHY-INTRO.mp3
public/voice/onboarding/mic-permission.mp3
```
