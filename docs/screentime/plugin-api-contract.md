# Screen Time — Shared Plugin API Contract (#286)

Status: 2026-07-10, draft. The **single JS surface** both native platforms implement and the
shared React screens call. This is the seam between three owners:

- **Native (Yonas):** iOS (FamilyControls/DeviceActivity/ManagedSettings) + Android (UsageStats +
  overlay) implement this contract behind one `ScreenTime` Capacitor plugin.
- **Shared React screens (Yonas):** call only this surface; zero platform branching in UI logic
  beyond `isSupported()`.
- **Design (Timothy):** designs the screens against these states/among these actions.

**Rule:** the JS surface is identical on both platforms. Where platforms differ, the difference is
hidden behind the method (or surfaced as a capability flag), never leaked as two APIs.

---

## Plugin registration

`registerPlugin<ScreenTimePlugin>('ScreenTime')` — iOS class `ScreenTimePlugin`, Android class
`ScreenTimePlugin`. Web + unsupported platforms reject every method with `not implemented` and are
gated out via `isSupported()`.

## Types

```ts
type AuthStatus = 'notDetermined' | 'denied' | 'approved';

// which blocking trigger armed the current shield (extensible)
type BlockTrigger = 'usage_budget' | 'reflection_lock';

interface ScreenTimeStatus {
  supported: boolean; // false on web/unsupported OS version
  platform: 'ios' | 'android' | 'web';
  status: AuthStatus; // OS-level permission state (see auth note)
  hasSelection: boolean; // user has picked ≥1 app/category
  applicationCount: number;
  categoryCount: number;
  budgetCount: number; // # of daily budgets configured
  shieldActive: boolean; // something is currently blocked
  activeTrigger: BlockTrigger | null;
  // capability flags — let the UI adapt without knowing the platform
  capabilities: {
    opaqueAppNames: boolean; // iOS true (tokens), Android false (real names, on-device)
    perHourBreakdown: boolean; // iOS true; Android via queryEvents
    instantBlock: boolean; // iOS true; Android false (~1s overlay lag)
    nativeReportUI: boolean; // iOS true (DeviceActivityReport); Android false (we render usage)
  };
}

interface PickerResult {
  cancelled: boolean;
  applicationCount: number;
  categoryCount: number;
  webDomainCount: number;
}
```

## Methods

| Method                                  | Purpose                                         | iOS backing                               | Android backing                            |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `isSupported()` → `{supported}`         | OS-version gate                                 | iOS ≥16                                   | usage-access available                     |
| `getStatus()` → `ScreenTimeStatus`      | one call drives the whole UI; **never rejects** | AuthorizationCenter + App Group           | permission checks + prefs                  |
| `requestAuthorization()` → `{status}`   | grant prompt                                    | `.individual` Face ID                     | deep-link Usage Access + overlay grants    |
| `presentPicker()` → `PickerResult`      | choose apps                                     | `FamilyActivityPicker`                    | our on-device app list picker              |
| `showUsageReport()` → `void`            | see my usage                                    | native `DeviceActivityReport` full-screen | **N/A** — React renders from `getUsage()`  |
| `getUsage(range)` → usage rows          | usage data for our own UI                       | N/A (iOS uses native report)              | `UsageStatsManager.queryUsageStats/Events` |
| `setBudgets(budgets)` → `{budgetCount}` | set daily limits                                | store to App Group + arm Monitor          | store to prefs + arm service               |
| `applyShield(opts)` → `void`            | block now (trigger-tagged)                      | `ManagedSettingsStore.shield`             | overlay service arm                        |
| `clearShield()` → `void`                | lift block                                      | `clearAllSettings()`                      | overlay service disarm                     |
| `disable()` → `void`                    | turn feature fully off                          | clear shield + selection + monitoring     | same                                       |

**`applyShield(opts)`** takes `{ trigger: BlockTrigger, reasonTitle: string, reasonSubtitle: string }`
so the SAME shield mechanism serves both v1 features:

- `trigger: 'usage_budget'` — armed by the Monitor/service when a daily budget is hit.
- `trigger: 'reflection_lock'` — armed when the user skips their daily check-in; cleared when the
  check-in completes. (Yair's "blocking" feature. Which trigger ships in v1 first is TBD — pending
  his answer — but the contract supports both from day one.)

## Auth-status nuance (platforms differ, surface unifies)

- iOS: a single `.individual` authorization covers read + block.
- Android: read (Usage Access) and block (`SYSTEM_ALERT_WINDOW` overlay) are **separate** system
  grants. `getStatus().status` reports the _aggregate_ (`approved` only when all required grants are
  held); `requestAuthorization()` walks the user through each missing grant in turn. The UI treats
  it as one "are we authorized?" question.

## Privacy semantics — the one real cross-platform difference

- **iOS:** the picker returns **opaque tokens**; our code never sees app names. Guarantee = "app
  names never reach our code."
- **Android:** `UsageStatsManager` returns **real package names**; there is no opaque-token
  equivalent. Guarantee = "app names never _leave the device_" (we see them locally to render the
  list, but never transmit them).
- **The shared privacy policy must state both correctly** — do NOT claim "we never see app names"
  globally; that's iOS-only. See the shared privacy story (#286) + `capabilities.opaqueAppNames`.

## The 5 hard rules bind BOTH platforms

Never brick the phone · names never leave the device · usage never leaves the device · never a bare
block (always a reason string) · never strand a locked phone (fail-safe auto-lift). Each native impl
must satisfy all five; the shield-reason strings live in shared copy so they change without a native
rebuild.

## For Timothy (design seam)

The screens to design map 1:1 to these states from `getStatus()`:

1. **Not supported** (web/old OS) — calm explainer.
2. **Not authorized** — intro + "Get started" (→ `requestAuthorization` → `presentPicker`).
3. **Authorized, no selection** — "Choose your apps."
4. **Authorized, active** — usage summary + limits + "Take a break"/"End break" + "Turn off."
5. **Block screen** — the shield (calm, green, reason-stated) — iOS native + Android overlay, same copy.
   Design against these 5 states + the action set above; the contract guarantees they exist on both
   platforms.
