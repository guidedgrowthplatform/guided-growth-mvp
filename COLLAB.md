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
