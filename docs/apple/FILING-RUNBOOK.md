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

## STEP 2 — Publish the privacy policy _(~15 min)_

The entitlement form and the listing both need a **live public URL** that describes on-device
handling.

1. Take the ready text from **`privacy-policy-screentime.md`** (this folder).
2. Add it as a **"Screen Time & Focus"** section to Guided Growth's existing privacy policy page
   (wherever the current policy lives — likely the marketing site or a `/privacy` route).
3. Publish so it's reachable at a public URL. **Copy that URL → it becomes value #5.**

✅ **Done when:** the Screen Time privacy section is live and loads at a public URL.

---

## STEP 3 — Complete the App Store Connect listing + age rating _(Account Holder / Admin · ~30 min)_

**Page:** appstoreconnect.apple.com → your app → **App Information** + the version page.

1. **Category:** Productivity (primary). _(Matches every approved peer — Opal/Jomo/ScreenZen.)_
2. **Description:** paste the feature copy from **`app-store-listing.md`** — must foreground
   "see and manage your **own** app usage / set your **own** limits." (Guideline 2.5.1: the listing
   must reflect the Screen Time function.)
3. **Promotional text / keywords:** from `app-store-listing.md`.
4. **Screenshots:** capture the shots in the `app-store-listing.md` shot-list once the UI exists.
5. **Age rating:** open the questionnaire and answer exactly per **`age-rating-answers.md`**.
6. **Privacy policy URL field:** paste value #5.
7. ⚠️ **Do NOT** put the Screen Time feature behind a "pay to unlock blocking" wall framed as
   selling the API — keep it inside the normal subscription (Guideline **4.10**: no monetizing
   Screen Time APIs).

✅ **Done when:** description, keywords, age rating, and privacy URL are saved on the listing.

---

## STEP 4 — File the entitlement request _(Account Holder · ~15 min · THE key step)_

**Page:** **developer.apple.com/contact/request/family-controls-distribution**
(linked from the `com.apple.developer.family-controls` capability docs). Sign in as **Account
Holder**.

1. Fill the app info; in the justification field paste the **Justification text** from
   **`entitlement-request.md`** (with your `[CONFIRM]` blanks filled).
2. **Name all 5 bundle IDs in this one submission** (the table in Step 1). This is the #1 gotcha:
   an extension needs its own grant, and filing them late costs extra weeks. **All five, same day.**
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
