# Family Controls Entitlement — Filing Plan (research-backed)

Status: 2026-07-10. Sourced from a deep-research pass (17 sources, 25/25 claims
adversarially verified). This is the **evidence base** behind `entitlement-request.md` /
`privacy-policy-screentime.md` / `app-store-listing.md`. Where this doc and the earlier drafts
differ, this doc wins (it's grounded in verified sources).

**The headline:** getting `com.apple.developer.family-controls` for a _self-regulation_ app is a
well-trodden path — Opal, Jomo, ScreenZen, Dial all shipped on exactly our framing. There is **no
secret criteria**: the bar lives in the request form + Apple docs, not the Review Guidelines. Our
job is (a) file correctly (per-bundle-ID), (b) frame every surface as digital-wellbeing
self-management, (c) tell the verified on-device privacy story.

---

## 1. The `.individual` self-management lane is legitimate (not a hack)

- iOS 16+ **officially** supports `FamilyControls .individual` — the device owner self-authorizes
  via Face ID/Touch ID, **no parent/child or Family Sharing pairing**. WWDC22: _"Family Controls is
  now capable of authorizing independent users from their own device… can be used to build more
  than just parental controls apps."_
- An Apple DTS engineer (Quinn) on the forums: _"I don't see any obstacles to you using it for
  [an individual-device use case]. I recommend you give it a whirl."_ (Hedged — he doesn't own the
  approval process, so it's legitimacy, not a guarantee.)
- **The tension is real:** Apple's own `FamilyControls` doc abstract literally leads with _"Authorize
  your app to provide parental controls."_ That's exactly why we must steer every word of our
  filing + listing toward self-management — we're swimming against Apple's own default framing.
- Sources: developer.apple.com/documentation/familycontrols/authorizationcenter · WWDC22 #110336 ·
  forums/thread/712870

## 2. THE big logistics gotcha — file once PER BUNDLE ID, all targets at once

This is the single most important operational finding and it confirms the build-task's instinct:

- Adding the Xcode capability only grants the **development** entitlement. Distribution
  (TestFlight **and** App Store) needs a **separate written request** at
  **developer.apple.com/contact/request/family-controls-distribution**, submitted by the **Account
  Holder**.
- Apple doc, verbatim: _"If your app includes a Screen Time API app extension such as Device
  Activity Monitor, Device Activity Report, Shield Action, or Shield Configuration, submit the same
  request for the extension."_ → **one request per bundle id.** Main-app approval does **not** carry
  to extensions.
- Real burn (forums/thread/725036): _"Was granted for main application in only 2 days. Didn't
  realize extensions each needed their own submissions. Now at 10+ days… submit extensions at the
  same time as main application."_
- **Our action:** file **five** requests together the day we file — `app.guidedgrowth.mvp` +
  `.report` + `.monitor` + `.shieldconfig` + `.shieldaction`. This is why we name all four
  extensions up front (build-task Step 0 was right).
- Sources: developer.apple.com/documentation/familycontrols · .../requesting-the-family-controls-entitlement
  · forums/thread/725036 · forums/thread/813073 · Itsuki blog (_"One request Per Bundle ID!"_)

## 3. What the written justification must do (and what we can't source)

- **Confirmed requirement:** a written explanation of _why the app needs the capability_, framed
  around the framework's intended purpose = **device-usage management**. App Review **Guideline
  2.5.1** requires frameworks be used for their intended purpose **and reflected in the app
  description** — so the listing must foreground usage-management, not bury it.
- **Honest gap:** no leaked/quoted _verbatim winning justification text_ exists publicly. Our
  justification wording is **inferred** from WWDC22 + 2.5.1 + how approved apps position themselves,
  not copied from a documented approval. Treat `entitlement-request.md` as a strong first draft, not
  a proven-exact template.
- Sources: Brussee blog · .../requesting-the-family-controls-entitlement · Review Guidelines 2.5.1

## 4. The Guidelines have NO Family-Controls section — except one monetization rule

- Full-text check of the live Review Guidelines: **"Family Controls", "DeviceActivity",
  "ManagedSettings" appear nowhere.** "Screen Time" appears **once** — **Guideline 4.10**: _you may
  not **monetize** the Screen Time APIs._
- **What 4.10 means for us (a subscription app):** we cannot make "access to the Screen Time API"
  itself the paid product. A broad wellbeing app with a subscription spanning many features
  (coaching, tracking, check-ins) that _includes_ Screen Time is the Opal/Jomo model and is fine —
  but **do not** gate the raw Screen Time feature behind a standalone "pay to unlock screen-time
  blocking" wall framed as selling the API. Keep Screen Time as one feature inside the wider
  wellbeing subscription, not a metered paywall on the API.
- Source: developer.apple.com/app-store/review/guidelines/ (4.10, 2.5.1)

## 5. Listing framing — mirror the apps that shipped

- All approved peers list in **Productivity**, framed as **personal self-control / focus /
  digital-wellbeing**, **zero** parental/child language:
  - **Jomo** — _"Self Control & Focus… helps you stop wasting time on your phone so you can thrive."_
  - **ScreenZen** — habit-change / self-regulation; social accountability framed as _"a powerful
    motivator for changing your habits for the better"_ (self, not parent-enforced).
  - **Opal**, **Dial/SleepDial** — personal digital-wellness / app-blocking.
- **Our listing rule:** lead the Screen Time feature copy with "your own apps, your own limits,
  your own device." Never "control," "restrict others," "parent," "kids."
- Sources: apps.apple.com/.../jomo/id1609960918 · screenzen.co/privacy · opalapp.com help · sleepdial.com

## 6. Privacy-policy pattern — the verified 4-part story (with real quotes to mirror)

Every approved app tells the same story, and it's backed by Apple's own architecture (opaque
`ApplicationToken`s + a sandboxed `DeviceActivityReport` extension that physically can't read data
back into the host app). Our policy must say all four:

1. **Processed on-device** via Apple's Screen Time API.
   - Dial: _"Your screen time data is processed locally on your device using Apple's
     privacy-preserving ScreenTime API."_
2. **Never transmitted** to our servers.
   - Dial: _"This data remains on your device and is not transmitted to our servers."_
3. **We can't see it** — no view/download/share of individual usage.
   - Dial: _"We do not have access to view, download, or share your individual app usage details."_
   - Jomo: _"Jomo has no access and will never see your private data."_
4. **Opaque tokens** — apps/sites are privacy-preserving tokens, unidentifiable to us (or Apple).
   - Apple WWDC21: _"Family Controls provides opaque tokens… your customers' usage data will be
     invisible outside of their device."_

- ⚠️ **Scope the "on-device only" claim precisely.** ScreenZen's local-only claim covers **core
  blocking data**; its optional social/hardware features _do_ transmit. For v1 we send **nothing**
  to the backend, so we can make the strongest version of this claim honestly — but the moment any
  coarse signal (Focus Score, streaks) ships later, the policy must narrow to "core Screen Time
  usage data stays on device" and separately disclose the coarse signal. Don't over-claim across
  future versions.
- Sources: WWDC21 #10123 · sleepdial.com/privacy · opalapp.com help · jomo listing · screenzen.co/privacy

---

## Corrections this research forces on our earlier drafts

1. **Demo video is NOT a confirmed hard requirement of the entitlement _form_.** The research
   could not verify Apple requires a video to grant the entitlement. A recording is still worth
   making — for App **Review** reviewer notes and internal proof — but reframe it in
   `entitlement-request.md` from "required by the form" to "reviewer-notes / App-Review asset." (Open
   question below.)
2. **Add the per-bundle-ID / file-all-five-together instruction** as the #1 step of
   `entitlement-request.md` — it's the highest-leverage, best-sourced fact and the easiest to get
   wrong.
3. **Add a 4.10 monetization note** — keep Screen Time inside the broad subscription, never a
   metered paywall on the API.

## Still-open questions (couldn't source; decide or accept risk)

- Exact **verbatim** justification text a recently-approved self-management app submitted — none is
  public. Our draft is inferred.
- Whether Apple **requires/strongly favors a demo video** for the _entitlement request_ specifically,
  and what it must show.
- Documented **rejection reasons specific to non-parental** Family Controls filings + the fixes.
- Whether App Review has flagged self-management Screen Time apps under **5.1.1 (data collection)**
  or **4.2 (minimum functionality)**, and how approved apps responded.

## Source quality

17 sources: Apple primary docs + WWDC (highest weight), Apple Developer Forums (incl. DTS
engineer), 3 indie dev blogs, 4 shipping-app primary pages (listings + privacy policies). Full list
in the research transcript.
