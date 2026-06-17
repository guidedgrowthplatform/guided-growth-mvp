# Push Notifications — Setup & Operations

Tier 1 push (morning + evening check-in reminders) is fully implemented in code.
This doc covers (a) how the system works, (b) the one-time account setup only a
human can do, and (c) verification + troubleshooting.

**Rollout is self-sequencing:** until `assets/firebase/GoogleService-Info.plist`
is committed, iOS builds skip ALL push signing config (`scripts/patch-ios-push.mjs`
exits early), so releases keep working exactly as today. Same on Android: the
gradle plugin only activates when `android/app/google-services.json` exists.
Nothing breaks if setup happens later — push just stays off.

## How it works

```
EnablePermissionsPage ──grant──▶ FCM token ──POST /api/notifications/register-token──▶ device_tokens
Settings/ReminderSheet ──▶ user_preferences (morning_time, night_time, push_notifications, timezone)

Vercel cron (*/15 min) ──▶ GET /api/notifications/cron
  1. load prefs for users with push ON + a timezone + ≥1 device token
  2. computeDue(): is the user's local clock within 60 min past their set time?
     (wide window because Vercel cron is best-effort; midnight wrap handled)
  3. INSERT notification ON CONFLICT (anon_id, type, local_date) DO NOTHING
     → unique index = exactly one per user/type/local day, ever
  4. send all unsent rows (< 1 h old) via FCM; mark sent_at; prune dead tokens
     → unsent rows double as the retry path for transient FCM failures

Phone shows push ──tap──▶ app opens at data.route ──▶ in-app feed at /notifications
                                                       (reads the same notifications table)
```

Key files: `api/notifications/[...path].ts` (routes + cron), `api/_lib/notification-schedule.ts`
(due-window math, unit-tested), `api/_lib/firebase.ts` (FCM send), `src/lib/push.ts` +
`src/hooks/usePushRegistration.ts` (client registration), `supabase/migrations/049_notifications.sql`.

## One-time setup checklist

### 1. Firebase (console.firebase.google.com)

A Firebase project already exists — CI uses it for Android App Distribution
(`FIREBASE_APP_ID` / `FIREBASE_SERVICE_ACCOUNT_JSON` secrets). Reuse it.

- [ ] **Android apps**: verify/add apps for `app.guidedgrowth.mvp` AND `app.guidedgrowth.staging`. Download the single combined `google-services.json` (it lists both apps) → commit at `android/app/google-services.json`. Not a secret — it ships inside the APK.
- [ ] **iOS apps**: add apps for the same two bundle ids. Download the `app.guidedgrowth.mvp` plist → commit at `assets/firebase/GoogleService-Info.plist`. The build script copies it into the regenerated Xcode project. (QA iOS flavor reuses this plist for now — Firebase logs a bundle-id warning but tokens still issue; add a per-flavor plist if QA push testing matters.)
- [ ] **APNs key**: Apple Developer → Keys → create an APNs Auth Key (.p8). Upload in Firebase → Project Settings → Cloud Messaging → Apple app configuration (needs key ID + Team ID).
- [ ] **Service account for sending**: Project Settings → Service accounts → Generate new private key — or reuse the existing `FIREBASE_SERVICE_ACCOUNT_JSON` CI secret if that account has the `Firebase Cloud Messaging API Admin` role.

### 2. Apple Developer portal

- [ ] Identifiers → enable **Push Notifications** capability on `app.guidedgrowth.mvp` and `app.guidedgrowth.staging`.
- [ ] Regenerate match profiles so they embed the capability: `bundle exec fastlane match appstore --force`.
- [ ] Order matters: do this **before** committing the iOS plist — committing the plist is what turns on the entitlement in CI builds, and signing fails if the profile lacks the capability.

### 3. Vercel environment variables (production project ONLY)

| Variable                   | Value                          | Notes                                                                                                                                   |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT` | service-account JSON, one line | sender credentials                                                                                                                      |
| `CRON_SECRET`              | long random string             | Vercel auto-sends it as the cron Bearer token                                                                                           |
| `PUSH_CRON_ENABLED`        | `true`                         | **never set on the QA project** — QA shares the prod DB; an enabled QA cron would consume the once-per-day send slot without delivering |

### 4. Database migration

- [ ] `supabase/migrations/049_notifications.sql` (`device_tokens` + `notifications`) — run via `npm run db:push` after approval.

## Verify end-to-end

1. TestFlight/internal build → log in → Enable Permissions screen → allow notifications.
2. Confirm a row in `device_tokens`.
3. Settings → Reminders → set morning or night time to a few minutes from now.
4. Wait for the cron (≤15 min) or `curl -H "Authorization: Bearer $CRON_SECRET" https://<prod>/api/notifications/cron` — response reports `{ due, inserted, sent }`.
5. Push lands on the lock screen; tapping opens the app at the target screen; the same notification appears in the in-app feed.

## Troubleshooting

- **Cron returns `{skipped: true}`** — `PUSH_CRON_ENABLED` isn't `true` or `FIREBASE_SERVICE_ACCOUNT` is missing/invalid.
- **`due: 0` but you expected a send** — user needs `push_notifications = true`, a non-null valid `timezone` (synced automatically on app start), AND at least one device token. Check all three.
- **`inserted: 0, sent: 0` on retry** — already sent today for that type; the unique index `(anon_id, type, local_date)` is doing its job. Reset by deleting today's row.
- **iOS build has no push** — `assets/firebase/GoogleService-Info.plist` not committed (the patch script logs `skipping entitlements`), or the Apple capability/match step was skipped.
- **iOS codesign failure after committing the plist** — match profile predates the capability; re-run the match regeneration step.
- **Android token fetch fails** — `android/app/google-services.json` missing (gradle logs `google-services plugin not applied`).
- **User stops receiving pushes** — token was pruned after FCM reported it unregistered (app uninstall/reinstall); next app launch silently re-registers.

## Local development

- The cron handler runs under `vercel dev` — set all three env vars (real service-account JSON; the handler returns `{skipped: true}` without it) and curl the endpoint.
- iOS simulator cannot receive APNs pushes; use a real device via TestFlight. Android emulators with Play services work.
