# Apple Screen Time Filing — Execution Runbook

Status: 2026-07-11. **The single do-this-in-order guide** to file the Family Controls entitlement
for Guided Growth's Screen Time feature. Every step has the exact page, what to do, and what to
paste. Content lives in the sibling docs in this folder; this runbook sequences them.

**Who runs it:** anyone with account access can follow it. Steps 1, 3, 4 need the **Account Holder**
(you). Content is 100% pre-written — you're clicking + pasting, not authoring.

**Before you start — read off these 5 values once** (I can't see your account). Where to find each:

| #   | Value                        | Where to find it                                                            |
| --- | ---------------------------- | --------------------------------------------------------------------------- |
| 1   | **Team ID**                  | developer.apple.com/account → **Membership details** → "Team ID" (10 chars) |
| 2   | **Account Holder Apple ID**  | the Apple ID you sign in with (has the Account Holder role)                 |
| 3   | **Contact email**            | your developer-account contact email                                        |
| 4   | **Exact App Store app name** | App Store Connect → your app → the display name (e.g. "Guided Growth")      |
| 5   | **Privacy policy URL**       | where you'll host the policy (Step 2 decides this)                          |

Paste those into the top of `entitlement-request.md` where it says `[CONFIRM: …]`, and you're done
authoring. Everything else below is mechanical.

---

## STEP 1 — Register the 5 App IDs _(Account Holder · ~10 min · no code)_

**Navigate:** sign in at **developer.apple.com/account** → on the account page open
**Certificates, Identifiers & Profiles** (it's a section link / dropdown item on that page — NOT a
left-side menu) → then choose **Identifiers**. You'll see the list of existing Identifiers with a
blue **＋** at the top.

For **each** of the 5 bundle IDs below, click the blue **＋** and step through the wizard:

1. **Register a new identifier** → select **App IDs** → **Continue**.
2. Select type **App** → **Continue**.
3. **Description:** (from the table) · **Bundle ID:** choose **Explicit** and paste the exact id.
4. Scroll the **Capabilities** list (alphabetical, under **F**) → check **`Family Controls
(Development)`**. It's labelled **"Development only"** — that is CORRECT and expected; it grants
   the dev-time entitlement so the feature runs on a real device now. The **Distribution** variant
   does not appear here yet — it becomes available only AFTER Apple grants the request (Step 5).
   Leave **"Family Controls App and Website Usage"** UNCHECKED (separate, not needed).
5. **Continue → Register.**

| #   | Description                  | Bundle ID (Explicit)                |
| --- | ---------------------------- | ----------------------------------- |
| 1   | Guided Growth                | `app.guidedgrowth.mvp`              |
| 2   | GG Screen Time Report        | `app.guidedgrowth.mvp.report`       |
| 3   | GG Screen Time Monitor       | `app.guidedgrowth.mvp.monitor`      |
| 4   | GG Screen Time Shield Config | `app.guidedgrowth.mvp.shieldconfig` |
| 5   | GG Screen Time Shield Action | `app.guidedgrowth.mvp.shieldaction` |

> #1 (`app.guidedgrowth.mvp`) already exists — just **edit it** and add the Family Controls
> capability; don't create a duplicate. The other 4 are new.

✅ **Done when:** all 5 App IDs exist and each shows **Family Controls** enabled.

---

## STEP 2 — Privacy policy _(already have the URL)_

Guided Growth already has a privacy policy URL — **use it as value #5.**

Just make sure the page includes the **Screen Time + Calendar** sections (full text in the sibling
`docs/privacy-policy.md`). The entitlement form and the listing both link to this same URL.

✅ **Done when:** the privacy policy page includes the Screen Time section and you've noted the URL
as value #5.

---

## STEP 3 — Complete the App Store Connect listing + age rating _(Account Holder / Admin · ~30 min)_

**Page:** appstoreconnect.apple.com → your app → **App Information** + the version page.

**1. Category:** Productivity (primary). _(Matches every approved peer — Opal/Jomo/ScreenZen.)_

**2. Description** — 📋 add this paragraph (must foreground "your **own** usage / your **own** limits"; Guideline 2.5.1):

> **Take back your screen time.** See your own app usage at a glance — which apps, how long, and when — all processed privately on your device. Choose the apps you find distracting, set a daily time budget for each, and Guided Growth will gently pause them for the rest of the day when you hit your limit. You pick the apps, you set the limits, and you can change or turn it all off anytime. Your usage data and app choices never leave your phone.

**3. Promotional text** (170 max) — 📋 paste (168 chars):

> New: Screen Time for self-management. See your own usage, set daily limits on distracting apps, and stay focused — private, on-device, and fully in your control.

**4. Keywords** (100 max, comma-separated, no spaces) — 📋 paste (97 chars); merge with existing keywords, don't lead with "parental control/child/block":

> `screen time,app limit,focus,digital wellbeing,habit,distraction,phone usage,self control,mindful`

**5. Screenshots** — shot-list (capture on a real device once the UI exists; calm/green frames only, no red):

1. Feature intro / opt-in screen ("you're in control" copy visible)
2. Apple app picker (a few apps selected)
3. Usage view — **Today** (per-app time + by-hour)
4. Usage view — **This Week** (the Today/Week toggle)
5. Budget setup (setting a daily limit)
6. Shield screen (the block screen stating the reason)
7. Settings off-switch (feature can be disabled anytime)

Sizes: 6.9" (iPhone 16 Pro Max class) required; 6.5" optional.

**6. Age rating** — open App Information → Age Rating → Edit and answer 📋 exactly:

| Question                                                                   | Answer                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Cartoon/Fantasy Violence · Realistic Violence · Prolonged Graphic Violence | **None**                                                                                               |
| Profanity or Crude Humor · Mature/Suggestive · Horror/Fear                 | **None**                                                                                               |
| Medical/Treatment Info · Alcohol/Tobacco/Drugs · Simulated Gambling        | **None**                                                                                               |
| Sexual Content or Nudity · Graphic Sexual Content                          | **None**                                                                                               |
| Unrestricted Web Access                                                    | **No** (the feature restricts, not opens, access)                                                      |
| Gambling (real currency) · Contests                                        | **No**                                                                                                 |
| Made for Kids / Kids Category                                              | **No** (general wellbeing app for the account holder)                                                  |
| In-app browser                                                             | **No**                                                                                                 |
| User-generated content shared with others                                  | **No** (reflections are private, not shared)                                                           |
| Messaging/chat with other users                                            | **No** (chat is with the AI coach only)                                                                |
| App contains AI-generated content / chatbot                                | **Yes** (AI coach; safety-bounded)                                                                     |
| Health/medical app                                                         | **No** (wellbeing/habit coaching, not diagnosis)                                                       |
| Parental controls / content restriction                                    | Frame as **self-management** — restricts only the account holder's own selected apps via `.individual` |

Expected computed rating: **4+**. Keep every answer consistent with "self-regulation, no child users, no parental controls."

**7. Privacy policy URL field:** paste value #5.

**8.** ⚠️ **Do NOT** put Screen Time behind a "pay to unlock blocking" wall framed as selling the API — keep it inside the normal subscription (Guideline **4.10**: no monetizing Screen Time APIs).

✅ **Done when:** description, promo text, keywords, age rating, and privacy URL are saved on the listing.

---

## STEP 4 — File the entitlement request _(Account Holder · ~15 min · THE key step)_

**Page:** **developer.apple.com/contact/request/family-controls-distribution**
(linked from the `com.apple.developer.family-controls` capability docs). Sign in as **Account
Holder**.

1. **Name all 5 bundle IDs in this one submission** (the table in Step 1). #1 gotcha: an extension
   needs its own grant, and filing them late costs extra weeks. **All five, same day.**
2. In the justification field, 📋 paste this (fill the `[CONFIRM]` blanks first):

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

3. Submit.

> A demo video is **not** required to file. (Record one later only if App Review asks — see
> `demo-recording-script.md`.)

✅ **Done when:** the request is submitted for all 5 bundle IDs. Apple's review clock starts here.

---

## STEP 5 — After Apple grants it _(later, when the email arrives)_

1. developer.apple.com/account → each of the 5 App IDs → **Additional Capabilities** → enable
   **Family Controls (Distribution)**.
2. Regenerate the provisioning profiles for all 5.
3. Now TestFlight + App Store builds carry the entitlement. (Development builds worked the whole
   time.)

✅ **Done when:** all 5 App IDs show Family Controls (Distribution) and profiles are regenerated.

---

## The content docs this runbook uses (all in `docs/apple/`)

- `entitlement-request.md` — justification text + the `[CONFIRM]` blanks
- `privacy-policy-screentime.md` — the privacy section to publish (Step 2)
- `app-store-listing.md` — description, keywords, screenshot shot-list (Step 3)
- `age-rating-answers.md` — the questionnaire answers (Step 3)
- `demo-recording-script.md` — optional demo video (only if App Review asks)
- `filing-plan-research.md` — the sourced evidence behind all of the above

## What's still mine to finish before this is 100% ready

- Fill/verify `app-store-listing.md` + `age-rating-answers.md` against the current app.
- Confirm the screenshot shot-list once the real screens exist.
- (You) fill the 5 values + publish the privacy policy → then the package is execute-ready.
