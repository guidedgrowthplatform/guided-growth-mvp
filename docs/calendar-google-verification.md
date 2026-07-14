# Google OAuth Verification & Publishing — Calendar Integration

_Last updated: 2026-07-14_

How to take the Google Calendar OAuth app from its current **Testing** state to a
**verified, published** app so any user can connect without the "Google hasn't
verified this app" warning. Companion to [`calendar-integration.md`](./calendar-integration.md).

---

## TL;DR checklist

| #   | Item                                                                          | Owner                                 | Blocks on                     | Status        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------- | ----------------------------- | ------------- |
| 1   | Own + verify a real domain in Google Search Console                           | Team (Yair)                           | —                             | ☐ not started |
| 2   | Privacy Policy hosted on that domain                                          | Yonas (Mint reviews calendar section) | #1                            | ☐             |
| 3   | Terms of Service hosted on that domain                                        | _unassigned_                          | #1                            | ☐             |
| 4   | OAuth consent screen fully configured (name, logo, domains, emails, homepage) | Console owner                         | #1                            | ☐ partial     |
| 5   | Scope justifications written                                                  | _draft below — ready_                 | —                             | ◑ drafted     |
| 6   | Demo video recorded (unlisted YouTube)                                        | _anyone; flow works today_            | #1 (branded domain on camera) | ☐             |
| 7   | Publishing status → In production                                             | Console owner                         | 1–6                           | ☐             |
| 8   | Submit for verification                                                       | Console owner                         | 7                             | ☐             |

**Good news up front:** the calendar scopes are **sensitive, not restricted**, so **no CASA third-party security assessment** is required (that expensive/annual audit is only for restricted scopes like Gmail read). This is a standard verification.

---

## Current state (verified 2026-07-14)

- **Google Cloud project:** `guided-growth-487009`
- **Developer / project owner (shown on the warning screen):** `voidreamer@gmail.com`
- **Publishing status:** **Testing**
- **Client ID (public):** `745354329211-…apps.googleusercontent.com`
- **Requested scopes:** `https://www.googleapis.com/auth/calendar.app.created` + `https://www.googleapis.com/auth/calendar.events`
- **Approved test users:** `jamymarcoss47@gmail.com`, `mintesnotmarkos89@gmail.com`
- **Consent screen base:** non-sensitive `userinfo.email` / `userinfo.profile` / `openid` already configured; the two calendar scopes are added.

Because the app is in Testing with a sensitive scope, only registered test users can consent, and each shows the unverified-app warning. Verification removes both limits.

---

## 1. Domain (the critical path — everything hangs off this)

A `*.vercel.app` subdomain **cannot** be used as the branded/authorized domain for verification — Google requires a domain you can prove you own.

**Do:**

1. Buy the domain (leaning **`guidedgrowthos.com`** — not locked).
2. Verify ownership in **Google Search Console** (DNS TXT record or the registrar/hosting integration), using the same Google account that owns the Cloud project.
3. Point it at the app (Vercel custom domain) so the homepage, privacy policy, and ToS URLs on that domain actually resolve.
4. Add it as an **Authorized domain** on the OAuth consent screen.

Until this exists, items 2–4 and 6 have nowhere legitimate to live. **This is the top blocker.**

---

## 2. Privacy Policy

Must be a **public URL on the verified domain** (not a PDF, not Notion, not vercel.app).

Content Google looks for (especially with a sensitive Calendar scope):

- What data the app accesses (Google Calendar events — read and write) and **why**.
- That access is **only** with the user's explicit consent (they connect from Settings).
- How the data is stored/secured (server-side refresh token; events written to the user's own calendar; no third-party sharing/sale).
- How the user revokes access (Disconnect in-app, or via their Google Account permissions).
- **Limited Use disclosure** — a statement that the app's use of Google user data complies with the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

_Owner: Yonas drafts the single canonical policy (calendar + screen-time); Mint reviews the calendar section. I can draft the calendar section for that review — ask._

---

## 3. Terms of Service

A public URL on the verified domain. Standard ToS; Google wants the link present and reachable. _Needs an owner._

---

## 4. OAuth consent screen configuration

Fill **every** field (Google Cloud Console → APIs & Services → OAuth consent screen / Google Auth Platform → Branding):

- **App name** — the exact user-facing name (e.g. "Guided Growth"). This is what shows on the consent screen.
- **App logo** — square, per the console's stated format/size limits (commonly 120×120px, PNG/JPG/BMP, ≤1 MB — confirm the live requirement). A logo triggers **brand verification** as part of the review.
- **User support email**
- **App homepage** — on the verified domain.
- **Application privacy policy link** — item 2.
- **Application terms of service link** — item 3.
- **Authorized domains** — the verified top-level domain from item 1.
- **Developer contact email**

---

## 5. Scope justifications (drafts — ready to paste)

For each sensitive scope you must state, in the verification form, exactly what the app does with it. Drafts:

**`.../auth/calendar.app.created`** — _"Make secondary Google calendars, and see, create, change, and delete events on them."_

> Guided Growth creates one dedicated secondary calendar named "Guided Growth" (the privacy-preserving default) and writes the user's recurring self-improvement rituals — daily check-ins, an evening reflection, a weekly review, and habit reminders — onto it, so the user's personal calendar stays untouched. This scope is used only for the calendar the app itself creates. Users opt in explicitly from the app's Settings and can disconnect at any time, which deletes those events.

**`.../auth/calendar.events`** — _"View and edit events on all your calendars."_

> When the user chooses to place their rituals on their primary calendar instead of the separate "Guided Growth" calendar, Guided Growth creates/updates/deletes only those recurring ritual events. The app also reads the user's upcoming events so the in-app AI coach can offer timely, context-aware support (for example, acknowledging a busy day). The app never modifies or shares the user's other events; access is granted only after the user explicitly connects their calendar and is revoked on disconnect.

> Note: if the review pushes back on `calendar.events` being broad, the fallback is to drop the "write to primary calendar" option and read-for-context, and rely on `calendar.app.created` alone (dedicated calendar only). That narrows the review surface but removes the "my main calendar" choice and the coach's calendar awareness — a product trade-off, flag to Yair before committing.

---

## 6. Demo video

Google requires a video (unlisted YouTube link) for sensitive-scope verification, in English or subtitled, that shows the OAuth grant and how the data is used. **Shot list:**

1. Open the app on the **branded domain**, signed in (domain visible in the address bar).
2. Go to **Settings → Connect Google Calendar**.
3. **Pause on the Google consent screen** — show the app name, the `client_id`, and the two requested scopes.
4. Grant consent; return to the app.
5. Tap **Sync now**; show the connected state.
6. Open **calendar.google.com** — show the "Guided Growth" calendar and the ritual events that were written.
7. (Optional, demonstrates the read scope) show the coach referencing an upcoming event.
8. Tap **Disconnect**; show the events removed.

Narrate each step and explicitly say how each scope is used. The flow works today, so this is recordable now — but record it on the **branded domain**, since the reviewer checks that the OAuth client, homepage, and video all match the verified domain.

---

## 7–8. Publish & submit

1. Set **Publishing status → In production** (Google Auth Platform → Audience → Publish app).
2. On the verification prompt, attach the scope justifications (item 5) and the demo video (item 6).
3. **Submit for verification.**
4. Respond promptly to any reviewer follow-ups (they often ask for a clarification or a re-recorded video).

---

## Publishing status — what each means

| Status                        | Who can connect                                  | Warning shown?     | Refresh-token life                             |
| ----------------------------- | ------------------------------------------------ | ------------------ | ---------------------------------------------- |
| **Testing**                   | only added test users (≤100)                     | yes ("unverified") | **~7 days** then expires → user must reconnect |
| **In production, unverified** | anyone, but capped (~100 users) with the warning | yes                | normal (long-lived)                            |
| **In production, verified**   | anyone, no cap                                   | **no**             | normal                                         |

> The **7-day test-token expiry** is the reason testing-mode connections silently break after a week. It's also why a founding-cohort interim (below) prefers Production-unverified over Testing.

---

## Interim option (ship before verification clears)

Verification review is **days to weeks**. To not block the founding cohort:

- Publish **In production (unverified)** and onboard up to ~100 founding users now — they see the warning once but get long-lived tokens (no 7-day expiry), and the write-once recurring events persist.
- Run verification in parallel for public launch.

Confirm current user caps in the console before relying on this — Google adjusts the unverified-production limits.

---

## What I (the assistant) can prep vs. what's yours

- **I can draft:** the calendar section of the privacy policy, the scope-justification text (above), and the demo-video script.
- **Yours (needs domain purchase / Google Console / Search Console access):** buying + verifying the domain, uploading the logo, configuring the consent screen, publishing, and submitting.

---

## References

- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- OAuth app verification: https://support.google.com/cloud/answer/13463073
- Unverified apps: https://support.google.com/cloud/answer/7454865
- Brand verification (why you may not see policy links yet): https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
