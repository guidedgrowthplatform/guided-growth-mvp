# Screen Time — Framing Law & Hard Rules (#286, shared)

Status: 2026-07-10. Platform-neutral. **Both** the Apple filing (`docs/apple/`) and the Play filing
(`docs/android/`) consume this — do not restate it per-platform, reference it. If this and a
platform doc ever disagree, this wins for the _framing/rules_; the platform doc wins for
_mechanism_.

---

## The Framing Law (governs every string, every surface, every filing)

**This is digital wellbeing / screen-time self-management. It is NEVER "parental controls."**

- The user regulates **their own device** — iOS `FamilyControls .individual`; Android the account
  holder on their own phone. No parent, no child, no pairing, no remote management.
- The user **chooses** the apps, **sets** the limits, and can **turn the whole thing off** in
  Settings at any time.
- Internally we may say "parental controls" as shorthand for the underlying OS tech (it's the same
  toolkit). **That word must appear nowhere** the user or a store reviewer can see it — not in the
  app, the listing, the privacy policy, the entitlement request, or the Play declaration.
- Both platforms' top-level docs _default_ to the parental-controls framing, so we are actively
  steering the other way. This is the **single biggest lever** on both approvals.

Lead every surface with: **"your own apps, your own limits, your own device."**

## The 5 Hard Rules (acceptance gates on BOTH platforms)

Each native implementation must satisfy all five; a violation is a store-rejection magnet.

1. **Never brick the phone.** Shield only the user's selected apps/categories. Phone, Messages, and
   emergency functions always work. "Unusable until you comply" = rejection.
2. **App names never leave the device.** (Platform nuance below.) Nothing about which apps the user
   picked is transmitted to our backend or any third party.
3. **Detailed usage never leaves the device.** Per-app minutes are shown on-device and stop there.
   v1 sends **nothing** to the backend.
4. **Never a bare block.** The block screen always states the reason ("You've reached your 30-minute
   limit on this app today"). Calm and green in tone, never red or punitive.
5. **Never strand a locked phone.** A crash or bug must never leave apps locked with no way out.
   Fail-safe from day one: auto-lift after a max window, lift on feature-disable, lift on repeated
   foreground with no legitimate trigger.

## Rule 2 — the one true cross-platform difference (read carefully)

The _guarantee wording_ differs because the OS APIs differ:

- **iOS:** the picker returns **opaque tokens**; our code literally never receives app names. The
  OS renders names/icons on screen. Guarantee = **"app names never reach our code."**
- **Android:** `UsageStatsManager` returns **real package names**; there is no opaque-token
  equivalent. We see them **locally** to render the list and enforce limits, but never transmit
  them. Guarantee = **"app names never leave your device."**

Any shared copy (privacy policy, listing) must use the correct claim per platform, or scope to the
weaker-but-always-true **"never leave your device."** Never claim "we never see your app names"
globally — that is iOS-only and false on Android.

## Two v1 features, one shield stack

Both are approved and parallel (Yair, 2026-07-10); both reuse the exact same native shield:

- **Screen time** = usage tracking (+ optional usage-budget block).
- **Blocking (reflection-lock)** = skip the daily check-in → most apps shielded until the check-in
  is done.

The shield is triggered via `applyShield({trigger})` (see `plugin-api-contract.md`). Which trigger
ships first in v1 is **[CONFIRM: pending Yair]** — but design/copy/filings cover both.

## Where the platform specifics live

- Apple entitlement filing + iOS mechanism → `docs/apple/`
- Play filing + Android mechanism (UsageStats + overlay, avoid Accessibility) → `docs/android/`
- Shared privacy story, listing copy, rating answers, demo skeleton → `docs/screentime/` (this dir)
- The one JS surface both implement → `docs/screentime/plugin-api-contract.md`
