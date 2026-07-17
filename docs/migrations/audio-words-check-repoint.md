<!-- GENERATED-MIGRATION-NOTE: Phase B audio manifest cutover. -->

# `audio_words_check.py` Repoint

Once the Phase B manifest is committed, `audio_words_check.py` must load
`src/generated/onboarding_audio_manifest.json` rather than onboarding entries in
`voiceScriptsAudio.ts` or a hand-maintained audio list.

For each `beats[beatId].lines[]` entry, compare the transcript for every declared
canonical asset (`renderWav.canonicalPath` and/or `appMp3.canonicalPath`) against
`lockedText`. A shared `clipId` may appear under more than one beat; validate a
clip once per `(format, canonicalPath)` after confirming manifest consistency.

Use the manifest metadata sidecar to record the exact input contract:
`src/generated/onboarding_audio_manifest.meta.json` contains `contractRevision`
and `contractSha256`. Each `beats[beatId].contractSeq` is the highest historical
Phase A `renames` tombstone sequence that resolves to that canonical beat, or
`null` when the beat has no rename tombstone. It is a per-beat migration stamp,
not an invented contract-wide sequence.

Check-in assets are deliberately out of scope: never scan `public/voice/*.mp3`
outside `public/voice/ob/` and `public/voice/onboarding/`.
