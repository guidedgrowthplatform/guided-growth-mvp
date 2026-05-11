# Guided Growth — Database Schema ERD

> Based on `Plan/migration.sql` v4 — Supabase (PostgreSQL 15+)

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ user_habits : "has"
    users ||--o{ daily_checkins : "logs"
    users ||--o{ journal_entries : "writes"
    users ||--o{ focus_sessions : "starts"
    users ||--o{ user_milestones : "earns"
    users ||--o{ user_points : "accumulates"
    users ||--|| onboarding_states : "has"
    users ||--|| user_settings : "has"

    categories ||--o{ subcategories : "contains"
    categories ||--o{ identity_goals : "groups"
    subcategories ||--o{ starter_habits : "suggests"

    user_habits ||--o{ habit_completions : "tracks"
    user_habits ||--o{ habit_streaks : "computed"
    user_habits }o--o| starter_habits : "based_on"
    user_habits }o--o| categories : "belongs_to"
    user_habits }o--o| identity_goals : "supports"

    journal_categories ||--o{ journal_entries : "categorizes"
    milestones ||--o{ user_milestones : "defines"

    onboarding_states ||--o{ onboarding_selected_categories : "picks"
    onboarding_states ||--o{ onboarding_selected_subcategories : "picks"
    onboarding_selected_categories }o--|| categories : "references"
    onboarding_selected_subcategories }o--|| subcategories : "references"

    users {
        uuid id PK
        varchar email UK
        varchar auth_provider
        varchar nickname
        varchar age_group
        varchar gender
        varchar language
        varchar timezone
        time morning_wakeup_time
        time night_winddown_time
        varchar onboarding_path
        timestamptz created_at
    }

    categories {
        uuid id PK
        varchar slug UK
        varchar name
        int sort_order
    }

    subcategories {
        uuid id PK
        uuid category_id FK
        varchar slug
        varchar name
        text goal_prompt
    }

    starter_habits {
        uuid id PK
        uuid subcategory_id FK
        varchar name
        varchar habit_type
        varchar[] default_cadence_options
    }

    identity_goals {
        uuid id PK
        varchar name
        uuid category_id FK
    }

    user_habits {
        uuid id PK
        uuid user_id FK
        uuid starter_habit_id FK
        varchar name
        varchar habit_type
        varchar cadence
        int daily_goal
        boolean is_active
        boolean is_journaling
        timestamptz created_at
    }

    habit_completions {
        uuid id PK
        uuid user_habit_id FK
        date date
        boolean completed
        varchar completed_via
    }

    habit_streaks {
        uuid id PK
        uuid user_habit_id FK
        int current_streak
        int longest_streak
        int total_completions
        real completion_rate
    }

    daily_checkins {
        uuid id PK
        uuid user_id FK
        date date
        varchar mood
        int energy_level
        varchar stress_level
        int sleep_quality
    }

    journal_categories {
        uuid id PK
        varchar name
        varchar icon
    }

    journal_entries {
        uuid id PK
        uuid user_id FK
        uuid user_habit_id FK
        uuid category_id FK
        date date
        text response
        varchar input_mode
    }

    focus_sessions {
        uuid id PK
        uuid user_id FK
        int duration_minutes
        int actual_minutes
        varchar status
        timestamptz started_at
    }

    milestones {
        uuid id PK
        varchar name
        varchar milestone_type
        int required_value
    }

    user_milestones {
        uuid id PK
        uuid user_id FK
        uuid milestone_id FK
        timestamptz earned_at
    }

    user_points {
        uuid id PK
        uuid user_id FK
        int points
        varchar reason
        timestamptz earned_at
    }

    onboarding_states {
        uuid id PK
        uuid user_id FK
        varchar path
        int current_step
        text brain_dump_raw
        jsonb brain_dump_parsed
    }

    onboarding_selected_categories {
        uuid id PK
        uuid onboarding_state_id FK
        uuid category_id FK
    }

    onboarding_selected_subcategories {
        uuid id PK
        uuid onboarding_state_id FK
        uuid subcategory_id FK
    }

    user_settings {
        uuid id PK
        uuid user_id FK
        boolean notification_enabled
        time morning_checkin_reminder
        time evening_reminder_time
    }
```

## Table Summary

| #   | Table                               | Purpose                              | RLS                      |
| --- | ----------------------------------- | ------------------------------------ | ------------------------ |
| 1   | `users`                             | User profiles & onboarding data      | ✅ Own row only          |
| 2   | `categories`                        | Habit taxonomy (seeded)              | Read-only for all        |
| 3   | `subcategories`                     | Habit sub-categories (seeded)        | Read-only for all        |
| 4   | `starter_habits`                    | Pre-defined habit templates (seeded) | Read-only for all        |
| 5   | `identity_goals`                    | Atomic Habits identity framework     | Read-only for all        |
| 6   | `user_habits`                       | User-created habits                  | ✅ Own habits            |
| 7   | `habit_completions`                 | Daily habit check-offs               | ✅ Via user_habits       |
| 8   | `habit_streaks`                     | Computed streaks & stats             | ✅ Via user_habits       |
| 9   | `daily_checkins`                    | Mood & wellness logs                 | ✅ Own check-ins         |
| 10  | `journal_categories`                | Journal categories (seeded)          | Read-only for all        |
| 11  | `journal_entries`                   | User journal entries                 | ✅ Own entries           |
| 12  | `focus_sessions`                    | Pomodoro-style sessions              | ✅ Own sessions          |
| 13  | `milestones`                        | Milestone definitions (seeded)       | Read-only for all        |
| 14  | `user_milestones`                   | User milestone achievements          | ✅ Own milestones        |
| 15  | `user_points`                       | Gamification points ledger           | ✅ Own points            |
| 16  | `onboarding_states`                 | Onboarding progress                  | ✅ Own state             |
| 17  | `onboarding_selected_categories`    | Onboarding picks                     | ✅ Via onboarding_states |
| 18  | `onboarding_selected_subcategories` | Onboarding picks                     | ✅ Via onboarding_states |
| 19  | `user_settings`                     | Notification preferences             | ✅ Own settings          |

## Storage Buckets

| Bucket             | Public | Max Size | Types                     |
| ------------------ | ------ | -------- | ------------------------- |
| `avatars`          | ✅     | 2MB      | JPEG, PNG, WebP           |
| `voice-recordings` | ❌     | 10MB     | WebM, MP4, MPEG, OGG, WAV |
| `exports`          | ✅     | 5MB      | PNG, JPEG, WebP           |
