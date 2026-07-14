# Guided Growth — Privacy Policy (canonical, single source)

Status: draft 2026-07-13. **The single privacy policy Yonas owns** (Yair, call 2026-07-10),
covering both the Screen Time feature and Google Calendar. Publish this at a public URL and link
it from App Store Connect + the Family Controls entitlement request.
**[CONFIRM: published privacy-policy URL]** · **[CONFIRM: "Last updated" date on publish]**

- Screen Time section: authored by Yonas (this lane), verified against Apple's on-device model.
- Google Calendar section: folded in from Mint's verified input (`gg-spec/docs/calendar-filing/
01-privacy-policy-section.md`, aligned to shipped code MR !537). Mint reviews the calendar side.

These slot into Guided Growth's broader privacy policy as their own sections.

---

## Screen Time & Focus Features (iOS)

Guided Growth offers an optional Screen Time feature that helps you understand and manage your own
app usage. It is built on Apple's Screen Time API and is designed so that your detailed usage data
never leaves your device.

**Opt-in only.** The feature does nothing until you turn it on. Enabling it requires your explicit
authorization through an Apple system prompt (Face ID / passcode). You are managing your own device
— there is no parental control, no pairing with another person, and no remote management.

**You choose the apps.** You select which apps to track or limit through Apple's own app picker.
Apple's design returns these selections to us as opaque tokens: **Guided Growth never learns the
names of the apps you select.** App names and icons you see on screen are rendered by the operating
system, not by our code, and are never available to us or our servers.

**Usage data stays on your device.** Your app-usage details — which apps, how long, at what times —
are displayed by a sandboxed Apple extension that has no network access. This data is processed and
shown entirely on your device. It is **not transmitted to Guided Growth's servers or to any third
party**, and we could not access it even if we wanted to; Apple's architecture prevents it. In the
current version, the Screen Time feature sends **no data of any kind** to our backend.

**Time limits and blocking.** If you set a daily time budget on an app, your device — not our
servers — enforces it: iOS shields the app when your budget is reached, and the shield lifts at your
daily reset. Your budgets and selections are stored locally on your device.

**Your control.** You can change your selected apps, adjust or remove any time budget, or disable
the Screen Time feature entirely at any time in the app's Settings. Disabling it immediately removes
all shields and stops all monitoring. You can also revoke Guided Growth's Screen Time authorization
at any time in iOS Settings.

**No advertising or profiling.** We do not use any Screen Time information for advertising,
tracking, or profiling. Our iOS privacy manifest declares no tracking.

---

## Google Calendar

**What we access.** If you connect Google Calendar, Guided Growth (a) creates a dedicated "Guided
Growth" calendar and adds your rituals — check-ins, reflections, habit reminders, The Weekly — to
it; (b) with your choice, adds those events to your own calendar instead; and (c) reads your
upcoming events so your coach can offer timely, relevant support.

**Why.** So your Guided Growth routine lives in the calendar you already use and syncs across
devices, and so the coach can reference what's actually on your day.

**What we store.** Encrypted-at-rest access and refresh tokens tied to your account; the identifiers
of the Guided Growth calendar and the events we create. We do not store the contents of your other
events beyond what is needed to provide in-app coaching context in the moment.

**What we do NOT do.** We do not share calendar data with third parties, use it for advertising, or
link it to your anonymized coaching data.

**Your control.** Disconnect any time in Settings — we remove the events we created and delete
stored tokens. You can also revoke access from your Google Account.

**Retention.** Tokens and event identifiers retained only while connected; disconnecting deletes
them.

**Google API Services User Data Policy.** Our use and transfer of information received from Google
APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.
