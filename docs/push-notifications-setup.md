# Notifications — Setup & Operations

Tier 1 daily check-in reminders (morning + evening) fire from **on-device local
notifications** (`@capacitor/local-notifications`) — scheduled by the OS at the user's
exact local time, offline, with no server. The Firebase/FCM + cron stack is retired for
Tier 1 and kept **dormant** for future Tier 2 server-driven pushes (streak milestones,
re-engagement, etc.).

## How Tier 1 works

```
ReminderSheet / onboarding ──▶ user_preferences (morningTime, nightTime, pushNotifications)
                                         │
rescheduleReminders() ──▶ LocalNotifications.schedule({ on:{hour,minute}, allowWhileIdle })
   triggered on: onboarding complete · pref change · app foreground/resume · permission grant
                                         │
OS fires at local time ──▶ tap → app opens at data.route + writes on-device feed entry
                            (background-fired-but-not-tapped reminders are backfilled on
                             next app open via remindersDueAt + ensureLocalFeedEntry)
```

- **Permission**: requested at onboarding completion (`useOnboarding`) — the default
  `pushNotifications: true` preference only delivers once the OS grant exists.
  `EnablePermissionsPage` is a secondary surface. `rescheduleReminders` no-ops until granted.
- **Timezone**: handled by the OS (device local time) — no server timezone column needed.
- **Exact timing (Android 12+)**: `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` injected by
  `scripts/patch-android-manifest.mjs` (android/ is regenerated each sync); runtime gate via
  `ensureExactAlarmPermission()`. Declining degrades to inexact (Doze ~9 min).
- **In-app feed**: `/notifications` merges the (dormant FCM) server feed with an on-device
  store (`src/lib/notifications/localFeed.ts`), idempotent per (type, local day).

Key files: `src/lib/localReminders.ts`, `src/lib/notifications/localFeed.ts`,
`packages/shared/src/notifications/templates.ts` (copy/ids/channel — single source),
`scripts/patch-android-manifest.mjs`.

## Verify Tier 1 (real device)

1. Finish onboarding → grant the notification permission prompt.
2. ReminderSheet → set morning or night time a few minutes ahead → Save.
3. Background the app; confirm the notification fires at the exact minute (Android: also
   confirm under Doze with the exact-alarm setting on).
4. Tap it → app opens at `/home` (morning) or `/journal` (evening); the entry appears in the
   in-app `/notifications` feed. Airplane mode → still fires (local, no network).
5. Toggle Push off → no fire next day.

## Tier 2 (dormant — server push, not yet shipped)

The FCM path is preserved but unused: `api/_lib/firebase.ts`,
`api/_lib/notification-schedule.ts`, `device_tokens` + `notifications` tables (migration
`049_notifications.sql`), and the `register-token`/`list`/`read` routes in
`api/notifications/[...path].ts`. When Tier 2 is built, this is where dynamic/event-driven
pushes (which the OS can't schedule on-device) will live — and the now-removed Vercel cron +
`PUSH_CRON_ENABLED`/`CRON_SECRET`/`FIREBASE_SERVICE_ACCOUNT` envs + per-user timezone sync
will need to be restored. The one-time Firebase/APNs/Apple-portal setup is only required then.
