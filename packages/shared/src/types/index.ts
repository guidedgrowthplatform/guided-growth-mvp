// ─── User ───────────────────────────────────────────
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

// Server-side authenticated user — produced by requireUser() in api/_lib/auth.ts.
// authUserId = auth.users.id (for admin actions, rate-limit keys, audit logs)
// anonId     = profiles.anon_id (for ALL behavioral DB queries)
export interface AuthenticatedUser {
  authUserId: string;
  anonId: string;
  firstName: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
}

// ─── Metric ─────────────────────────────────────────
export type InputType = 'binary' | 'numeric' | 'short_text' | 'text';
export type Frequency = 'daily' | 'weekdays' | 'weekends' | 'weekly';

// Habit polarity. 'binary_do' = success when done (gym). 'binary_avoid' =
// success when abstained (no news). Same win/miss calendar; only framing differs.
export type HabitType = 'binary_do' | 'binary_avoid';

// 'pending' = no completion row; stored rows are 'done' | 'missed'.
export type HabitDayStatus = 'pending' | 'done' | 'missed';

export interface Metric {
  id: string;
  anon_id: string;
  name: string;
  input_type: InputType;
  question: string;
  active: boolean;
  frequency: Frequency;
  sort_order: number;
  target_value: number | null;
  target_unit: string | null;
  created_at: string;
  updated_at: string;
}

export type MetricCreate = Pick<Metric, 'name' | 'input_type' | 'question' | 'frequency'> & {
  active?: boolean;
  target_value?: number | null;
  target_unit?: string | null;
  schedule_days?: number[];
};

export type MetricUpdate = Partial<
  Pick<
    Metric,
    'name' | 'input_type' | 'question' | 'active' | 'frequency' | 'target_value' | 'target_unit'
  >
>;

// ─── Entry ──────────────────────────────────────────
export interface Entry {
  id: string;
  anon_id: string;
  metric_id: string;
  date: string; // yyyy-MM-dd
  value: string;
}

/** Map of metric_id → value for a single day */
export type DayEntries = Record<string, string>;

/** Map of date → DayEntries */
export type EntriesMap = Record<string, DayEntries>;

// ─── Affirmation ────────────────────────────────────
export interface Affirmation {
  id: string;
  anon_id: string;
  value: string;
}

// ─── Journal ─────────────────────────────────────────
export interface JournalEntry {
  id: string;
  anon_id: string;
  type: 'freeform' | 'template';
  template_id: string | null;
  title: string | null;
  date: string;
  habit_id?: string | null;
  fields: Record<string, string>;
  // Prompts the entry was written against (template entries); preserves display
  // when a user later edits their reflection prompts. Null for freeform.
  prompts_snapshot?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreate {
  type: 'freeform' | 'template';
  template_id?: string;
  title?: string;
  date: string;
  habit_id?: string | null;
  fields: Record<string, string>;
  prompts_snapshot?: string[] | null;
}

// ─── Reflection settings (runtime mode + editable prompts) ───
export type ReflectionMode = 'prompts' | 'freeform';

// Canonical default for NEW reflection settings (matches the onboarding card).
// Going forward this unifies onboarding + runtime wording. Historical entries
// keep their own wording via JournalEntry.prompts_snapshot, and the NULL-snapshot
// fallback in ReflectionDetailPage stays the legacy long-form set on purpose.
export const DEFAULT_REFLECTION_PROMPTS: string[] = [
  'What am I proud of today?',
  'What do I forgive myself for today?',
  'What am I grateful for today?',
];

export interface ReflectionSettings {
  mode: ReflectionMode;
  prompts: string[]; // used when mode==='prompts'; empty for freeform
  time: string | null; // 'HH:MM'
  days: number[]; // 0..6
  reminder: boolean;
  schedule: string | null; // 'Weekday' | 'Weekend' | 'Every day'
}

export type ReflectionSettingsUpdate = Partial<ReflectionSettings>;

// ─── Preferences ────────────────────────────────────
export type ViewMode = 'spreadsheet' | 'form';
export type SpreadsheetRange = 'week' | 'month';
export type VoiceMode = 'voice' | 'screen' | 'always_ask';
export type RecordingMode = 'auto-stop' | 'always-on';

export interface UserPreferences {
  id: string;
  anon_id: string;
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
  voice_mode: VoiceMode;
  mic_enabled: boolean;
  mic_permission: boolean;
  recording_mode: RecordingMode;
  voice_model: string;
  coaching_style: string;
  language: string;
  morning_time: string;
  night_time: string;
  push_notifications: boolean;
}

// ─── API Types ──────────────────────────────────────
export interface ApiError {
  error: string;
  requestId?: string;
}

// ─── Allowlist ──────────────────────────────────────
export interface AllowlistEntry {
  id: string;
  email: string;
  added_by_user_id: string | null;
  added_by_email?: string;
  note: string | null;
  created_at: string;
}

// ─── Design System Types ───────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'default' | 'success' | 'danger' | 'warning';
export type NavTab = 'home' | 'progress' | 'voice' | 'focus' | 'profile';
export type CheckInDimension = 'sleep' | 'mood' | 'energy' | 'stress';

export interface CheckInData {
  sleep: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
}

// ─── Audit Log ──────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  admin_user_id: string;
  admin_email?: string;
  action: string;
  target_type: string;
  target_identifier: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
}

// ─── Session Log ────────────────────────────────────
export interface SessionLogEntry {
  id: string;
  anon_id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  screen_id: string | null;
  payload: Record<string, unknown> | null;
}

// ─── Onboarding ─────────────────────────────────────
export type OnboardingPath = 'simple' | 'braindump' | 'advanced';

export type OnboardingStatus = 'in_progress' | 'completed';

export interface OnboardingStepData {
  nickname?: string | null;
  age?: number | null;
  ageRange?: string | null;
  gender?: string | null;
  referralSource?: string | null;
  referralOtherText?: string | null;
  path?: OnboardingPath | null;
  category?: string | null;
  goals?: string[] | null;
  habitConfigs?: Record<
    string,
    {
      days: number[] | Set<number>;
      time: string;
      reminder: boolean;
      schedule?: string;
      habitType?: HabitType;
    }
  > | null;
  reflectionConfig?: {
    time: string;
    days: number[];
    reminder: boolean;
    // null = custom day-set with no canonical preset label (validator accepts null).
    schedule: string | null;
  } | null;
  reflectionMode?: ReflectionMode | null;
  brainDumpText?: string | null;
  // Persisted LLM parse so advanced-results can rehydrate on lost router state (no regex re-invent).
  brainDumpHabits?: Array<{ name: string; days?: number[]; time?: string }> | null;
  brainDumpParseSource?: 'llm' | 'regex_fallback' | null;
  customPrompts?: string[] | null;
  advancedHabitConfigs?: Record<
    string,
    {
      days: number[] | Set<number>;
      time: string;
      reminder: boolean;
      schedule?: string;
      habitType?: HabitType;
    }
  > | null;
  reflectionSchedule?: string | null;
}

export interface OnboardingState {
  id: string;
  anon_id: string;
  path: OnboardingPath | null;
  status: OnboardingStatus;
  current_step: number;
  data: OnboardingStepData;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedHabit {
  name: string;
  frequency: string;
  days?: number[];
  time?: string;
  habitType?: HabitType;
}

export interface ParseBrainDumpRequest {
  text: string;
  session_id: string;
  screen_id?: string;
}

export interface ParseBrainDumpResponse {
  habits: ParsedHabit[];
}
