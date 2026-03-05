// DataService Interface — shared contract for MockDataService and SupabaseDataService
// This is the core abstraction that allows swapping between mock (localStorage) and real (Supabase) backends

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
  getHabitByName(name: string): Promise<Habit | null>;
  updateHabit(id: string, updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>): Promise<Habit>;
  deleteHabit(id: string): Promise<void>;

  // Habit completions
  completeHabit(habitId: string, date: string): Promise<HabitCompletion>;
  getCompletions(habitId: string, startDate?: string, endDate?: string): Promise<HabitCompletion[]>;

  // Metrics
  createMetric(name: string, inputType: string, frequency?: string, scaleMin?: number, scaleMax?: number): Promise<TrackedMetric>;
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

  // Seed
  seedData(): Promise<void>;
  clearData(): Promise<void>;
}
