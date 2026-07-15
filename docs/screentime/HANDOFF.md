# Screen Time lane — handoff

State: 2026-07-15, branch `feat/screentime-v1` (worktree `/Users/jonah/Documents/gg-screentime`),
based on `main@e9d34c6f`. Owner: Yonas. **Everything below is device-verified on a real iPhone
(iOS 27) unless marked otherwise.**

## What ships on this branch

| Piece                                                                                                                                                                                                                                                               | Status                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Apple Family Controls **distribution entitlement**                                                                                                                                                                                                                  | ✅ GRANTED (account-level; Step-5 portal enablement still pending before TestFlight) |
| Step 0 delivery guardrail — `ios/` committed, `scripts/patch-ios-screentime.mjs` in `cap:sync`                                                                                                                                                                      | ✅                                                                                   |
| M0 — `ScreenTime` plugin: auth (`.individual` Face ID), Apple picker, App Group persistence                                                                                                                                                                         | ✅ verified                                                                          |
| M1 — `GGScreenTimeReport` (DeviceActivityReport ext): real usage **inline in the dashboard** (Maps-style overlay, GG palette, real app icons, scrollable list, Today/Week + by-hour chart, vs-yesterday delta)                                                      | ✅ verified                                                                          |
| M2a — manual shield ("Take a break"), survives app kill                                                                                                                                                                                                             | ✅ verified                                                                          |
| M2 — `GGScreenTimeMonitor` (DeviceActivityMonitor ext): per-app/per-category **daily limits** (auto-shield rest of day, midnight re-arm), timed breaks (30m/1h/2h/today) with auto-lift, pause-app-now, `includesPastActivity` so exceeded budgets trip at arm time | ✅ built; limit-trip verification in progress                                        |
| Native limits sheet (real names/icons never reach JS)                                                                                                                                                                                                               | ✅                                                                                   |
| Web UI — 6-screen flow from the Claude Design mockup (`/screen-time`, Settings entry)                                                                                                                                                                               | ✅                                                                                   |
| Filing docs (`docs/apple/`, gg-spec `docs/screentime-filing/`)                                                                                                                                                                                                      | ✅ review-ready                                                                      |

Remaining milestones: **M2b/M2c** (ShieldConfiguration + ShieldAction exts — custom GG block
screen; today it's Apple's default gray), Android track (#287+), retention/edge QA.

## Architecture in one paragraph

JS never sees app names/usage (opaque tokens; Apple renders names/icons). Shared state lives in
the App Group (`group.app.guidedgrowth.screentime`) — keys in `GGMon` (`ScreenTimeLimits.swift`,
mirrored byte-for-byte in `GGScreenTimeMonitor/TotalActivityReport.swift`; **keep the two copies
in sync**). What is shielded is always `rebuildShield()` = (break active → whole selection) ∪
tripped budgets ∪ paused apps/categories, with expiry fail-safes. The app arms
`DeviceActivityCenter` schedules (`gg.daily` repeating + one threshold event per budget;
`gg.break` one-shot); the monitor extension handles the callbacks in the background. The inline
usage card is a native `DeviceActivityReport` view positioned over a WebView placeholder div
(`NativeUsageCard.tsx` streams rects per frame — Google-Maps pattern).

## Build & run on a device

```bash
cd /Users/jonah/Documents/gg-screentime
VITE_API_URL=https://guided-growth-mvp.vercel.app \
VITE_PUBLIC_WEB_ORIGIN=https://guided-growth-mvp.vercel.app npm run build
npm run cap:sync
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'id=<DEVICE-UDID>' -configuration Debug \
  DEVELOPMENT_TEAM=YFN7BZHFJN -allowProvisioningUpdates build
# install: xcrun devicectl device install app --device <UDID> <path-to-App.app>
```

## Gotchas (each cost us a debugging cycle)

1. **Never `npm run build` bare for a device** — it bakes `.env.local`'s
   `VITE_API_URL=http://localhost:3000` → black screen on phone. Always override (above).
2. **Xcode ▶ + iOS 27 = instant `OS_dispatch_mach_msg` abort** — Xcode-scheme "Backtrace
   Recording" bug, NOT our code. Launch from the home screen, or disable it in
   Edit Scheme → Run → Diagnostics.
3. **Both extension targets were created in Xcode GUI** (report + monitor). The monitor was
   Xcode's report template converted by hand: classic `NSExtension` Info.plist
   (`com.apple.deviceactivity.monitor-extension` + principal class) and pbxproj flipped to
   `app-extension`/PlugIns embed. `PlugIns/GGScreenTimeMonitor.appex` +
   `Extensions/GGScreenTimeReport.appex` must both exist in the built app.
4. **Report extensions can't write anything** (no App Group writes, no network) — the card
   can't tell JS how many apps there are; monitor extensions CAN write the App Group.
5. **Apple's category taxonomy surprises users** — TikTok/YouTube are _Entertainment_, not
   _Social_. Prefer individual-app selection for per-app limits.
6. **System dark mode leaks into native views** — every hosted view forces
   `.light` + GG palette hardcoded (extension + sheets).
7. Screen Time APIs: real device only, Low Power Mode suppresses events, timed schedules have a
   15-minute minimum, threshold events can lag ~1 min.
8. SIWA SPM pin conflict is auto-patched (`patch-siwa-spm.mjs`, runs in `cap:sync`).
9. Worktree needs `.vercel/` copied from the main repo for any vercel CLI use; use
   `npx vercel@37` (v54 watcher EMFILEs).

## Android + coach data layer (added 2026-07-15)

- **Coach data contract locked**: `docs/screentime/coach-data-contract.md` +
  `packages/shared/src/types/screentime.ts`. Coach receives bands (kept/approaching/crossed),
  never measured minutes. 7 new `screentime_*` session_log event types —
  **migration `058_screentime_event_types.sql` must run on staging before events land (FK).**
- **iOS band wiring**: each budget arms a second `<id>.warn` threshold at 80%; the monitor
  journals band transitions to the App Group (`gg.bandlog.v1`); `ScreenTimeCoachBridge`
  (App.tsx) drains the journal into session_log on launch/foreground. Threshold-event channel
  is UNPROVEN on the device matrix — coach must treat bands as best-effort until verified.
- **Android data track** (`android/.../screentime/`): `ScreenTimePlugin.java` +
  `GGScreenTime.java`. UsageStats read + JS picker (`AndroidAppPicker`) + JS limits editor
  (`AndroidLimitsView`); real names/icons stay on-device; boundary ids are UUIDs so
  session_log stays name-free. NO blocking layer yet (AccessibilityService = later,
  review-sensitive). Breaks hidden on Android (`canBreak=false`).
- **Android build**: web build with the same env override, then `npm run cap:sync:android`,
  then `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
sh gradlew assembleDebug` (system JDK is 17 — Capacitor 8 needs 21; Android Studio's JBR
  works). APKs land in `android/app/build/outputs/apk/{prod,qa}/debug/`.
- Do NOT file to Google Play — filing answers are [v2 pending]. Internal-testing installs
  (≤100 testers, no review) are the distribution path for now; permissions grant on-device.

## Filing / release linkage

- Entitlement **granted** → before any TestFlight build: developer portal → each of the 5 App
  IDs → enable **Family Controls (Distribution)** → regenerate match profiles
  (`docs/apple/FILING-RUNBOOK.md` Step 5).
- Demo recording for App Review: set-limit → auto-shield loop + take-a-break loop
  (`docs/apple/demo-recording-script.md`).

## Merge protocol

Draft MR to `main`; conductor/Yair-gated — do NOT self-merge. The branch rewrites history on
rebase (worktree lane), so pulls of this branch need `--force-with-lease` awareness.
