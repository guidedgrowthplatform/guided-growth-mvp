# Phone Fidelity Report

## Scope

Compared the current viewer/chrome implementation with the read-only original at
`/home/ggvoice/gg-ground/render-original/src/components/flow-designer/`.
The comparison covered `FlowDesigner.tsx`, `FlowPlay.tsx`, and the original
`FlowBuilder.tsx` phone-frame primitives (`PhoneScreenFrame`, `PhoneScreenInner`,
and the surrounding beat-tile chrome). No beat data or locked copy changed.

## Changes made

- Removed the in-phone `Coach` header from the annotated phone frame.
- Removed the in-phone engine chip (`MP3`, Cartesia, etc.) from the annotated phone frame.
- Moved the per-beat `PLAY`/`STOP` control out of the phone and into the existing left-side annotation rail.
- Kept engine/mode chips in the existing outside rail: the full source-of-truth panel on onboarding and the compact voice tag on the other tabs.
- Removed the `Coach` header and engine chip from the single-device `FlowPlay` phone preview as well.
- The in-frame screen now starts directly below the simulated iOS status bar, so all remaining content is real beat/app content.

## Divergences found

| Area | Finding | Resolution |
| --- | --- | --- |
| Annotated phone header | Current `PhoneCard` rendered `Coach`, playback, and an engine/MP3 chip inside the device. These are annotation controls, not app UI. | Fixed: removed the entire header and moved playback to the outside rail. |
| FlowPlay phone header | Current `FlowPlay` rendered `Coach` and the engine/MP3 chip above the real beat stage. | Fixed: removed the header; the phone now contains only status bar plus app content. |
| In-screen vertical offset | The non-app header consumed vertical space and displaced the beat content below the status bar. | Fixed by removing that header in both previews. |
| Playback chrome ownership | The original builder composition owns beat playback in the outer beat-tile chrome rather than `PhoneScreenInner`. | Fixed: `PLAY`/`STOP` is outer rail chrome and no longer a `PhoneCard` concern. |
| Frame dimensions and status-bar geometry | Direct comparison found no current-only divergence requiring a dimension change: annotated `FlowDesigner` retained its established 420px phone column, and `FlowPlay` retained its 402×812 device preview and status-bar proportions. | No change; changing these would not be supported by the reference comparison. |
| Additional in-screen chrome | No other viewer-owned chips, clip labels, or annotation controls remain inside the changed phone-frame compositions. | No additional fix needed. |

## Preserved features

- Six annotated metadata sections in the source-of-truth rail remain intact.
- QA fixes remain intact: plan card, women's art, per-habit day pickers, and projection numbers.
- Beat data and locked copy remain untouched.

## Validation

Executed with Node 22 after the viewer/chrome-only changes:

```text
npm run type-check
> tsc --noEmit
[exit 0]

npm run check:render
Render CONSISTENCY check passed: 62 beats, one source (beatsSource.ts).
[exit 0]

npm run check:links
Render LINK-INTEGRITY check passed: 62 beats, all bindsTo elements + clips resolve.
[exit 0]

npm run build:flow
✓ 2274 modules transformed.
✓ built in 6.89s
Wrote dist-flow/parity.json with 62 beats
Wrote dist-flow/_headers
[exit 0]

npm run verify:objective1
locked-copy delta: onboarding-beat-6-profile:greeting.script[0].words
  old: "Good to meet you, {name}. Two quick things so I can tailor this to you."
  new: "Awesome {name}, two quick things so I can tailor this to you."
locked-copy delta: onboarding-beat-6-profile:asks.script[0].words
  old: "How old are you?"
  new: "How old are you, and how do you identify?"
Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.
[exit 0]
```

`build:flow` emitted only Vite's pre-existing large-chunk advisory; it completed successfully.
