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
│   │   └── voice-poc/                   # Voice command system reference
│   ├── settings.json       # Shared settings + hooks (committed)
│   └── settings.local.json # Local permissions (not committed)
├── supabase/migrations/    # SQL migrations (run manually on Supabase)
└── vercel.json             # Rewrites + function config
```

**Tech stack:** React 18 + Vite + TypeScript + Tailwind CSS | Vercel Serverless | Supabase Postgres | Google OAuth + JWT

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

| What                                     | Where                                                           |
| ---------------------------------------- | --------------------------------------------------------------- |
| All shared types                         | `packages/shared/src/types/index.ts`                            |
| Vite config (aliases, PWA, proxy, tests) | `vite.config.ts`                                                |
| Vercel routing & rewrites                | `vercel.json`                                                   |
| DB connection                            | `api/_lib/db.ts`                                                |
| Auth middleware                          | `api/_lib/auth.ts`                                              |
| Main app entry                           | `src/main.tsx` → `src/App.tsx`                                  |
| Spreadsheet orchestrator                 | `src/components/capture/CaptureView.tsx`                        |
| Toast system                             | `src/contexts/ToastContext.tsx` + `src/components/ui/Toast.tsx` |
| Offline queue                            | `src/cache/offlineQueue.ts`                                     |
| PWA manifest                             | `public/manifest.json`                                          |
| Tailwind config (animations)             | `tailwind.config.js`                                            |
| DB migrations                            | `supabase/migrations/`                                          |
| Claude skills (naming, frontend design)  | `.claude/skills/*/SKILL.md`                                     |
