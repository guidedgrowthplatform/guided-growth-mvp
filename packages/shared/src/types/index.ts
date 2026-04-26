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

// ─── Metric ─────────────────────────────────────────
export type InputType = 'binary' | 'numeric' | 'short_text' | 'text';
export type Frequency = 'daily' | 'weekdays' | 'weekends' | 'weekly';

export interface Metric {
  id: string;
  user_id: string;
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
  user_id: string;
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
  user_id: string;
  value: string;
}

// ─── Journal ─────────────────────────────────────────
export interface JournalEntry {
  id: string;
  user_id: string;
  type: 'freeform' | 'template';
  template_id: string | null;
  title: string | null;
  date: string;
  fields: Record<string, string>;
  mood: string | null;
  ai_insight: string | null;
  ai_insight_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreate {
  type: 'freeform' | 'template';
  template_id?: string;
  title?: string;
  date: string;
  fields: Record<string, string>;
  mood?: string | null;
}

export interface JournalEntryUpdate {
  title?: string | null;
  fields?: Record<string, string>;
  mood?: string | null;
}

// ─── Preferences ────────────────────────────────────
export type ViewMode = 'spreadsheet' | 'form';
export type SpreadsheetRange = 'week' | 'month';

export interface UserPreferences {
  id: string;
  user_id: string;
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
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
    { days: number[] | Set<number>; time: string; reminder: boolean; schedule?: string }
  > | null;
  reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string } | null;
}

export interface OnboardingState {
  id: string;
  user_id: string;
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
}
