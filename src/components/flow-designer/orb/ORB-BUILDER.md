# Orb builder

A workspace for designing the Guided Growth orb and the home bar it lives in. It
sits inside the flow builder as a top-level mode, next to Flows.

## Where it is

Open the flow builder. At the top there's a switch: **Flows** and **Orb builder**.
Pick Orb builder and the whole thing transforms into the orb workspace: no
components palette, no flow tabs, just the orb, its tuner, and the home bar.

Files:

- `orb/OrbTuner.tsx` — the orb and the live tuner. Canvas-2D Siri-style orb.
- `orb/orbPresets.ts` — presets, the two locked looks (idle / talking), the pulse
  config, and the saved-preset storage. Version-controlled, so presets persist.
- `orb/HomeBarPreview.tsx` — the home bar canvas (the starting point to improve).
- `FlowBuilder.tsx` — the Flows / Orb builder mode switch.

## What's there now

- **Idle look and Talking look** as separate settings. Talking has two styles:
  full circle (both halves merge into one colored orb) and directional (blue left
  when the coach talks, yellow right when you talk). Switchable.
- **Pulse** as its own tab: base size (how big it gets while talking) and extra
  pulse (the breathing on top), plus pulse speed.
- **Save as preset**: type a name, Save. It saves the look you're editing and tags
  it idle or talking. Saved looks show as chips grouped by state. Each chip has
  apply, a copy-line-for-orbPresets.ts button, and delete. Live edits persist in
  the browser; the presets file is what everyone shares.
- **Home bar canvas**: the real DualButton in the app's scooped bottom-nav shape.
  Mirrored from `components/layout/BottomNav.tsx` so it needs no router or voice
  providers.

## Run it locally

From the repo root:

```
npm install
npx vite flow-standalone --config vite.flow.config.ts --base / --port 8791
```

Open http://localhost:8791/ and click Orb builder.

To build the static bundle (this is what gets deployed):

```
npx vite build --config vite.flow.config.ts
# output: dist-flow/
```

## How to work on it

1. Branch off this branch (`feat/orb-tuner-section`). Keep commits small.
2. **Your own presets**: add a block keyed by your name in `AUTHOR_PRESETS`
   inside `orbPresets.ts`. There's a commented example at the bottom. Nobody
   touches anyone else's block, so there are no merge conflicts. When a look is
   worth keeping, use the copy button on a saved chip and paste the line into your
   block.
3. **Improve the home bar**: `HomeBarPreview.tsx` is the canvas. Build the
   components around the orb there. Keep the DualButton geometry and the scoop
   path matched to `BottomNav.tsx` so what you design maps onto the real bar.

## What to connect

The tuner is the design surface. The real bar is `components/layout/BottomNav.tsx`,
which renders the real `DualButton`. To take a tuned look live:

- The orb's animated look lives in `OrbTuner.tsx` (canvas draw + the params in
  `orbPresets.ts`). To put it in the real bar, the orb render needs to become a
  reusable piece that both the tuner and the bar use at any size (the bar orb is
  `size={91}`).
- Presets are plain numbers in `orbPresets.ts`. The app can read the chosen look
  from there.

## Publish for review

Once it looks good on your branch, deploy the flow bundle to Vercel and send the
preview URL so it can be reviewed live. Build with the command above, deploy
`dist-flow/`. Confirm the exact Vercel project before the first deploy.
