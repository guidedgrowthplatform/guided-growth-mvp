# Fix report, gesture-gated first audio (+ preview mic-allow wedge)

Branch `feat/gesture-gated-first-audio`, MR !403 (draft, stacked on !397,
merge after it). Verified 2026-07-02 locally and on the CI preview
`gg-m3a7gedqs-guided-growths-projects.vercel.app`.

## The requirement (Yair, verbatim intent)

The FIRST audio of onboarding must start from the "Get started" button tap on
the previous beat, not by autoplay. Autoplay of the first clip gets blocked by
the browser and then fires later on a random unrelated tap, which testers
experience as audio playing randomly. Starting it inside the Get-started click
gesture makes playback deterministic and unlocks the audio context for all
subsequent beats.

## Root cause

`IntroGate` phase 1 (Get started) only flipped a phase state on click. The
clip (`/voice/splash_welcome.mp3`) was then started by `SplashIntro`, one
render later, from a `useEffect`. When the browser rejected that play()
(autoplay policy, `NotAllowedError`), SplashIntro armed its window-pointerdown
fallback (`[splash-audio] autoplay blocked, waiting for tap`) and the clip
fired on the NEXT gesture, whichever tap that happened to be. Same class of
problem as B4's defer-to-gesture, but on the intro surface.

## Fix

1. `openerGestureStart.ts` (new): `startOpenerFromGesture(src)` claims the
   clip from the existing `openerPreloadPool` (fresh `Audio` fallback) and
   calls `play()` SYNCHRONOUSLY in the caller's gesture frame. Deliberately no
   readiness await before play(): awaiting would leave the gesture frame and
   forfeit the activation. Returns a handle: the element, a `started` promise
   resolving true/false (never rejecting), and an idempotent pool `release()`.
2. `IntroGate`: preloads the intro clip while the Get-started screen shows,
   starts it inside the Get-started click handler, and passes the handle to
   `SplashIntro` via the new `adoptedOpener` prop. Releases the claim on
   completion and on unmount.
3. `SplashIntro`: when `adoptedOpener.src === audioSrc`, ADOPTS the
   already-playing element (orb envelope, captions, onended all track it) and
   never re-arms `play()` over it, so the clip cannot double-start. It arms
   its own play only if the gesture play() was rejected, or the element was
   paused between the gesture and adoption (the strict-mode remount shape),
   which also re-installs the deferred-to-tap safety net. The internal
   `<audio>` gets no src while adopting (no duplicate fetch).

The deferred-to-tap fallback stays untouched in `useBeatOpenerMp3` and in
SplashIntro's non-adopted path, covering entry paths that skip Get started
(`?startAt` jumps, QA tiles, refresh landings). No other beat's behavior
changed. Done-after-playing preserved.

## Scope addition: preview mic-allow wedge (coordinator, verified live by Yair on gg-bplca6yel)

Allowing the microphone on the auth-free preview wedged the beat on a spinner.

- **Cause 1:** `FlowOnboardingPreview` seeded `anonId` as `preview-<uuid>`,
  but the Supabase `anon_id` columns are uuid-typed, so every anon-keyed REST
  call 400d (`invalid input syntax for type uuid`). **Fix:** seed a plain
  `crypto.randomUUID()`; the "preview identity" marker moved to localStorage
  key `gg_preview_anon_id` (also keeps the id stable across preview reloads).
  Previews point at staging, junk rows are acceptable.
- **Cause 2:** the mic beat `await`s `updatePreferences(...)`; a rejected
  upsert became an uncaught rejection and the beat never advanced. **Fix:**
  `useUserPreferences.persistOrDegradeToLocal` catches at the mutation seam:
  a failed remote write resolves, keeps the chosen values in the cache and
  local snapshot (the signed-out contract), and the flow moves on. Protects
  real users too when RLS rejects. The mutation `error` stays exposed on the
  hook. Known behavior change: SettingsPage's mic-toggle catch no longer
  fires on remote failure (the toggle applies locally instead of snapping
  back with an error toast).

## Verification (all on this branch, commits 2a52713d + 3c7b64ad)

- `npx tsc --noEmit` clean; vitest 1375/1375 across 135 files, including 8
  new tests: `openerGestureStart.test.ts` (synchronous in-gesture play on the
  pooled element, claim serialization, started outcome on block, release
  idempotency), `SplashIntro.adopt.test.tsx` (adopt-not-double-start,
  rejected-gesture fallback, paused-pre-adoption re-arm, src-mismatch
  ignore), `useUserPreferences.degrade.test.tsx` (rejected upsert resolves
  and keeps values local; happy path unchanged).
- Playwright, autoplay BLOCKED (default chromium, no autoplay flag), fake
  mic device, script `verify-gesture-audio.mjs` (untracked, worktree root),
  route `/onboarding-flow-preview?startAt=mic` (startAt skips only the auth
  beat; the intro gate and gesture path are fully real). 12/12 checks PASS
  on BOTH targets:
  - local dev (vite :5321), and
  - deployed CI preview `gg-m3a7gedqs-guided-growths-projects.vercel.app`.

  The 12 checks: (A1) zero play() calls and zero `playing` events on earlier
  or unrelated taps; (B1) the Get started tap issues play() for
  splash_welcome.mp3 at +42ms; (B2) `playing` fires at +99ms from the tap;
  (B3) currentTime advances (clip really progressing, runs to its 13.28s
  end); (B4) no NotAllowedError on the splash clip; (C1, C2) mic beat
  reached, Allow clicked, beat advances, no spinner wedge; (C3) the mic
  beat's MP3 opener plays with NO extra tap (the unlocked context); (C4) no
  NotAllowedError on any onboarding clip; (D1) no uncaught page errors;
  (D2) no user_preferences 4xx; (D3) no invalid-uuid console errors.

- Observed shape worth knowing: both dev and the deployed preview show the
  known double-activation remount (the B4 report documented it on deployed
  builds too). The gesture play() gets AbortError'd by the first run's
  cleanup pause and the adoption path re-arms immediately: net `playing` at
  +99ms from the tap, start still deterministic, zero audible gap
  (currentTime 0.023 on re-arm). The AbortError is scoped and recovered by
  design, not a failure.

## Assumption check

Yair's assumption (same functionality, deterministic start) held: the clip,
captions, orb envelope, completion flow, and all later beats behave exactly
as before; only the START moved into the tap's gesture frame. One deliberate
behavior difference beyond the ask, introduced by the coordinator's seam fix:
Settings mic-toggle remote failures now degrade to local-only success instead
of snap-back + error toast (see scope addition above).
