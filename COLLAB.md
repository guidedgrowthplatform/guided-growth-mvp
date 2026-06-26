# COLLAB.md — building this repo with other sessions in parallel

Several Claude / Codex sessions build this flow builder at the same time on one
branch (`flow-builder-onboarding`). Read this before you edit so we don't
overwrite each other. The beats are one file each, so those rarely collide. The
shared hazard is `src/components/flow-designer/FlowBuilder.tsx`.

## 1. Git discipline (non-negotiable, every session)

Git never silently loses work if every session does this:

1. Commit small and often. One logical change per commit.
2. Before every push:
   `git fetch origin flow-builder-onboarding && git rebase origin/flow-builder-onboarding`
   then `git push`.
3. Stage named files only: `git add path/to/file`. NEVER `git add -A` or
   `git add .` — that sweeps up another session's untracked scratch files
   (audio exports, dist, etc.).
4. Never force-push. If a rebase hits a conflict, resolve it by hand. Do not
   `--skip` or use `-X ours/theirs` blindly — that is how work disappears.
5. Before pushing, it must pass:
   `npx tsc --noEmit -p tsconfig.json` and
   `npx vite build --config vite.flow.config.ts`.

Worst case with this discipline is a merge conflict you resolve, never lost work.

## 2. Who owns what (stay in your lane)

### Onboarding + interactivity + metadata
- `src/components/flow-designer/beats/`: splash, getStarted, splashIntro,
  authSignup, micPermission, profile, pathSelection, categoryGrid, goalsList,
  habitPicker, reflectionCard, planCards, advancedCapture, qaControl.
- `src/components/flow-designer/flowStateCtx.ts`.
- In `FlowBuilder.tsx`: the metadata sidebar (`MetaSection`, the Voice / AI /
  Screen / Authoring / Engine groups, `ENGINE_DEFAULTS`), the player
  (`FlowPhone` / `PlayView` / `PlayPanel` / `PhoneScreenInner`), the onboarding
  `DEFAULT_FLOW`, the path fork (`showOnPath`), the animations toggle.

### Audio + check-in
- `src/components/flow-designer/voiceScriptsAudio.ts`,
  `src/components/flow-designer/beatAudio.ts`, the audio / MP3 pipeline.
- the check-in beat files and the morning / evening flow defaults.
- In `FlowBuilder.tsx`: `withSheetAudio`, `clipsForStage`,
  `refreshCheckinFlows`, the check-in flow defaults, the MP3 metadata seeding.

#### Audio + check-in details (appended by the audio session)

Exact files in this lane:
- Beat components (one file each, the `beats/` glob auto-registers them):
  `beats/stateCheck.tsx` (type `state-check`, the 4-row sleep/mood/energy/stress
  card), `beats/habitReview.tsx` (type `habit-review`, the done / not-done / pending
  list), `beats/reflection.tsx` (type `reflection`, ONE beat that walks transition +
  proud + forgive + grateful as steps). NOTE: distinct from onboarding's
  `beats/reflectionCard.tsx` — different file, different type.
- In `FlowBuilder.tsx`: `MORNING_CHECKIN_FLOW` + `EVENING_CHECKIN_FLOW` (listed in
  `FLOWS`), and `VariationsPicker` + `playVariation` (the per-beat variations dropdown).
- Generator: `scripts/voice-sync/gen_voice_scripts_audio.py`.

The MP3 / sheet-audio pipeline:
- `voiceScriptsAudio.ts` is GENERATED — do not hand-edit. Regenerate with
  `python3 scripts/voice-sync/gen_voice_scripts_audio.py` (env `GOOGLE_SHEET_ID` +
  a service-account cred). It reads the App Master Sheet "Voice Scripts" tab columns
  `stage`, `n`, `mp3_en` (the clip URL), `text_en`, and emits
  `VOICE_SCRIPTS_AUDIO: Record<stage, {file, text}[]>`.
- The MP3 files live in the Supabase public bucket `checkin-audio`; filenames are
  `{stage}_{n}.mp3` (the base URL is baked into the generated file).
- `clipsForStage(stage)` (in `beatAudio.ts`) returns that stage's `{file, text}[]`,
  or `[]` if the stage has none.

Stage-to-clip convention (the important one):
- A CHECK-IN beat carries its Voice Scripts stage in `sheetStage`, e.g.
  `sheetStage: 'morning_greeting'`. The reflection beat carries a COMMA-SEPARATED
  list: `'reflection_transition,reflection_proud,reflection_forgive,reflection_grateful'`;
  `withSheetAudio` splits on comma and concatenates each stage's clips.
- GOTCHA: `sheetStage` is OVERLOADED. For check-in beats it is a bare Voice Scripts
  stage key; for onboarding beats it is a screen-id label ("ONBOARD-01--FORM: ...").
  Don't assume one format, and anything parsing it for check-in must handle commas.

How the audio attaches:
- `withSheetAudio(meta, sheetStage)` runs INSIDE `hydrate`: fills `meta.mp3Assets`
  from `clipsForStage`, sets `voiceEngine: 'MP3'`, and is GUARDED to never clobber
  manually-authored clips. If you edit `hydrate`, keep the line
  `meta: withSheetAudio(b.meta, b.sheetStage)`. This lane did NOT add a new data-model
  field — it reuses the existing `meta.mp3Assets` + `sheetStage`, so there is no
  `Placed` / `StoredBeat` / `BeatMeta` change from here.
- `VariationsPicker` reads LIVE from `clipsForStage(sheetStage)`, NOT from saved
  `meta.mp3Assets`, on purpose — so the picker can't go stale when a cached flow has
  no metadata. Keep it sourcing from the stage, not the saved meta.
- Beat-level playback in `FlowPhone` plays `current.meta.mp3Assets[0].file` on step
  change in Play mode. `FlowPhone` is the player (onboarding lane's region); the audio
  source is this lane's, so coordinate if you rework the player.

`refreshCheckinFlows` (runs once on mount) drops the cached `morning-checkin` /
`evening-checkin` localStorage so the rebuilt defaults load. Flag key
`gg-flow-builder-v18:checkin-refresh-2026-06-25`. If you change the check-in flow
DEFAULTS, bump that date so existing browsers pick up the new version.

Onboarding beats have no clips (live voice), so `clipsForStage` returns `[]` for
them, `VariationsPicker` renders null, and `withSheetAudio` no-ops. That is expected.

### Shared — both areas touch these, so rebase first and APPEND, do not reorder
- `FlowBuilder.tsx` data model: `Placed`, `StoredBeat`, `BeatMeta`, `serialize`,
  `hydrate`, `DefaultBeat`.
- The component registry: `REGISTRY` in `FlowBuilder.tsx`, `paletteExtras.tsx`.

When you add a field to the data model, append it as a new line at the end of
the type and at the end of the `serialize` + `hydrate` lists. Do not reformat or
reorder existing fields — reordering is what turns a clean auto-merge into a
conflict.

## 3. Before you start

- Glance at `~/Developer/yair-ai-files/Yair-Context/LIVE.md` to see what other
  sessions are touching right now.
- Per-workstream handoffs are in
  `~/Developer/yair-ai-files/Yair-Context/handoffs/` (flow-builder topics:
  flow-builder, flow-builder-app-connection, beats-design,
  onboarding-intro-animation, qa-control-screen, advanced-habit-capture).

## 4. The durable fix (not done yet)

`FlowBuilder.tsx` is a ~2700-line shared file. Splitting it into modules (data
model, registry, sidebar/metadata, player, default flows) would give each area
its own file and nearly remove the shared surface. That split is the next step
once the in-flight audio work lands; it has to be timed so it doesn't drop on
top of an active edit.
