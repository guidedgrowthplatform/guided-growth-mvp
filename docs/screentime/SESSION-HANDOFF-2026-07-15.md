# Session handoff — Screen Time lane → next: Android + coach data layer

Date: 2026-07-15. Previous session: built + device-verified iOS Screen Time v1 (M0–M2).
New mission (Yair): **the Android version + the coach data layer, both together.**

## Read these, in order

1. **Yair's get-started brief (LIVING doc — re-read it, it updates):**
   https://gitlab.guidedgrowthapp.com/guidedgrowth-group/gg-spec/-/blob/main/docs/screentime-android-and-coach-getstarted-2026-07-15.md
2. `docs/screentime/HANDOFF.md` (this branch) — iOS architecture, build recipe, the 9 gotchas.
3. `docs/screentime/plugin-api-contract.md` — the one JS surface both platforms implement.
4. gg-spec `docs/screentime-filing/` — framing law (never "parental controls") + Android research.

## Where the last session left off

- Branch `feat/screentime-v1`, worktree `/Users/jonah/Documents/gg-screentime`, pushed.
  **Draft MR !569** (conductor-gated, do NOT merge): .../guided-growth-mvp/-/merge_requests/569
- iOS on-device state (Yonas's iPhone 14 Pro Max, UDID `00008120-00044539010B401E`, iOS 27):
  M0 auth/picker ✅, M1 inline real-usage card ✅, M2a break shield ✅,
  M2 limits/timed-breaks/pause **built** — the decisive limit-trip re-test (individual apps +
  `includesPastActivity`) was still pending when the session ended.
- Xcode is signed into Yair's team (YFN7BZHFJN). Family Controls (Distribution) is **enabled on
  all 5 App IDs** in the portal; profiles regenerate with the next release build.
- Open iOS items: limit-trip verification, M2b/M2c (custom GG shield screen — Apple default gray
  shows today), demo recording for App Review.

## The new build, per Yair (2026-07-15)

**First milestone: working screen-time on real Android test phones.** No Play review needed —
Play _internal testing_ reaches up to 100 testers review-free, permissions are granted on-device,
so testers get the full feature.

Order of attack — both data tracks together, **iOS sets the shape** (tighter constraint; build
the coach against iOS, Android over-delivers into the same shape):

1. **iOS data wiring into the existing live app** — fastest way to see real signal.
2. **Android data-reading in parallel** — `UsageStatsManager` + `PackageManager`. Quick,
   sanctioned, no review; the natural way to start learning Android.
3. **Android blocking last** (`AccessibilityService` + disclosure screen) — the review-sensitive
   piece.

**The section to get right: the uniform coach data contract.** The shared card is **boundary
state (on track / approaching / crossed), NOT minutes** — iOS can't feed the coach raw numbers.
iOS mechanics that fit: the report extension can't write anything, but the **monitor extension
CAN write the App Group** — threshold events (including intermediate warning thresholds) are how
iOS emits on-track/approaching/crossed without ever exporting minutes. Android reads real numbers
via UsageStats and _reduces_ them to the same boundary states.

**[v2 pending] — do NOT act on these yet:**

- exact iOS window strategy for best accuracy
- Google Play filing form answers — **don't file to Play yet**

## Practical notes for the new session

- Work stays on a lane branch in the worktree (or a new branch off it) — another agent works main.
- Android platform isn't added yet in the worktree (`android/` gitignored + regenerated;
  `npm run cap:sync:android` + `patch-android-manifest.mjs` exist). Same delivery-guardrail
  thinking as iOS Step 0 will apply.
- Device builds: NEVER bare `npm run build` (bakes localhost API — black screen). See HANDOFF.md.
- Mattermost: post #MVP status per milestone; Yonas relays to Yair; never self-merge.
