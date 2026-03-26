export interface Habit {
  id: string;
  name: string;
  frequency: string; // 'daily' | '3x/week' | 'weekly' etc
  createdAt: string;
  active: boolean;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // yyyy-MM-dd
  completedAt: string;
}

export interface TrackedMetric {
  id: string;
  name: string;
  inputType: 'scale' | 'binary' | 'numeric' | 'text';
  frequency: string;
  scaleMin?: number;
  scaleMax?: number;
  createdAt: string;
}

export interface MetricEntry {
  id: string;
  metricId: string;
  value: number | string;
  date: string;
  loggedAt: string;
}

export interface JournalEntry {
  id: string;
  content: string;
  mood?: string;
  themes?: string[];
  date: string;
  createdAt: string;
}

export interface HabitSummary {
  habit: Habit;
  completionsThisPeriod: number;
  totalDaysInPeriod: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
}

export interface WeeklySummary {
  habits: HabitSummary[];
  metricsLogged: number;
  journalEntries: number;
  period: { start: string; end: string };
}

export interface CheckInRecord {
  id: string;
  date: string;
  sleep: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  habitId: string | null;
  durationMinutes: number;
  actualMinutes: number | null;
  status: 'pending' | 'completed' | 'cancelled';
  startedAt: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  uiAction?: 'navigate' | 'refresh' | 'toast' | 'display';
  navigateTo?: string;
}

export interface DataService {
  // Habits
  createHabit(name: string, frequency?: string): Promise<Habit>;
  getHabits(): Promise<Habit[]>;
  getAllHabits(): Promise<Habit[]>;
  getHabitById(id: string): Promise<Habit | null>;
  getHabitByName(name: string): Promise<Habit | null>;
  updateHabit(
    id: string,
    updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>,
  ): Promise<Habit>;
  deleteHabit(id: string): Promise<void>;

  // Habit completions
  completeHabit(habitId: string, date: string): Promise<HabitCompletion>;
  uncompleteHabit(habitId: string, date: string): Promise<void>;
  getCompletions(habitId: string, startDate?: string, endDate?: string): Promise<HabitCompletion[]>;

  // Metrics
  createMetric(
    name: string,
    inputType: string,
    frequency?: string,
    scaleMin?: number,
    scaleMax?: number,
  ): Promise<TrackedMetric>;
  getMetrics(): Promise<TrackedMetric[]>;
  getMetricByName(name: string): Promise<TrackedMetric | null>;
  deleteMetric(id: string): Promise<void>;

  // Metric entries
  logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry>;
  getMetricEntries(metricId: string, startDate?: string, endDate?: string): Promise<MetricEntry[]>;

  // Journal
  createJournalEntry(content: string, mood?: string, themes?: string[]): Promise<JournalEntry>;
  getJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]>;

  // Summaries
  getHabitSummary(habitId: string, period: 'week' | 'month'): Promise<HabitSummary>;
  getWeeklySummary(): Promise<WeeklySummary>;

  // Check-ins
  saveCheckIn(
    date: string,
    data: {
      sleep: number | null;
      mood: number | null;
      energy: number | null;
      stress: number | null;
    },
  ): Promise<CheckInRecord>;
  getCheckIn(date: string): Promise<CheckInRecord | null>;
  getCheckIns(startDate: string, endDate: string): Promise<CheckInRecord[]>;

  // Focus sessions
  saveFocusSession(
    habitId: string | null,
    durationMinutes: number,
    actualMinutes: number | null,
    startedAt: string,
  ): Promise<FocusSession>;
  getFocusSessions(startDate?: string, endDate?: string): Promise<FocusSession[]>;

  // All completions (across all habits)
  getAllCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]>;

  // Seed
  seedData(): Promise<void>;
  clearData(): Promise<void>;
}
