# Android Screen Time / Blocking — Research + Mechanism Recommendation

Status: 2026-07-10, **partial** (deep-research run hit a session limit mid-verify — 8 claims
confirmed 3-0, ~17 plausible-but-unverified from reputable sources; re-verify after ~4:40pm).
Confidence is marked per finding. This is the Android counterpart to
`docs/apple/filing-plan-research.md` and feeds the #287 Android track.

---

## TL;DR — the mechanism recommendation

**READ usage** → `UsageStatsManager` + the `PACKAGE_USAGE_STATS` "Usage Access" special
permission. Clean, first-class, no accessibility needed. **[confidence: HIGH]**

**BLOCK an app** → detect the foreground app (poll `UsageStatsManager.queryEvents()` from a
foreground service) and draw a full-screen block over it via **`SYSTEM_ALERT_WINDOW`** ("draw over
other apps"). **Avoid `AccessibilityService` as the primary blocker.** **[confidence: MEDIUM-HIGH]**

**Why avoid Accessibility:** it's the single biggest Play reject-magnet for this category, and it's
getting worse — see §2. Google's own rule says use narrower APIs "when possible," and for
self-blocking, the UsageStats + overlay combo _is_ the narrower path. Accessibility gives more
reliable instant foreground detection, but the durability cost isn't worth it for v1.

---

## 1. Reading usage — the easy half (HIGH confidence, all 3-0)

- `UsageStatsManager` (`android.app.usage`): `queryUsageStats()` for aggregated per-app time over
  day/week/month; `queryEvents()` for event-level foreground/background transitions.
- Gated by **`PACKAGE_USAGE_STATS`** — a **special permission**, not a runtime one: the user grants
  it on a dedicated system Settings screen (we deep-link them there), it can't be requested via the
  normal manifest prompt.
- Source: developer.android.com/reference/android/app/usage/UsageStatsManager

## 2. Blocking — the hard half, and the Accessibility trap

**The AccessibilityService crackdown (the core risk):**

- Google Play permits Accessibility **primarily for disability tools** (screen readers, switch/voice
  input, Braille) and **explicitly lists "monitoring apps, automation tools, assistants" as NOT
  qualifying** — an app-blocker falls in the non-qualifying bucket. **[3-0]**
- Non-qualifying apps that use Accessibility must show a **prominent in-app disclosure** (in the app
  itself, during normal use — not the store listing or a website) with **affirmative consent**,
  **and** file a **Play Console declaration + a demo video** at review. **[3-0]**
- `isAccessibilityTool=true` would exempt disclosure — **but only genuine disability tools qualify;
  we don't.** **[3-0]**
- Google policy: **use narrower-scoped APIs instead of Accessibility "when possible."** For us, an
  alternative exists (UsageStats + overlay), so relying on Accessibility is hard to defend. **[2-1]**
- ⚠️ **[UNVERIFIED — session limit, but reputable secondary sources]** Android 17 / "Advanced
  Protection Mode" (2026) reportedly **blocks non-accessibility apps from the Accessibility API
  entirely and auto-revokes it** for AAPM users → an accessibility-based blocker simply **breaks**
  for those users. This is the strongest reason to not build the blocker on Accessibility.
  (TheHackerNews 2026-03, Malwarebytes 2026-03 — re-verify.)

**The overlay path (recommended):**

- `SYSTEM_ALERT_WINDOW` ("draw over other apps") — a special permission — lets us render our calm
  block screen on top of the offending app. Paired with a foreground service polling
  `queryEvents()` to know which app is foregrounded.
- ⚠️ **[UNVERIFIED]** The standard combo devs use for this category is
  `UsageStatsManager + SYSTEM_ALERT_WINDOW + AccessibilityService` together; a self-limiting
  screen-time dev asked Google directly about exactly this combo (Play support thread 319193084).
  We aim to ship **without** the Accessibility leg if the overlay + polling proves reliable enough.
- Trade-off to validate in build: pure UsageStats polling has a short detection lag (the user sees
  a second or two of the blocked app before the overlay appears). Accessibility is instant. For a
  self-regulation (not adversarial-kid) use case, a ~1s lag is acceptable — bias to the durable path.

## 3. Play filing package (partly UNVERIFIED — re-verify after reset)

- **Prominent disclosure** must state **WHY** the capability is needed + the **core purpose**
  (our self-management purpose), shown in-app before requesting each special permission. **[2-0]**
- **Data Safety form** — likely we declare **no data collected** because usage stays on-device and
  is never transmitted (Play defines "collect" as transmitting off-device). **[UNVERIFIED — abstained;
  confirm against answer/10787469 after reset.]** A privacy-policy link is still required regardless.
- **Permissions declaration**: `PACKAGE_USAGE_STATS` and `SYSTEM_ALERT_WINDOW` are policy-sensitive
  special permissions; if we ever add Accessibility we additionally owe the Console declaration +
  demo video.
- **Target API level**: standard current-minus-one requirement (confirm exact level at filing).

## 4. Real-app precedents (UNVERIFIED — reputable but unconfirmed)

- **ScreenZen (Android)** reportedly uses AccessibilityService to block, framed as a "Digital
  Wellbeing Tool" (self-management, not parental). **StayFree**, **ActionDash** read via
  UsageStats. Re-verify the specific mechanism each uses after the limit resets.

## 5. How this maps to our shared architecture

- The **React/Capacitor screens are shared** with iOS; only the native layer differs.
- The single plugin API contract (#286) must cover both: iOS backs `presentPicker`/`showUsageReport`/
  shield with FamilyControls; Android backs the same JS surface with UsageStats + overlay. The
  _semantics_ differ (iOS opaque tokens vs Android real package names on-device) — **key privacy
  note:** on Android we DO see real package names locally (no opaque-token equivalent), so the
  "app names never reach our code" guarantee is iOS-specific; on Android the guarantee is "names
  never leave the device." The shared privacy story must phrase this carefully.

## Open items to close after the session-limit reset (~4:40pm)

1. Re-verify the Android-17 / Advanced Protection Mode accessibility block (load-bearing for the
   mechanism choice).
2. Confirm the Data Safety "no collection for on-device-only" reading.
3. Confirm each named app's actual mechanism (ScreenZen/StayFree/ActionDash).
4. Confirm current target-API-level requirement + whether a demo video is required for
   `SYSTEM_ALERT_WINDOW` alone (vs only for Accessibility).
