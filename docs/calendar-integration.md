# Google Calendar Integration — Engineering & Ops Reference

_Last updated: 2026-07-14_

The app connects a user's Google Calendar so it can **(a) write** their Guided
Growth rituals (check-ins, reflections, The Weekly, habit reminders) as
recurring events, and **(b) read** their upcoming events to give the coach
context. OAuth is **direct to Google** — deliberately decoupled from the
Supabase login session.

---

## Demo

📹 **Loom walkthrough:** https://www.loom.com/share/3db2fdcc09fe4b6db1788b466fc72efa

---

## Table of contents

1. [What the user gets](#what-the-user-gets)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Connect flow (OAuth)](#connect-flow-oauth)
4. [Token lifecycle](#token-lifecycle)
5. [Sync — writing rituals to the calendar](#sync--writing-rituals-to-the-calendar)
6. [Destination picker](#destination-picker)
7. [Read-for-context](#read-for-context)
8. [Disconnect & cleanup](#disconnect--cleanup)
9. [API reference](#api-reference)
10. [Database schema](#database-schema)
11. [Environment variables](#environment-variables)
12. [Testing (gg-qa)](#testing-gg-qa)
13. [Google OAuth verification & publishing](#google-oauth-verification--publishing)
14. [Operational notes / gotchas](#operational-notes--gotchas)
15. [Known follow-ups](#known-follow-ups)
16. [Code map](#code-map)

---

## What the user gets

- **Connect** Google Calendar from Settings — a dedicated consent flow, not folded into login.
- Rituals appear as **recurring events** in Google Calendar.
- A **destination choice**: a separate app-created "Guided Growth" calendar (default, keeps their own calendar private) or their **main calendar**.
- A **pause** toggle: stop writing new rituals without disconnecting (keeps the token).
- The coach can **read** upcoming events to offer timely, context-aware support.

---

## Architecture at a glance

**Three server-only tables** (RLS deny-all; reached only through the service-role `api/` pool):

| Table                  | Purpose                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `calendar_connections` | one row per connected user — refresh token, cached access token, target, on/off, the created GG calendar id      |
| `calendar_event_map`   | idempotency map — one Google event per `(user, ritual_type, calendar)` so re-sync PATCHes instead of duplicating |
| `calendar_oauth_state` | single-use OAuth nonces (the `state` param), 10-min TTL                                                          |

**Three flows:**

1. **Connect** — `oauth-start` → Google consent → `oauth-callback` stores the refresh token.
2. **Write** — `sync` reconciles the user's rituals into their chosen calendar (idempotent).
3. **Read** — the coach reads today's primary-calendar events for context; a QA panel reads the next 7 days.

The Google **refresh token never reaches the client** — it lives in `calendar_connections`, which grants nothing to `anon`/`authenticated`.

---

## Connect flow (OAuth)

1. **Start** — `POST /api/calendar/oauth-start` (authenticated). Mints a random single-use **nonce**, stores it in `calendar_oauth_state` bound to the user's `anon_id`, and returns a Google consent URL:
   - scopes: `calendar.app.created` + `calendar.events`
   - `access_type=offline` + `prompt=consent` → guarantees a refresh token on every grant
   - `redirect_uri` = `${CALENDAR_OAUTH_REDIRECT_ORIGIN}/api/calendar/oauth-callback` (must be pre-registered in the Google console — no wildcards)
2. **Consent** — the browser navigates to Google; the user grants the two scopes.
3. **Callback** — Google redirects to `GET /api/calendar/oauth-callback` (public, no auth header). It:
   - atomically consumes the nonce (`DELETE … RETURNING`; missing/expired/reused → error redirect),
   - exchanges the `code` for tokens,
   - checks a refresh token is present and both scopes were granted,
   - stores the grant in `calendar_connections` (revoking any superseded token),
   - **302-redirects** back to the app: web → `${origin}/settings?calendar=connected|error`; native → `${scheme}://auth/calendar-connected?calendar=…`.

> **Why the callback is a top-level GET (and the SW bug we fixed):** the callback is a full-page navigation from Google. The PWA service worker's SPA `navigateFallback` was serving `index.html` for it, so the function never ran and the token never persisted. Fixed by adding `/^\/api\//` to `navigateFallbackDenylist` in `vite.config.ts`. `oauth-start` was unaffected because it's a `fetch`, not a navigation.

---

## Token lifecycle

- **Access token** is short-lived and cached in `calendar_connections.access_token` / `token_expires_at`. `getValidAccessToken(anonId)` returns the cached one if still valid (minus a 60s skew), else refreshes via `refreshAccessToken` and persists the new token (and any rotated refresh token).
- **Refresh failure** — if Google returns `invalid_grant`, the code throws `CalendarReauthRequiredError`; the API surfaces `401 {error:'reauth_required'}` and the UI flips to a "reconnect" state (`needsReauth`).
- **Revoke** — on disconnect (and on reconnect, for the superseded token) the app best-effort revokes the grant at Google.

---

## Sync — writing rituals to the calendar

`POST /api/calendar/sync` → `runSync(anonId)` → `runSyncInner`.

**Rituals written** (`buildDesiredRituals`, one event each; `ritual_type` in `calendar_event_map`):

| `ritual_type`        | Source                    | Notes                                                                                                     |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `morning_checkin`    | user prefs (morning time) | daily                                                                                                     |
| `evening_checkin`    | user prefs (night time)   | daily                                                                                                     |
| `evening_reflection` | reflection settings       | daily                                                                                                     |
| `weekly`             | reflection settings       | **only when `weekly_day` was actually chosen** (NULL = never); DTSTART aligned to that weekday            |
| `h:<habitId>`        | each active habit         | RRULE from the habit's schedule days; `h:` prefix (not `habit:`) to fit `VARCHAR(40)` with a 36-char UUID |

**Target routing:** `target='own'` → writes to the `primary` calendar. `target='gg'` → writes to `calendar_connections.gg_calendar_id`, creating the "Guided Growth" calendar on first write (`ensureGgCalendar`).

**Idempotent reconciliation:** builds the desired set, compares to `calendar_event_map`, then **inserts** new events, **PATCHes** changed ones (RRULE drift), and **reaps** (deletes) events for rituals that no longer exist. A PATCH that 404/410s self-heals by re-inserting.

**Concurrency guards** (avoid duplicate events / duplicate GG calendars):

- module-level `inFlight` Set — same serverless instance,
- `pg_try_advisory_lock(hashtextextended(anon_id, 0))` — across instances.
- If either is held, sync returns `{ written: 0, deleted: 0, skipped: true }`.

**Error tolerance:** per-ritual `try/catch` skips a ritual on a non-auth Google error and continues; auth errors (401/403) rethrow so the whole sync surfaces `reauth_required`. DB blips during map writes are swallowed by `safeDbWrite` so they don't abort the whole run.

Returns `{ ok: true, written, deleted, skipped? }`.

---

## Destination picker

The Settings "Where should we add events?" control sets `calendar_connections.target`:

| Option                                     | `target` | Behaviour                                                                                                                                                                                             |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A "Guided Growth" calendar** _(default)_ | `gg`     | App creates a separate calendar named _Guided Growth_ and writes rituals there. The user's own calendar stays untouched; they can hide/remove all app events by toggling that one calendar in Google. |
| **My main calendar**                       | `own`    | Rituals are written directly onto the user's `primary` calendar, alongside their real events.                                                                                                         |

Switching target re-materializes the events on the other calendar.

---

## Read-for-context

- **Coach context** — `readTodaysEvents(anonId, tz)` reads _today's_ events from the user's `primary` calendar. It is bounded to ~1s, warm-instance cached (60s), negative-cached for non-connected users (2min), and **never throws** (returns `[]` on any non-happy path) so it can't stall an LLM turn.
- **QA/demo read** — `GET /api/calendar/upcoming?tz=` → `listUpcomingForDisplay` returns the next 7 days from `primary` (`{ start, allDay, summary }[]`, summaries sanitized). Rendered as the "Your upcoming events" panel on `/qa/calendar`.

---

## Disconnect & cleanup

On **`POST /api/calendar/disconnect`**, in order:

1. **Delete every app-created event** — reads `calendar_event_map`, deletes each event at Google (works for both the GG calendar and the primary calendar). Best-effort via `Promise.allSettled`.
2. **Delete `calendar_event_map` rows** for the user.
3. **Delete the `calendar_connections` row** — removes the stored refresh token.
4. **Clear** in-memory caches.
5. **Revoke** the Google OAuth grant (best-effort, fire-and-forget).

### Two known gaps (documented on purpose)

- ⚠️ **The empty "Guided Growth" calendar shell is NOT deleted.** Its events are removed, but the calendar itself remains in the user's Google account. There is no `calendars.delete` anywhere.
- ⚠️ **A failed event-delete orphans that event.** Step 2 drops **all** map rows unconditionally, even if a delete in step 1 failed (Google error / network blip). That event then lingers on Google with no record to retry from.

> If "everything gone on disconnect" becomes a hard requirement: (a) delete the empty GG calendar after clearing its events, and (b) only drop `calendar_event_map` rows whose delete returned success, so failures can be retried on a later disconnect/sweep.

---

## API reference

All routes are under `/api/calendar`. Except `oauth-callback`, all require a valid session (`requireUser`); unauthenticated calls get `401`.

| Method & path         | Auth                                      | Body / query                          | Success                                         | Errors                                                                   |
| --------------------- | ----------------------------------------- | ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /oauth-start`   | session                                   | `{platform:'web'\|'native', scheme?}` | `200 {url}`                                     | `400` bad platform/scheme, `401`                                         |
| `GET /oauth-callback` | **public**                                | `?state&code&error`                   | `302` → app (`?calendar=connected\|error`)      | always redirects; never JSON                                             |
| `GET /status`         | session                                   | —                                     | `200 {connected, target, enabled, needsReauth}` | —                                                                        |
| `POST /sync`          | session                                   | —                                     | `200 {ok, written, deleted, skipped?}`          | `409 not_connected\|disabled`, `401 reauth_required`, `502 google_error` |
| `GET /upcoming`       | session                                   | `?tz=` (IANA; invalid → UTC)          | `200 {ok, events:[{start, allDay, summary}]}`   | `409`, `401`, `502`                                                      |
| `POST /target`        | session                                   | `{target:'own'\|'gg'}`                | `200 {ok}`                                      | `400`, `404 not connected`                                               |
| `POST /toggle`        | session                                   | `{enabled:boolean}`                   | `200 {ok}`                                      | `400`, `404 not connected`                                               |
| `POST /disconnect`    | session                                   | —                                     | `200 {ok}`                                      | —                                                                        |
| `POST /test`          | session + `x-qa-token` (`QA_RESET_TOKEN`) | —                                     | `200 {ok, calendarCount}`                       | `403 forbidden`, `409`, `401`, `502`                                     |

**Error `code` meanings:** `reauth_required` = refresh token dead, user must reconnect. `not_connected` = no connection row. `disabled` = paused (`enabled=false`). `google_error` = non-2xx from Google.

`oauth-start` / `oauth-callback` are **single-segment route files** (`api/calendar/oauth-start.ts`, `oauth-callback.ts`) because Vercel won't route 2-segment paths into the `[...path].ts` catch-all.

---

## Database schema

**`calendar_connections`** (056) — one row per connected user:

| Column                    | Type             | Notes                                                 |
| ------------------------- | ---------------- | ----------------------------------------------------- |
| `anon_id`                 | UUID PK          | FK → `profiles(anon_id)` ON DELETE CASCADE            |
| `provider`                | VARCHAR(20)      | default `'google'`                                    |
| `access_token`            | TEXT             | short-lived; refreshed on demand                      |
| `refresh_token`           | TEXT NOT NULL    | long-lived Google refresh token                       |
| `token_expires_at`        | TIMESTAMPTZ      | access-token expiry                                   |
| `target`                  | VARCHAR(10)      | `CHECK ('own','gg')`, default `'gg'`                  |
| `gg_calendar_id`          | TEXT             | id of the created GG calendar; NULL until first write |
| `scopes`                  | TEXT             | space-delimited granted scopes (audit/repair)         |
| `enabled`                 | BOOLEAN NOT NULL | master switch; keeps token when off                   |
| `created_at`/`updated_at` | TIMESTAMPTZ      |                                                       |

**`calendar_event_map`** (056) — idempotency map, PK `(anon_id, ritual_type, calendar_id)`:

| Column            | Type        | Notes                                                                                |
| ----------------- | ----------- | ------------------------------------------------------------------------------------ |
| `anon_id`         | UUID        | FK → `profiles(anon_id)` ON DELETE CASCADE                                           |
| `ritual_type`     | VARCHAR(40) | `morning_checkin` / `evening_checkin` / `evening_reflection` / `weekly` / `h:<uuid>` |
| `calendar_id`     | TEXT        | Google calendar the event lives on                                                   |
| `google_event_id` | TEXT        | for patch/delete                                                                     |
| `rrule`           | TEXT        | last RRULE written (drift detection)                                                 |

**`calendar_oauth_state`** (057) — single-use nonces, PK `nonce`:

| Column       | Type        | Notes                                      |
| ------------ | ----------- | ------------------------------------------ |
| `nonce`      | TEXT PK     | the OAuth `state` param                    |
| `anon_id`    | UUID        | FK → `profiles(anon_id)` ON DELETE CASCADE |
| `platform`   | VARCHAR(10) | `CHECK ('web','native')`                   |
| `scheme`     | VARCHAR(20) | native return scheme only                  |
| `created_at` | TIMESTAMPTZ | 10-min TTL on consume; >1h swept on create |

All three: `ENABLE ROW LEVEL SECURITY` with **no** anon/authenticated policy + explicit `REVOKE` — reachable only by `service_role`.

---

## Environment variables (gg-qa)

| Var                              | Purpose                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`               | OAuth client id (must match the client that mints the consent token)                                                                    |
| `GOOGLE_CLIENT_SECRET`           | OAuth client secret (must pair with the id, or the code exchange fails `invalid_client`)                                                |
| `CALENDAR_OAUTH_REDIRECT_ORIGIN` | e.g. `https://gg-qa-iota.vercel.app`; `${this}/api/calendar/oauth-callback` **must** be a registered redirect URI in the Google console |
| `VITE_QA_SCREEN_ENABLED`         | gates `/qa/calendar`, the "Calendar Sync (QA)" shortcut, and the red QA button                                                          |
| `QA_RESET_TOKEN`                 | secret for the gated `POST /test` route (`x-qa-token`)                                                                                  |

---

## Testing (gg-qa)

**0. Hard-refresh first.** Open `gg-qa-iota.vercel.app` and `Cmd+Shift+R` (or close all gg-qa tabs and reopen). The PWA service worker caches the previous build, so the first visit after a deploy serves stale code.

1. Sign Chrome into an **approved Google test account**: `jamymarcoss47@gmail.com` or `mintesnotmarkos89@gmail.com`. (Testing mode → only registered test users can consent.)
2. Tap the red **↺ QA** button → **QA Control**.
3. Pick a **test user** → tap **Calendar Sync (QA)** (signs you in and opens `/qa/calendar`).
4. Tap **Connect** → choose the Google account → **Continue** past "Google hasn't verified this app" → tick **Select all** (both scopes) → **Continue**.
5. Verify: `connected: true` / `enabled: true`; **Sync now** writes events (check calendar.google.com for the _Guided Growth_ calendar); the **"Your upcoming events"** panel lists real events; **Disconnect** removes them (see the two cleanup gaps above).

**Failure decoder:** stale/old UI → step 0 didn't take. "Access blocked / 403" → the Google account isn't a test user. Connects but sync errors → capture the exact message.

---

## Google OAuth verification & publishing

**Goal:** remove the "Google hasn't verified this app" warning and open connect to any user (not just test users).

**Current state:** project `guided-growth-487009`, publishing status = **Testing**. Scopes: `calendar.app.created` + `calendar.events`. `calendar.events` is a **sensitive** scope → verification is required before general availability. Calendar scopes are _sensitive_, **not _restricted_** — so **no CASA security assessment** is required (that only applies to restricted scopes like Gmail read).

**Steps:**

1. **Fully configure the OAuth consent screen** — app name, user support email, **app logo**, homepage URL, **authorized domain(s)**, developer contact email.
2. **Own & verify a real domain** in Google Search Console. The authorized domain must be one you can prove you own — a `*.vercel.app` subdomain won't work as the branded domain. (Tentative: `guidedgrowthos.com`.)
3. **Publish a Privacy Policy** at a public URL on that domain. _(Yonas owns the single canonical policy covering calendar + screen-time; Mint reviews the calendar section.)_
4. **Publish Terms of Service** at a public URL on that domain.
5. **Add scope justifications** — for each sensitive scope, state what the app does with it (write rituals to the user's calendar; read upcoming events for coach context).
6. **Record a demo video** (unlisted YouTube) showing the consent screen with the `client_id` visible, the requested scopes, and the app using the granted access. Plan for this — Google generally requires it for sensitive-scope verification.
7. **Set publishing status → "In production."**
8. **Submit for verification** and respond to Google's review requests.
9. **Review time:** days to weeks. Until verified, either stay in Testing (test users only, warning shown) or run Production-unverified (warning shown, user cap). Verification clears the warning.

> Confirm the live checklist in the console at submission time — Google's verification requirements change, and the console shows each scope's sensitive/restricted classification.

---

## Operational notes / gotchas

- **URL:** the live QA site is **`gg-qa-iota.vercel.app`**. `gg-qa.vercel.app` is a dead/foreign deployment (500s) — never use it.
- **Service-worker cache:** every deploy needs one hard refresh on a client to pick up. The first post-deploy visit serves the cached build; the next is fresh. A "new version — reload" prompt would remove this friction (not built).
- **Deploys:** gg-qa deploys via CLI (`vercel deploy --prod`), no git auto-deploy. `main`'s CI deploy job covers the production target.
- **Redirect URI must match exactly** — the `CALENDAR_OAUTH_REDIRECT_ORIGIN` value, the URI registered in the Google console, and the origin the user is actually on must all agree, or the callback lands on the wrong deployment and the nonce is never consumed.
- **Data isolation:** every calendar table keys on `anon_id`; the token table is service-role only.

---

## Known follow-ups

- **Disconnect gaps** — delete the empty GG calendar shell; retry-safe event deletes (see [Disconnect & cleanup](#disconnect--cleanup)).
- **Read panel is QA-only** — the "upcoming events" panel lives on `/qa/calendar`; promoting it to real Settings needs product sign-off.
- **Test coverage** — the new `GET /upcoming` route and `listUpcomingForDisplay` helper are verified live but lack dedicated unit tests (the rest of the calendar code is well-tested).
- **SW update prompt** — a small "new version available, tap to reload" would end the hard-refresh dance for testers.
- **Google verification** — the whole [verification section](#google-oauth-verification--publishing) is outstanding work (domain, policies, demo video, submission).

---

## Code map

| Concern                                                          | Files                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| OAuth start / callback                                           | `api/calendar/oauth-start.ts`, `api/calendar/oauth-callback.ts`, `api/_lib/calendar/oauth.ts` |
| Google token + Bearer fetch                                      | `api/_lib/calendar/google.ts`                                                                 |
| Event write/read helpers + RRULE                                 | `api/_lib/calendar/events.ts`, `api/_lib/calendar/rrule.ts`                                   |
| Sync writer                                                      | `api/_lib/calendar/writer.ts`                                                                 |
| Routes (status/target/toggle/sync/upcoming/disconnect/test)      | `api/calendar/[...path].ts`                                                                   |
| Frontend client + types                                          | `src/api/calendar.ts`                                                                         |
| React hook                                                       | `src/hooks/useCalendar.ts`                                                                    |
| Settings UI                                                      | `src/components/settings/CalendarIntegrationSection.tsx`                                      |
| QA demo page + upcoming panel                                    | `src/pages/CalendarQAPage.tsx` (route `/qa/calendar`)                                         |
| QA launcher shortcut                                             | `src/onboarding-flow/QAControlScreen.tsx`                                                     |
| Service-worker denylist (the fix that lets the callback through) | `vite.config.ts`                                                                              |
| Migrations                                                       | `supabase/migrations/056_calendar_connections.sql`, `057_calendar_oauth_state.sql`            |
