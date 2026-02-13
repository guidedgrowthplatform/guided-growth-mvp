# Life Growth Tracker — Project Changelog

## Project Overview

**Life Growth Tracker** is a full-stack habit tracking application that allows users to log daily habits in a spreadsheet-style interface, set goals, track streaks, and export data. The app features Google OAuth authentication, an admin panel for user management, and Progressive Web App (PWA) support for mobile.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind CSS | Vercel Serverless Functions | Supabase Postgres | Google OAuth + JWT

**Live URL:** Deployed on Vercel with custom domain

---

## Starting Point

When development resumed, the application had:
- A working Google OAuth login flow deployed on Vercel
- 8 serverless API functions (auth, entries, metrics, reflections, preferences, admin)
- 11 database tables in Supabase
- A fully implemented React frontend with:
  - Spreadsheet-style habit tracking view
  - Form view for daily entries
  - Metric configuration page
  - Report/visualization page
  - Admin panel (users, allowlist, audit log)
  - Undo/redo, drag-to-reorder, cell fill handle
  - Offline cache layer (implemented but not wired)

### Known Issues at Pickup
- **Admin panel broken:** Audit log endpoint returning 500 errors (column name mismatch)
- **Missing API endpoints:** Frontend called 3 endpoints that didn't exist (role/status/data)
- **Desktop-only:** Spreadsheet was unusable on mobile (no week view, no touch optimization)
- **No user feedback:** No toast notifications — errors silently failed
- **No data export:** Users couldn't download their data
- **No PWA support:** Not installable, no offline capability
- **No tests:** Zero test coverage

---

## Improvements Implemented

### Phase 1: Admin API Fix
**Problem:** Admin page crashed — audit log returned 500, and user management dropdowns did nothing.

**Changes:**
- Fixed SQL query: `actor_id` → `admin_user_id`, `actor_email` → `admin_email` to match actual DB schema
- Added `PATCH /api/admin/users/:id/role` — update user role (user/admin) with validation
- Added `PATCH /api/admin/users/:id/status` — update user status (active/disabled)
- Added `GET /api/admin/users/:id/data` — returns metric, entry, and reflection counts per user
- Added audit logging helper — all admin actions now create audit trail entries
- Added audit logging to allowlist add/remove operations

**Files:** `api/admin/[...path].ts`

---

### Phase 2: Week View
**Problem:** Spreadsheet showed entire month (28-31 columns), making it unusable on smaller screens.

**Changes:**
- Added `SpreadsheetRange` type (`'week' | 'month'`) to shared types
- Created `getWeekDays()` utility (Mon-Sun, 7 days)
- Created `SpreadsheetRangeToggle` component (Week/Month pill toggle)
- Updated `DateNavigation` to handle week stepping (+/- 7 days) and display week ranges (e.g., "Jan 6-12, 2025")
- Updated `SpreadsheetView` to accept range prop and compute days conditionally
- Updated `CaptureView` to manage range state, auto-detect screen size (week on mobile < 768px, month on desktop)
- Entry loading adjusted to fetch only the visible date range

**Files:** `packages/shared/src/types/index.ts`, `src/utils/dates.ts`, `src/components/capture/SpreadsheetRangeToggle.tsx` (new), `src/components/capture/DateNavigation.tsx`, `src/components/capture/SpreadsheetView.tsx`, `src/components/capture/CaptureView.tsx`

---

### Phase 3: Mobile-Responsive Spreadsheet
**Problem:** Spreadsheet was built for desktop — sticky columns broke on mobile, cells were too small for touch, drag reorder didn't work.

**Changes:**
- Edge-to-edge scroll wrapper on mobile (removes horizontal padding for max screen usage)
- 44px minimum cell height for touch targets (meets WCAG touch target guidelines)
- Week view uses larger 44px min-width cells for easy tapping
- Binary cells: single-tap to toggle (empty → yes → no → empty) on all devices
- Non-binary cells: tap to select, double-tap to edit
- Edit popup repositioned below cell on mobile (instead of right-side which goes offscreen)
- Drag handles hidden on touch devices (drag reorder is desktop-only)
- Habit name column narrowed on mobile (100px vs 120px desktop)

**Files:** `src/components/capture/SpreadsheetView.tsx`, `src/components/capture/SpreadsheetCell.tsx`, `src/components/capture/CellEditPopup.tsx`, `src/components/capture/SpreadsheetRow.tsx`

---

### Phase 4: View Persistence
**Problem:** View mode and week/month preference reset on every page load.

**Changes:**
- Created `usePreferences` hook — loads and saves user preferences from API
- Created frontend API client (`src/api/preferences.ts`)
- Extended preferences API to handle `spreadsheet_range` column
- CaptureView initializes view mode and range from saved preferences
- Preference changes saved immediately (optimistic, fire-and-forget)
- DB migration: `ALTER TABLE user_preferences ADD COLUMN spreadsheet_range VARCHAR(10) DEFAULT 'month'`

**Files:** `src/hooks/usePreferences.ts` (new), `src/api/preferences.ts` (new), `api/preferences.ts`, `src/components/capture/CaptureView.tsx`, `supabase/migrations/001_add_spreadsheet_range.sql` (new)

---

### Phase 5: Toast Notifications
**Problem:** No user feedback — saves happened silently, errors went unnoticed, admin actions used browser `alert()`.

**Changes:**
- Created `ToastContext` with toast queue management (max 3 visible, auto-dismiss after 3s)
- Created `ToastContainer` component with slide-in animation, positioned above bottom nav on mobile
- Three toast types: success (green), error (red), info (cyan)
- Wired into `useEntries` — shows error toast on save failure
- Wired into `useMetrics` — shows success on create ("Habit created"), info on delete ("Habit removed")
- Wired into `AdminPage` — replaced `alert()` calls with toasts for allowlist operations
- Added Tailwind animation keyframes for slide-in and shimmer effects

**Files:** `src/contexts/ToastContext.tsx` (new), `src/components/ui/Toast.tsx` (new), `src/components/layout/Layout.tsx`, `src/hooks/useEntries.ts`, `src/hooks/useMetrics.ts`, `src/pages/AdminPage.tsx`, `src/App.tsx`, `tailwind.config.js`

---

### Phase 6: Loading & Error UX
**Problem:** Loading states showed a generic spinner, and unhandled React errors caused blank white screens.

**Changes:**
- Created `Skeleton` base component with shimmer animation (gradient slide effect)
- Created `SpreadsheetSkeleton` — table-shaped loading skeleton that matches spreadsheet layout
- Created `ErrorBoundary` — catches React rendering errors, shows friendly error message with "Try Again" button
- Wrapped all routes with ErrorBoundary in App.tsx

**Files:** `src/components/ui/Skeleton.tsx` (new), `src/components/ui/SpreadsheetSkeleton.tsx` (new), `src/components/ui/ErrorBoundary.tsx` (new), `src/App.tsx`

---

### Phase 7: Enhanced Date Navigation
**Problem:** Navigating to a specific month required clicking arrows repeatedly. No keyboard shortcuts.

**Changes:**
- Date label is now clickable — opens a month/year picker dropdown
- Picker features: 3x4 month grid, year navigation arrows, current month highlighted, "Today" quick button
- Picker closes on outside click
- Added keyboard shortcuts to CaptureView:
  - `Alt + Left/Right` — navigate previous/next (day/week/month depending on view)
  - `Alt + T` — jump to today
  - `Alt + W` — switch to week view
  - `Alt + M` — switch to month view

**Files:** `src/components/capture/DateNavigation.tsx`, `src/components/capture/CaptureView.tsx`

---

### Phase 8: Spreadsheet Interaction Polish
**Problem:** Keyboard navigation and clipboard hooks existed but were never wired up. Binary cells required double-click to edit.

**Changes:**
- Wired `useKeyboardNavigation` hook — arrow keys navigate cells, Enter/F2 edits, Delete/Backspace clears, Escape deselects
- Wired `useClipboard` hook — Ctrl+C copies cell value, Ctrl+V pastes (uses internal buffer + system clipboard)
- Ctrl+Z/Y for undo/redo now works from keyboard navigation
- Binary cells: single-click cycles through empty → yes → no → empty (all devices, not just touch)
- Added `handleDelete` callback for clearing cells via keyboard

**Files:** `src/components/capture/SpreadsheetView.tsx`, `src/components/capture/SpreadsheetCell.tsx`

---

### Phase 9: Data Export
**Problem:** Users had no way to export or backup their data.

**Changes:**
- Added `GET /api/entries/export?start=&end=` endpoint — returns CSV with proper headers and quoting
- CSV format: Date column + one column per metric (using metric names as headers)
- Proper CSV escaping (double-quotes around values, escaped internal quotes)
- Content-Disposition header for automatic file download naming
- Added "Download CSV" button to ReportPage next to month picker

**Files:** `api/entries/[...path].ts`, `src/pages/ReportPage.tsx`

---

### Phase 10: Goals & Targets
**Problem:** No way to set targets for numeric metrics (e.g., "10,000 steps" or "8 glasses of water").

**Changes:**
- Extended `Metric` type with `target_value: number | null` and `target_unit: string | null`
- Updated `MetricCreate` and `MetricUpdate` types to include target fields
- Updated metrics API (PATCH and POST) to handle target fields
- Added target value/unit input fields to ConfigurePage (only shown for numeric metrics)
- Display target info in metrics list ("Target: 10000 steps")
- Added progress bar indicator on numeric spreadsheet cells — thin bar at bottom shows % of target achieved
- DB migration: `ALTER TABLE metrics ADD COLUMN target_value NUMERIC NULL, ADD COLUMN target_unit VARCHAR(20) NULL`

**Files:** `packages/shared/src/types/index.ts`, `api/metrics/[...path].ts`, `src/pages/ConfigurePage.tsx`, `src/components/capture/SpreadsheetCell.tsx`, `supabase/migrations/002_add_metric_targets.sql` (new)

---

### Phase 11: Streak Tracking
**Problem:** No visibility into consistency — users couldn't see how many days in a row they maintained a habit.

**Changes:**
- Created `computeStreak()` utility — walks backwards from today up to 365 days, counts consecutive completed days
- Returns `{ current, longest }` for each metric
- Completion logic: binary = "yes", numeric = > 0, text = non-empty
- Handles "today not yet tracked" edge case (skips day 0 if empty)
- Added Streaks section to ReportPage — card grid showing current streak (fire emoji) and best streak
- Entries load range expanded to 365 days on ReportPage for accurate streak computation

**Files:** `src/utils/streaks.ts` (new), `src/pages/ReportPage.tsx`

---

### Phase 12: Tests
**Problem:** Zero test coverage — no confidence in utility correctness.

**Changes:**
- Added vitest test configuration to vite.config.ts
- **dates.test.ts** (10 tests): formatDate, getMonthDays (including leap year), getWeekDays, isWeekend/isWeekday, getWeekRange
- **cellColors.test.ts** (11 tests): getCellColor for all input types and states, getCellDisplayValue for binary/numeric/empty/dash
- **streaks.test.ts** (4 tests): no entries, consecutive days, broken streak (current vs longest), numeric metrics

**Result:** 25 tests, all passing

**Files:** `src/utils/dates.test.ts` (new), `src/utils/cellColors.test.ts` (new), `src/utils/streaks.test.ts` (new), `vite.config.ts`

---

### Phase 13: PWA Support
**Problem:** App wasn't installable on mobile — no "Add to Home Screen" capability, no offline support.

**Changes:**
- Created `public/manifest.json` — PWA manifest with app name, theme color (#06b6d4), standalone display mode
- Installed and configured `vite-plugin-pwa` — generates service worker with Workbox
- Service worker: precaches static assets (JS, CSS, HTML), network-first strategy for API calls with 1-hour cache
- Updated `index.html` — added manifest link, theme-color meta, apple-mobile-web-app meta tags
- Wired offline queue into `useEntries` — when save fails (network error), entries are queued in localStorage
- Auto-flush: queued mutations replay when browser comes back online, with toast notification on success
- Service worker auto-updates when new version is deployed

**Files:** `public/manifest.json` (new), `vite.config.ts`, `index.html`, `src/hooks/useEntries.ts`

---

## Build Statistics

| Metric | Before | After |
|--------|--------|-------|
| JS bundle | 241 KB | 253 KB |
| CSS bundle | 23 KB | 25 KB |
| Test coverage | 0 tests | 25 tests |
| TypeScript | Clean | Clean |
| PWA | No | Yes |
| Serverless functions | 8 | 8 (within Vercel Hobby limit of 12) |

---

## Pending Database Migrations

Run these on your Supabase SQL editor before using new features:

```sql
-- Migration 1: View persistence
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS spreadsheet_range VARCHAR(10) DEFAULT 'month';

-- Migration 2: Metric targets
ALTER TABLE metrics
ADD COLUMN IF NOT EXISTS target_value NUMERIC NULL,
ADD COLUMN IF NOT EXISTS target_unit VARCHAR(20) NULL;
```

---

## File Summary

### New Files Created (17)
- `src/components/capture/SpreadsheetRangeToggle.tsx` — Week/Month toggle
- `src/components/ui/Toast.tsx` — Toast notification component
- `src/components/ui/Skeleton.tsx` — Loading skeleton
- `src/components/ui/SpreadsheetSkeleton.tsx` — Table skeleton
- `src/components/ui/ErrorBoundary.tsx` — Error boundary with retry
- `src/contexts/ToastContext.tsx` — Toast state management
- `src/hooks/usePreferences.ts` — User preferences hook
- `src/api/preferences.ts` — Preferences API client
- `src/utils/streaks.ts` — Streak computation
- `src/utils/dates.test.ts` — Date utility tests
- `src/utils/cellColors.test.ts` — Cell color tests
- `src/utils/streaks.test.ts` — Streak tests
- `public/manifest.json` — PWA manifest
- `supabase/migrations/001_add_spreadsheet_range.sql`
- `supabase/migrations/002_add_metric_targets.sql`

### Modified Files (24)
- `api/admin/[...path].ts` — Fixed audit log, added user management endpoints
- `api/entries/[...path].ts` — Added CSV export endpoint
- `api/metrics/[...path].ts` — Added target fields support
- `api/preferences.ts` — Added spreadsheet_range handling
- `packages/shared/src/types/index.ts` — Added SpreadsheetRange, target fields
- `src/App.tsx` — Added ToastProvider, ErrorBoundary
- `src/components/capture/CaptureView.tsx` — Week view, preferences, keyboard shortcuts
- `src/components/capture/CellEditPopup.tsx` — Mobile positioning
- `src/components/capture/DateNavigation.tsx` — Month/year picker, week labels
- `src/components/capture/SpreadsheetCell.tsx` — Touch toggle, progress bar
- `src/components/capture/SpreadsheetRow.tsx` — Quick toggle prop, hidden drag handle
- `src/components/capture/SpreadsheetView.tsx` — Week view, keyboard nav, clipboard
- `src/components/layout/Layout.tsx` — Toast container
- `src/hooks/useEntries.ts` — Toast integration, offline queue
- `src/hooks/useMetrics.ts` — Toast integration
- `src/pages/AdminPage.tsx` — Toast integration
- `src/pages/ConfigurePage.tsx` — Target fields UI
- `src/pages/ReportPage.tsx` — CSV export, streaks section
- `src/utils/dates.ts` — getWeekDays function
- `tailwind.config.js` — Animation keyframes
- `vite.config.ts` — PWA plugin, test config
- `index.html` — PWA meta tags
- `package.json` — vite-plugin-pwa dependency
