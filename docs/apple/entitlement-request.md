# Family Controls Distribution Entitlement — Request Package

Status: ready to file, 2026-07-09. Everything below the divider is paste-ready text for Apple's form. Built on gg-spec `screen-time-blocking-spec.md` §5, updated to the shipped v1 trigger (usage-limit, not reflection-lock).

## How to file (Yonas)

1. Sign in at **developer.apple.com** with the Account Holder role (only Account Holder / Admin can request managed entitlements). **[CONFIRM: which Apple ID holds the Account Holder role for team [CONFIRM: TEAM ID]]**
2. Go to the Family Controls entitlement request form: **developer.apple.com/contact/request/family-controls-distribution** (linked from the `com.apple.developer.family-controls` capability docs). Apple asks for app info + a free-text justification.
3. **File once PER BUNDLE ID — the app AND all four extensions, all on the same day.** Apple's docs are explicit: an extension needs its _own_ request; main-app approval does NOT carry to extensions. Filing an extension late has cost real developers 10+ extra days while the main app was already granted. Do not file piecemeal even though the Monitor extension ships last in code. (Verified — see `filing-plan-research.md` §2.)
4. The grant gates TestFlight + App Store only; development builds keep working meanwhile.
5. After the grant: enable the Family Controls (Distribution) capability on each of the five App IDs in Certificates, Identifiers & Profiles, then regenerate provisioning profiles.

## Pre-submission checklist (all must exist BEFORE filing)

- [ ] App ID `app.guidedgrowth.mvp` registered, plus App IDs for all four extension bundle ids
- [ ] **Complete App Store Connect listing**: description, screenshots, age rating, all metadata (see `app-store-listing.md`, `age-rating-answers.md`)
- [ ] **Live privacy-policy URL** stating on-device handling (see `privacy-policy-screentime.md`) — **[CONFIRM: privacy policy URL]**
- [ ] (Optional, NOT required to file) Demo video on a real iPhone — research could not confirm Apple requires a video to _grant_ the entitlement; it's a reviewer-notes asset for App **Review** later, not a filing blocker. Record once the feature works (see `demo-recording-script.md`).
- [ ] Contact email for Apple follow-up — **[CONFIRM: developer-account contact email]**

## Bundle IDs to name in the request (exactly these)

| Target                          | Bundle ID                           |
| ------------------------------- | ----------------------------------- |
| Main app                        | `app.guidedgrowth.mvp`              |
| DeviceActivityReport extension  | `app.guidedgrowth.mvp.report`       |
| DeviceActivityMonitor extension | `app.guidedgrowth.mvp.monitor`      |
| ShieldConfiguration extension   | `app.guidedgrowth.mvp.shieldconfig` |
| ShieldAction extension          | `app.guidedgrowth.mvp.shieldaction` |

---

## Justification text (paste into the form)

> Guided Growth is a digital wellbeing and habit-coaching app that helps people build healthier daily routines and a more intentional relationship with their phone. We are requesting the Family Controls distribution entitlement for our main app, **app.guidedgrowth.mvp**, and its four Screen Time extension targets:
>
> - **app.guidedgrowth.mvp.report** (DeviceActivityReport) — renders the user's own app-usage summary (which apps, how long, by hour) entirely on-device.
> - **app.guidedgrowth.mvp.monitor** (DeviceActivityMonitor) — watches the user's own daily time budgets and applies the shield when a budget the user set is reached.
> - **app.guidedgrowth.mvp.shieldconfig** (ShieldConfiguration) — shows a calm, informative block screen explaining that the user's own daily limit was reached.
> - **app.guidedgrowth.mvp.shieldaction** (ShieldAction) — handles the block screen's button, returning the user to Guided Growth.
>
> We use the Screen Time API for two user-initiated, opt-in features, both under FamilyControls **.individual** authorization — the account holder managing their own device. There is no parent/child pairing and no remote management.
>
> First, with the user's permission, we show the user their own app usage — which apps, total time, and a by-hour breakdown — so they can see their patterns. All of this data stays on the device; per-app usage is rendered by the sandboxed DeviceActivityReport extension and is never transmitted off the device.
>
> Second, the user can set a daily time budget on apps they choose themselves through the system FamilyActivityPicker. When an app crosses the budget the user set, the app shields only those selected apps for the rest of the day, and the shield lifts automatically at the user's daily reset.
>
> The user is in control at every step: they choose which apps and categories to include, set their own budgets and reset time, and can change or disable the entire feature at any time from within the app's settings. We never block the device as a whole — only the specific apps and categories the user selects; Phone, Messages, and emergency functions are unaffected. Our app never receives app names (the picker returns opaque tokens), and we do not transmit per-app usage off the device.
>
> Our privacy policy is at **[CONFIRM: PRIVACY POLICY URL]**. The app listing, screenshots, and age rating are complete in App Store Connect under **[CONFIRM: exact App Store app name, e.g. "Guided Growth"]** / app.guidedgrowth.mvp.
