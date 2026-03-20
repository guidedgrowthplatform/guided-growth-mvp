---
name: naming-conventions
description: File and folder naming conventions for this project. Auto-invoked when creating new files, components, hooks, pages, or folders.
user-invocable: false
---

# Naming Conventions

Follow these rules when creating or renaming files and folders in this project.

## Files

| Type | Convention | Pattern | Examples |
|------|-----------|---------|----------|
| React components | PascalCase | `ComponentName.tsx` | `CheckInCard.tsx`, `CalendarGrid.tsx`, `HomeHeader.tsx` |
| Pages | PascalCase + `Page` suffix | `FeaturePage.tsx` | `HomePage.tsx`, `CalendarPage.tsx`, `SettingsPage.tsx` |
| Hooks | camelCase with `use` prefix | `useFeatureName.ts` | `useAuth.ts`, `useFocusTimer.ts`, `useEntries.ts` |
| Config/data files | camelCase | `featureConfig.ts` | `calendarConfig.ts`, `checkInConfig.ts` |
| Utility files | camelCase | `utilName.ts` | `cellColors.ts`, `dates.ts`, `streaks.ts` |
| Test files | camelCase + `.test` suffix | `utilName.test.ts` | `dates.test.ts`, `cellColors.test.ts` |
| Barrel exports | Always `index.ts` | `index.ts` | Every component folder has one |
| API clients | camelCase | `featureName.ts` | `src/api/preferences.ts` |

## Folders

| Location | Convention | Examples |
|----------|-----------|----------|
| `src/components/*` | kebab-case | `habit-detail/`, `home/`, `ui/` |
| `src/pages/*` | Flat PascalCase files (no subfolders unless multi-file like `onboarding/`) | `HomePage.tsx` |
| `src/hooks/` | Flat, no subfolders | `useAuth.ts` |
| `src/utils/` | Flat, no subfolders | `dates.ts` |
| `src/api/` | Flat, no subfolders | `preferences.ts` |

## Rules

1. **Never use kebab-case for `.tsx` files** — components are always PascalCase
2. **Never use PascalCase for folders** — folders are always kebab-case
3. **Config files are camelCase**, not PascalCase (e.g., `calendarConfig.ts` not `CalendarConfig.ts`)
4. **Mock data files are camelCase** (e.g., `calendarMockData.ts`)
5. **Each component folder must have an `index.ts`** barrel export
6. **Shared types go in `packages/shared/src/types/index.ts`** — not in component folders
