import type {
  DataService,
  Habit,
  HabitCompletion,
  TrackedMetric,
  MetricEntry,
  JournalEntry,
  HabitSummary,
  WeeklySummary,
  CheckInRecord,
  FocusSession,
} from './data-service.interface';

const STORAGE_KEYS = {
  habits: 'mvp03_habits',
  completions: 'mvp03_completions',
  metrics: 'mvp03_metrics',
  metricEntries: 'mvp03_metric_entries',
  journal: 'mvp03_journal',
  checkins: 'mvp03_checkins',
  focusSessions: 'mvp03_focus_sessions',
} as const;

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format a Date as YYYY-MM-DD using LOCAL components. Must stay in
 * lockstep with action-dispatcher.formatLocalDate so entries saved
 * through this service and entries queried via the dispatcher share
 * the same date key. UTC-based slicing broke duplicate detection and
 * "today" queries for users east of UTC during morning local hours.
 */
function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return fmtLocalDate(new Date());
}

function getStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Calculate current streak for a habit
function calcStreaks(completions: HabitCompletion[]): { current: number; longest: number } {
  if (completions.length === 0) return { current: 0, longest: 0 };

  const dates = [...new Set(completions.map((c) => c.date))].sort().reverse();

  let longest = 0;
  let streak = 0;
  const today = new Date();

  // Check if today or yesterday is completed (allows for "haven't completed today yet")
  const todayDate = todayStr();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = fmtLocalDate(yesterday);

  const sortedAsc = [...dates].sort();

  for (let i = 0; i < sortedAsc.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(sortedAsc[i - 1]);
      const curr = new Date(sortedAsc[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        longest = Math.max(longest, streak);
        streak = 1;
      }
    }
  }
  longest = Math.max(longest, streak);

  // Current streak: count back from today/yesterday
  let current = 0;
  if (dates.includes(todayDate) || dates.includes(yesterdayDate)) {
    const startDate = dates.includes(todayDate) ? todayDate : yesterdayDate;
    const checkDate = new Date(startDate);
    while (dates.includes(fmtLocalDate(checkDate))) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  return { current, longest };
}

export class MockDataService implements DataService {
  // ─── Habits ───
  async createHabit(name: string, frequency = 'daily'): Promise<Habit> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const habit: Habit = {
      id: generateId(),
      name,
      frequency,
      createdAt: new Date().toISOString(),
      active: true,
    };
    habits.push(habit);
    setStore(STORAGE_KEYS.habits, habits);
    return habit;
  }

  async getHabits(): Promise<Habit[]> {
    return getStore<Habit>(STORAGE_KEYS.habits).filter((h) => h.active);
  }

  async getAllHabits(): Promise<Habit[]> {
    return getStore<Habit>(STORAGE_KEYS.habits);
  }

  async getHabitById(id: string): Promise<Habit | null> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    return habits.find((h) => h.id === id) ?? null;
  }

  async getHabitByName(name: string): Promise<Habit | null> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const lower = name.toLowerCase();
    return habits.find((h) => h.active && h.name.toLowerCase().includes(lower)) || null;
  }

  async updateHabit(
    id: string,
    updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>,
  ): Promise<Habit> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const idx = habits.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error(`Habit not found: ${id}`);
    habits[idx] = { ...habits[idx], ...updates };
    setStore(STORAGE_KEYS.habits, habits);
    return habits[idx];
  }

  async deleteHabit(id: string): Promise<void> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const idx = habits.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error(`Habit not found: ${id}`);
    habits[idx].active = false; // soft delete
    setStore(STORAGE_KEYS.habits, habits);
  }

  // ─── Completions ───
  async completeHabit(habitId: string, date: string): Promise<HabitCompletion> {
    const completions = getStore<HabitCompletion>(STORAGE_KEYS.completions);
    // Prevent duplicate completion for same day
    const existing = completions.find((c) => c.habitId === habitId && c.date === date);
    if (existing) return existing;

    const completion: HabitCompletion = {
      id: generateId(),
      habitId,
      date,
      completedAt: new Date().toISOString(),
    };
    completions.push(completion);
    setStore(STORAGE_KEYS.completions, completions);
    return completion;
  }

  async uncompleteHabit(habitId: string, date: string): Promise<void> {
    const completions = getStore<HabitCompletion>(STORAGE_KEYS.completions);
    const filtered = completions.filter((c) => !(c.habitId === habitId && c.date === date));
    setStore(STORAGE_KEYS.completions, filtered);
  }

  async getCompletions(
    habitId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HabitCompletion[]> {
    let completions = getStore<HabitCompletion>(STORAGE_KEYS.completions).filter(
      (c) => c.habitId === habitId,
    );
    if (startDate) completions = completions.filter((c) => c.date >= startDate);
    if (endDate) completions = completions.filter((c) => c.date <= endDate);
    return completions;
  }

  // ─── Metrics ───
  async createMetric(
    name: string,
    inputType = 'scale',
    frequency = 'daily',
    scaleMin?: number,
    scaleMax?: number,
  ): Promise<TrackedMetric> {
    const metrics = getStore<TrackedMetric>(STORAGE_KEYS.metrics);
    const metric: TrackedMetric = {
      id: generateId(),
      name,
      inputType: inputType as TrackedMetric['inputType'],
      frequency,
      scaleMin: scaleMin ?? (inputType === 'scale' ? 1 : undefined),
      scaleMax: scaleMax ?? (inputType === 'scale' ? 10 : undefined),
      createdAt: new Date().toISOString(),
    };
    metrics.push(metric);
    setStore(STORAGE_KEYS.metrics, metrics);
    return metric;
  }

  async getMetrics(): Promise<TrackedMetric[]> {
    return getStore<TrackedMetric>(STORAGE_KEYS.metrics);
  }

  async getMetricByName(name: string): Promise<TrackedMetric | null> {
    const metrics = getStore<TrackedMetric>(STORAGE_KEYS.metrics);
    const lower = name.toLowerCase();
    return metrics.find((m) => m.name.toLowerCase().includes(lower)) || null;
  }

  async deleteMetric(id: string): Promise<void> {
    const metrics = getStore<TrackedMetric>(STORAGE_KEYS.metrics);
    setStore(
      STORAGE_KEYS.metrics,
      metrics.filter((m) => m.id !== id),
    );
  }

  // ─── Metric Entries ───
  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const entries = getStore<MetricEntry>(STORAGE_KEYS.metricEntries);
    const entry: MetricEntry = {
      id: generateId(),
      metricId,
      value,
      date,
      loggedAt: new Date().toISOString(),
    };
    entries.push(entry);
    setStore(STORAGE_KEYS.metricEntries, entries);
    return entry;
  }

  async getMetricEntries(
    metricId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MetricEntry[]> {
    let entries = getStore<MetricEntry>(STORAGE_KEYS.metricEntries).filter(
      (e) => e.metricId === metricId,
    );
    if (startDate) entries = entries.filter((e) => e.date >= startDate);
    if (endDate) entries = entries.filter((e) => e.date <= endDate);
    return entries;
  }

  // ─── Journal ───
  async createJournalEntry(
    content: string,
    mood?: string,
    themes?: string[],
  ): Promise<JournalEntry> {
    const entries = getStore<JournalEntry>(STORAGE_KEYS.journal);
    const entry: JournalEntry = {
      id: generateId(),
      content,
      mood,
      themes,
      date: todayStr(),
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    setStore(STORAGE_KEYS.journal, entries);
    return entry;
  }

  async getJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    let entries = getStore<JournalEntry>(STORAGE_KEYS.journal);
    if (startDate) entries = entries.filter((e) => e.date >= startDate);
    if (endDate) entries = entries.filter((e) => e.date <= endDate);
    return entries;
  }

  // ─── Summaries ───
  async getHabitSummary(habitId: string, period: 'week' | 'month'): Promise<HabitSummary> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) throw new Error(`Habit not found: ${habitId}`);

    const now = new Date();
    const startDate = new Date(now);
    const totalDays = period === 'week' ? 7 : 30;
    startDate.setDate(startDate.getDate() - totalDays);

    const completions = await this.getCompletions(habitId, fmtLocalDate(startDate), todayStr());
    const uniqueDays = new Set(completions.map((c) => c.date)).size;
    const { current, longest } = calcStreaks(completions);

    return {
      habit,
      completionsThisPeriod: uniqueDays,
      totalDaysInPeriod: totalDays,
      completionRate: Math.round((uniqueDays / totalDays) * 100),
      currentStreak: current,
      longestStreak: longest,
    };
  }

  async getWeeklySummary(): Promise<WeeklySummary> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const start = fmtLocalDate(weekStart);
    const end = todayStr();

    const habits = await this.getHabits();
    const habitSummaries: HabitSummary[] = [];
    for (const h of habits) {
      habitSummaries.push(await this.getHabitSummary(h.id, 'week'));
    }

    const allMetricEntries = getStore<MetricEntry>(STORAGE_KEYS.metricEntries).filter(
      (e) => e.date >= start && e.date <= end,
    );

    const journalEntries = await this.getJournalEntries(start, end);

    return {
      habits: habitSummaries,
      metricsLogged: allMetricEntries.length,
      journalEntries: journalEntries.length,
      period: { start, end },
    };
  }

  // ─── Check-ins ───
  async saveCheckIn(
    date: string,
    data: {
      sleep: number | null;
      mood: number | null;
      energy: number | null;
      stress: number | null;
    },
  ): Promise<CheckInRecord> {
    const checkins = getStore<CheckInRecord>(STORAGE_KEYS.checkins);
    const idx = checkins.findIndex((c) => c.date === date);
    const record: CheckInRecord = {
      id: idx >= 0 ? checkins[idx].id : generateId(),
      date,
      ...data,
      createdAt: idx >= 0 ? checkins[idx].createdAt : new Date().toISOString(),
    };
    if (idx >= 0) {
      checkins[idx] = record;
    } else {
      checkins.push(record);
    }
    setStore(STORAGE_KEYS.checkins, checkins);
    return record;
  }

  async getCheckIn(date: string): Promise<CheckInRecord | null> {
    const checkins = getStore<CheckInRecord>(STORAGE_KEYS.checkins);
    return checkins.find((c) => c.date === date) ?? null;
  }

  async getCheckIns(startDate: string, endDate: string): Promise<CheckInRecord[]> {
    return getStore<CheckInRecord>(STORAGE_KEYS.checkins).filter(
      (c) => c.date >= startDate && c.date <= endDate,
    );
  }

  // ─── Focus Sessions ───
  async saveFocusSession(
    habitId: string | null,
    durationMinutes: number,
    actualMinutes: number | null,
    startedAt: string,
  ): Promise<FocusSession> {
    const sessions = getStore<FocusSession>(STORAGE_KEYS.focusSessions);
    const session: FocusSession = {
      id: generateId(),
      habitId,
      durationMinutes,
      actualMinutes,
      status: actualMinutes ? 'completed' : 'pending',
      startedAt,
    };
    sessions.push(session);
    setStore(STORAGE_KEYS.focusSessions, sessions);
    return session;
  }

  async getFocusSessions(startDate?: string, endDate?: string): Promise<FocusSession[]> {
    let sessions = getStore<FocusSession>(STORAGE_KEYS.focusSessions);
    if (startDate) sessions = sessions.filter((s) => s.startedAt >= startDate);
    if (endDate) sessions = sessions.filter((s) => s.startedAt <= endDate);
    return sessions;
  }

  // ─── All Completions ───
  async getAllCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]> {
    return getStore<HabitCompletion>(STORAGE_KEYS.completions).filter(
      (c) => c.date >= startDate && c.date <= endDate,
    );
  }

  async clearData(): Promise<void> {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

// Singleton instance
export const mockDataService = new MockDataService();
