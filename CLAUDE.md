# CLAUDE.md — Project Guide for AI Assistants

## Architecture Overview

**Monorepo layout:**

```
life-growth-tracker/
├── api/                    # Vercel serverless functions (8 total)
│   ├── _lib/               # Shared helpers (NOT endpoints — underscore prefix)
│   │   ├── auth.ts         # JWT middleware: requireUser, requireAdmin
│   │   └── db.ts           # pg.Pool with max: 1 (serverless-safe)
│   ├── admin/[...path].ts  # Admin catch-all (audit log, user mgmt, allowlist)
│   ├── auth/[...path].ts   # Google OAuth + JWT cookie
│   ├── entries/[...path].ts # Entries catch-all (CRUD + CSV export)
│   ├── metrics/[...path].ts # Metrics catch-all (CRUD with targets)
│   ├── reflections/[...path].ts # Daily reflections catch-all
│   ├── affirmation.ts      # Affirmation endpoint
│   ├── health.ts           # Health check
│   └── preferences.ts      # User preferences (view mode, range)
├── packages/shared/src/types/index.ts  # Single source of truth for ALL types
├── src/                    # React frontend (Vite + Tailwind)
├── public/                 # Static assets + PWA manifest
├── .claude/                # Claude Code config
│   ├── skills/             # Auto-loaded skill definitions
│   │   ├── naming-conventions/SKILL.md  # File & folder naming rules
│   │   ├── frontend-design/SKILL.md     # UI component guidelines
│   │   ├── product/                     # Product specs & roadmap
│   │   ├── voice-architecture/          # Umbrella: 3-path voice/chat model (start here)
│   │   ├── path-1-vapi/                 # Path 1: Vapi (onboarding) — STT+LLM+TTS bundled
│   │   ├── path-2-async/                # Path 2: Async (check-ins) — MP3 + Ink + callLLM + Sonic
│   │   └── path-3-direct-llm/           # Path 3: Direct LLM — onboarding's three non-Vapi orb states
│   ├── settings.json       # Shared settings + hooks (committed)
│   └── settings.local.json # Local permissions (not committed)
├── supabase/migrations/    # SQL migrations (run manually on Supabase)
└── vercel.json             # Rewrites + function config
```

**Tech stack:** React 18 + Vite + TypeScript + Tailwind CSS | Vercel Serverless | Supabase Postgres | Google OAuth + JWT

---

## Related repo — `gg-spec` (sibling, not nested)

Per-screen spec packets live in a separate repo cloned as a sibling directory:

```
/Users/jonah/Documents/
├── guided-growth-mvp/      # this repo (code)
└── gg-spec/                # spec repo (cloned from https://gitlab.com/guidedgrowth-group/gg-spec.git)
```

**Why sibling, not inside this repo:** avoids nested `.git` directories, accidental commits of spec files into the code repo, and tools crawling spec content during builds/searches.

**What's in `gg-spec/`:**

- `screens/` — one MD packet per screen (20 MVP packets), bundling spec + UX rules + acceptance criteria + nav
- `docs/global-ux-rules.md` — canonical UX-01..UX-26 rules
- `docs/nav-graph.md` — Mermaid render of the navigation graph
- `data/nav.json` — canonical navigation graph (generated from FLOWS + seeds)
- `data/nav-seeds.yaml` — hand-curated voice/variant/fallback nav inputs

**Runtime vs reading surface:** packets are NOT in the runtime path. The Master Sheet is the runtime source of truth (synced to Supabase `screen_contexts` via `scripts/voice-sync/seed_contexts.py`). Packets are a derived reading surface for devs and Claude Code agents — read them when implementing a screen.

**Editing:** spec is product-owned (Yair pushes to main directly). Do NOT hand-edit `## Navigation` sections in packets — they're auto-generated. To suggest a spec change, open an issue on the gg-spec repo or ping Yair.

---

## Critical Gotchas

### 1. Vercel Catch-All Routing

API routes use `[...path].ts` catch-all handlers. The route segment is accessed via:

```typescript
const segments = (
  Array.isArray(req.query['...path']) ? req.query['...path'] : [req.query['...path']]
) as string[];
```

**`vercel.json` rewrites bare paths to `__index`:**

```json
{ "source": "/api/metrics", "destination": "/api/metrics/__index" }
```

This means `/api/metrics` hits the catch-all with `segments[0] === '__index'`, while `/api/metrics/123` hits it with `segments[0] === '123'`. Always check for `__index` when handling the base route.

### 2. Serverless Function Limit

Vercel Hobby plan allows **12 serverless functions**. We currently use **8**. Do NOT create new top-level files in `api/` — add sub-routes to existing catch-all handlers instead.

### 3. Path Aliases — Vite, Not TypeScript

```
@/     → src/          (resolved by Vite alias in vite.config.ts)
@shared/ → packages/shared/src/  (resolved by Vite alias)
```

**Do NOT use `composite: true` or `references` in tsconfig.** Vite resolves aliases at build time. TypeScript composite mode expects pre-built output which doesn't exist. The `tsconfig.json` has `paths` configured for editor intellisense only — Vite does the actual resolution.

### 4. Database Pool `max: 1`

`api/_lib/db.ts` creates a `pg.Pool` with `max: 1` because each serverless function invocation is short-lived. Don't increase this — it can exhaust Supabase connection limits under load.

### 5. RLS Policies Are NOT Functional

**The Supabase RLS policies in `003_add_rls_policies.sql` use `auth.uid()` but the database connection uses the service role which bypasses RLS entirely.**

**Data isolation is enforced at the API layer** via `WHERE user_id = $1` in every query (the user ID comes from `requireUser()` which verifies the Supabase Auth session). This means:

- Do NOT rely on RLS for security — it's not effective with service role connections
- ALWAYS include `WHERE user_id = $1` in every query that touches user data
- The database connection uses the **service role** which bypasses RLS entirely

### 6. Input Validation (validation.ts)

`api/_lib/validation.ts` provides shared validators:

- `validateDate(value)` — validates YYYY-MM-DD format with round-trip check
- `validateUUID(value)` — validates UUID v4 format
- `getClientIp(headers)` — gets safe client IP (prefers `x-real-ip` from Vercel infra)

**Always use `validateDate()` for any date from URL params or query strings.** Never pass raw user input as dates to SQL queries.

### 7. Toast Context Requirement

`useToast()` must be called within `<ToastProvider>`. This wraps the entire app in `App.tsx`. If you create a new hook that uses `useToast()`, make sure it's only called from components rendered inside the provider tree.

### 8. Onboarding LLM Text Is Stored Unscrubbed (Intentional)

`/api/llm` runs `scrubPII()` on user messages **except** on `ONBOARD-*` screens (`isOnboardingScreen` in `api/llm/[...path].ts`). Onboarding's whole job is capturing the real nickname/age/referral and the verbatim brain-dump, so scrubbing would destroy the signal. The raw text is persisted to `chat_messages.content` for these screens.

- This is a deliberate carve-out, not a bug — do not "fix" it by scrubbing onboarding messages.
- Data isolation still holds: `chat_messages` is keyed by `anon_id` and read with `WHERE anon_id = $1`.
- Follow-up (not yet built): a retention/cleanup policy for onboarding `chat_messages` once onboarding completes.

### 9. Realtime IS Subject to RLS (unlike service-role queries)

Gotcha #5 only applies to **server-side** `pg` queries (service role bypasses RLS). **Supabase Realtime** subscriptions run with the client's anon key + session JWT, so RLS *is* enforced there. `onboarding_states` has an enabled `user_isolation` policy (`anon_id = current_anon_id()`, JWT-based, fail-closed), which is what actually prevents a client from subscribing to another user's rows. The client-side `filter: anon_id=eq.X` is redundant defense-in-depth, not the boundary.

---

## Development Workflow

### Build & Verify

```bash
npx tsc --noEmit          # Type check (must pass clean)
npm run build              # Vite production build
npx vitest run             # Run all 25 tests
```

Always run `tsc --noEmit` after changes — the Vite build may succeed even with type errors because Vite strips types without checking them.

### Local Development

```bash
npm run dev                # Vite dev server (proxies /api and /auth to localhost:3000)
```

The Vite dev server proxies API calls per `vite.config.ts`:

- `/api/*` → `http://localhost:3000`
- `/auth/*` → `http://localhost:3000`

You need the Vercel CLI or a local Express server for API endpoints to work locally.

### Tests

Tests use **Vitest** with `node` environment (not jsdom). Current tests are unit tests only:

- `src/utils/dates.test.ts` — date utilities (10 tests)
- `src/utils/cellColors.test.ts` — cell color/display logic (11 tests)
- `src/utils/streaks.test.ts` — streak computation (4 tests)

Component tests would need `jsdom` environment — add `// @vitest-environment jsdom` at the top of those test files.

---

## Common Pitfalls & How to Avoid Them

### Form State vs API Types

Form inputs are always strings. API types use `number | null`. **Never intersect** form state with API types:

```typescript
// BAD — impossible intersection if MetricCreate has target_value: number | null
type FormState = MetricCreate & { target_value: string };

// GOOD — separate form interface, convert in handleSubmit
interface MetricForm {
  name: string;
  target_value: string; /* ... */
}
```

### Audit Log Column Names

The `admin_audit_log` table uses: `admin_user_id`, `action`, `target_type`, `target_identifier`, `payload_json`. Do NOT use `actor_id` or `actor_email` — those were the original (wrong) names that caused a 500 error.

### Adding New API Sub-Routes

To add a new endpoint (e.g., `/api/entries/stats`):

1. Open the existing catch-all handler (`api/entries/[...path].ts`)
2. Add a new `if (route === 'stats')` branch
3. Add a rewrite in `vercel.json` if needed for the bare path
4. Do NOT create a new file — stay under the 12-function limit

### Binary Cell Toggle Cycle

Binary cells cycle: `'' → 'yes' → 'no' → ''`. This is handled in `SpreadsheetCell.tsx` via `onQuickToggle`. The cycle works on ALL devices (not just touch).

### Screen context — bundled, not fetched

`src/lib/context/getScreenContext.ts` reads context blocks from a **build-time bundle** at `src/generated/screen_contexts.json`, not from `/api/context`. Vapi navigation between bundled screens has zero network round-trip.

- **Source of truth**: the Master Sheet's "Screens" tab. Bundle was authored byte-identical to what `scripts/voice-sync/seed_contexts.py` writes to Supabase.
- **Coverage today**: 22 onboarding-priority screens. Non-bundled screens fall back to `/api/context` fetch automatically (dev warns in console). Add more screens by editing the JSON when the Sheet updates.
- **Exception**: `ONBOARD-01--FORM` was sourced from the gg-spec packet rather than the Sheet because the packet had richer content (pronunciation flow, current referral option taxonomy). See `screens["ONBOARD-01--FORM"].source` in the JSON.
- **Backend still reads Supabase**: `api/_lib/llm/buildSystemPrompt.ts` and the Vapi `get_user_context` tool still read `screen_contexts` from the DB. Acceptable — they're off the latency-critical path. Phase 2 may unify.

### Optimistic session_log (write-ahead local store)

`src/stores/sessionLogStore.ts` holds the last ~200 session_log events. `logEvent()` writes to this store FIRST (sync), then fires `/api/session_log` (fire-and-forget). Server idempotency handled via `INSERT ... ON CONFLICT (id) DO NOTHING` on the client-provided UUID.

- **State delta is reconstructed locally** — `getScreenContext()` reads from the store, no `/api/context/state` round-trip.
- **`/api/llm` requests carry `recent_events: SessionStateDeltaEntry[]`** from the local store, so backend `buildSystemPromptForRequest` uses optimistic delta instead of querying `session_log` (closes the race where a POST hasn't landed yet).
- **Cold-start hydration**: on `SIGNED_IN` / `INITIAL_SESSION`, the provider fetches the last 24h from server to seed the store (returning user on new device).
- **Persistence**: localStorage (`mvp03_session_log`). Pending events never trimmed; only synced events trim when over the 200 cap.

### Auth email flows redirect to web — not the native scheme

Signup confirmation and password reset emails always redirect to `${VITE_PUBLIC_WEB_ORIGIN}/auth/callback` regardless of platform. Custom-scheme links (`guidedgrowth://`) broke too often — cross-device opens, Gmail-on-Android, missing intent-filters. Web confirms/resets work universally; native users finish on web and use the "Open in app" CTA which fires `guidedgrowth://auth/handoff?confirmed=1|reset=1` (a signal only, no tokens passed). The native handler in `src/main.tsx` writes a `sessionStorage` flag + dispatches `auth:handoff`, and `AuthHandoffListener` in `src/App.tsx` routes to `/login` with a success toast.

OAuth (`signInWithGoogle`) still uses the custom scheme — that's an on-device in-app-browser handoff, not an email.

**Supabase dashboard allowlist** (Auth → URL Configuration) must include:
- Site URL: `https://guided-growth-mvp.vercel.app`
- Redirect URLs:
  - `https://guided-growth-mvp.vercel.app/auth/callback`
  - `https://*.vercel.app/auth/callback` (preview deploys)
  - `http://localhost:5173/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `guidedgrowth://auth/callback` (OAuth on native)
  - `guidedgrowth://auth/handoff` (post-confirm/reset native return)

Native builds must set `VITE_PUBLIC_WEB_ORIGIN`. Android scheme is registered in `android/app/src/main/AndroidManifest.xml` (`VIEW` intent-filter for `guidedgrowth://auth`); iOS uses the `CFBundleURLSchemes` entry in `ios/App/App/Info.plist`.

### Offline Queue

Failed entry saves are queued in `localStorage` via `offlineQueue.enqueue()` in `useEntries.ts`. They auto-flush on the browser's `online` event. The queue is at `src/cache/offlineQueue.ts`.

---

## Key Patterns

### Hook + API Client Pattern

Each feature follows: `api/` endpoint → `src/api/` client → `src/hooks/` hook → component

```
api/preferences.ts (serverless function)
  → src/api/preferences.ts (fetch wrapper)
    → src/hooks/usePreferences.ts (React hook with state)
      → CaptureView.tsx (consumer)
```

### Shared Types

ALL TypeScript types live in `packages/shared/src/types/index.ts`. Both frontend and API import from here via the `@shared/` alias. When adding a new type, put it in this file.

### Keyboard Shortcuts

Registered in `CaptureView.tsx` via `useEffect` with `keydown` listener:

- `Alt + Left/Right` — navigate dates
- `Alt + T` — jump to today
- `Alt + W/M` — switch week/month view
- Arrow keys — navigate spreadsheet cells (when cell is focused)
- `Enter/F2` — edit cell, `Escape` — deselect, `Delete` — clear cell
- `Ctrl+C/V` — copy/paste, `Ctrl+Z/Y` — undo/redo

---

## Database Migrations

Run order for fresh DB: **000_schema → 001_onboarding → 002_app_tables → 003_rls**

All core tables are now created in the migrations (previously `allowlist`, `entries`, `affirmations` and schemas for `reflection_configs`, `reflections`, `user_preferences` were missing — fixed).

### Cleanup

- PWA icons: currently using `vite.svg` as placeholder — replace with proper app icons
- Bundle size: 796KB main chunk needs code splitting

---

## File Quick Reference

| What                                     | Where                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| All shared types                         | `packages/shared/src/types/index.ts`                                                                                                    |
| Vite config (aliases, PWA, proxy, tests) | `vite.config.ts`                                                                                                                        |
| Vercel routing & rewrites                | `vercel.json`                                                                                                                           |
| DB connection                            | `api/_lib/db.ts`                                                                                                                        |
| Auth middleware                          | `api/_lib/auth.ts`                                                                                                                      |
| Main app entry                           | `src/main.tsx` → `src/App.tsx`                                                                                                          |
| Spreadsheet orchestrator                 | `src/components/capture/CaptureView.tsx`                                                                                                |
| Toast system                             | `src/contexts/ToastContext.tsx` + `src/components/ui/Toast.tsx`                                                                         |
| Offline queue                            | `src/cache/offlineQueue.ts`                                                                                                             |
| PWA manifest                             | `public/manifest.json`                                                                                                                  |
| Tailwind config (animations)             | `tailwind.config.js`                                                                                                                    |
| DB migrations                            | `supabase/migrations/`                                                                                                                  |
| Claude skills (naming, frontend design)  | `.claude/skills/*/SKILL.md`                                                                                                             |
| Product specs & roadmap                  | `.claude/skills/product/` (auto-loaded for scope/feature talk)                                                                          |
| Voice/chat architecture (umbrella)       | `.claude/skills/voice-architecture/` — start here for any voice question                                                                |
| Voice paths (per-path detail)            | `.claude/skills/path-1-vapi/` (onboarding), `.claude/skills/path-2-async/` (check-ins), `.claude/skills/path-3-direct-llm/` (onboarding's three non-Vapi orb states) |
