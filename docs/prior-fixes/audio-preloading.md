# Prior fix: audio clip pre-buffering / preloading (B15)

## Verdict: no prior fix found — solve fresh

Searches run: `git log --all` grep + `-S` pickaxe for preload, prefetch,
canplaythrough, HAVE_ENOUGH_DATA, readyState, `new Audio`, buffer, cache, warm,
manifest — no commit implements ahead-of-time MP3 preloading. The pre-579023d3
page-based onboarding had no preload machinery either (Vapi/Cartesia only, no
static clips).

## Current mechanism (staging)

`src/onboarding-flow/renderer/useBeatOpenerMp3.ts` creates the Audio element at
beat mount with `el.preload = 'auto'` — reactive, network-ridden, exactly the B15
symptom. No `rel="preload"` in index.html, no service-worker caching, no
manifest-driven fetch.

## Reusable patterns in the current tree

- `src/lib/services/tts-service.ts` — 1-ahead prefetch for Cartesia chunks
  (synthesize next while current plays). Pattern, not code, transfers.
- `src/lib/audio/attempt-play-with-gesture-fallback.ts` — existing autoplay
  gesture fallback; reuse for first-play gating, do not build a second one.

## Design for Loop 1 step 4 (fresh)

Preload pool over the 18 `meta.voiceOut.mp3Assets` clips at flow mount, keyed by
screenId; first play gated on `canplaythrough`; lazy per-clip fallback when a
preload fails. No prior art constrains the shape.
