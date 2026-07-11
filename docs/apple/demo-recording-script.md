# Demo Video — Screen-Recording Script (entitlement filing)

Two cuts. Record (a) the moment M2a works — it starts the Apple clock. Re-record (b) when M2 lands and attach the stronger cut if timing allows. Performer: Yonas, on a real iPhone.

## Recording notes (read first)

- **Real device only.** Screen Time APIs do not run in the Simulator.
- **Low Power Mode OFF** — it suppresses DeviceActivity events (kills the auto-shield in cut b).
- Development-entitlement build from Xcode (no Apple gate needed to record).
- Use iOS built-in screen recording (Control Center). Portrait. Keep it **under ~2 minutes**.
- **No red or punitive UI in frame.** Shield and all app screens must read calm/green.
- Do Not Disturb ON (no notification banners over the demo).
- Use neutral demo apps in the picker (e.g. a game, a social app) — avoid anything embarrassing in the usage view.
- No narration needed; slow deliberate taps. Pause ~1s on each key screen so the reviewer can read it.
- Trim start/end in Photos; export and upload to **[CONFIRM: hosting location for the video — unlisted link or direct attach, per what the form accepts]**.

## Cut (a) — M2a minimal (manual shield proof) — target 60–90s

1. Home screen → open **Guided Growth**.
2. Navigate to the Screen Time / Focus feature screen. Pause on the opt-in copy (user-in-control framing visible).
3. Tap **Enable**. The Apple **.individual authorization** sheet appears → confirm with **Face ID**. Pause so the system sheet is clearly legible.
4. The **FamilyActivityPicker** (Apple's picker) opens. Select 2–3 apps deliberately. Tap Done.
5. Back in Guided Growth: apply the shield (the manual block-now action). Confirmation state visible.
6. Swipe home → open one of the shielded apps. The **block screen appears**. Pause ~2s on it.
7. Return to Guided Growth → clear the shield (disable / clear action).
8. Open the same app again → it **works normally**. End recording.

Beats that must be unmistakable: Face ID authorization sheet (3), Apple's own picker (4), block screen (6), user-initiated clear + app usable again (7–8).

## Cut (b) — Full M2 (usage-limit auto-block) — target 90–120s

Steps 1–4 as above, then:

5. Open the **usage view**: per-app time visible, tap the **Today / This Week** toggle, show the **by-hour** breakdown on Today. (~10s — this is the "read" half evidence.)
6. Set a **daily time budget** on one selected app (pick a tiny budget, e.g. 1 minute, so the trip happens on camera or with one short cutaway).
7. Use that app until the budget trips. When usage crosses the budget, the **shield appears automatically** — capture the moment or cut back to the app now showing the block screen. Pause on the reason text ("You've used your N minutes… Back tomorrow.").
8. Show the **daily reset lifting the shield**: simulate by moving the reset time in Guided Growth's settings to now (or the next minute), then open the app → usable again.
9. Optional closer (5s): Guided Growth Settings → the feature **off-switch**, toggle it off, shields clear.

Beats that must be unmistakable: on-device usage view (5), user setting their own budget (6), automatic shield with stated reason (7), shield lifting at reset without any coercive step (8).

## If a step misbehaves on camera

- Auto-shield not firing: check Low Power Mode, then re-arm by re-saving the budget; DeviceActivity events can lag ~1 min.
- Never splice in footage of a different flow — one honest take per cut beats an edited composite; Apple reviewers only need to see the legitimate loop once, clearly.
