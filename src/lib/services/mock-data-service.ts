import type {
  DataService,
  Habit,
  HabitType,
  HabitCompletion,
  TrackedMetric,
  MetricEntry,
  JournalEntry,
  HabitSummary,
  WeeklySummary,
  CheckInRecord,
  FocusSession,
} from './data-service.interface';
import { calcHabitStreaks } from '@/utils/habitStreak';

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
 * Format a Date as YYYY-MM-DD using LOCAL components. UTC-based slicing
 * broke duplicate detection and "today" queries for users east of UTC
 * during morning local hours.
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
// Rest-aware (Rule 7): a rest bridges the streak. Delegates to the shared helper
// so the mock and the live useHabitDetail path compute streaks identically.
function calcStreaks(completions: HabitCompletion[]): { current: number; longest: number } {
  const done = completions.filter((c) => c.status === 'done').map((c) => c.date);
  const rest = completions.filter((c) => c.status === 'rest').map((c) => c.date);
  return calcHabitStreaks(done, rest, todayStr());
}

export class MockDataService implements DataService {
  // ─── Habits ───
  async createHabit(
    name: string,
    frequency = 'daily',
    scheduleDays?: number[],
    habitType: HabitType = 'binary_do',
  ): Promise<Habit> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const habit: Habit = {
      id: generateId(),
      name,
      frequency,
      scheduleDays: scheduleDays ?? null,
      habitType,
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
    habits.splice(idx, 1);
    setStore(STORAGE_KEYS.habits, habits);
  }

  // ─── Completions ───
  private setHabitDayStatus(
    habitId: string,
    date: string,
    status: 'done' | 'missed' | 'rest',
  ): HabitCompletion {
    const completions = getStore<HabitCompletion>(STORAGE_KEYS.completions);
    const existing = completions.find((c) => c.habitId === habitId && c.date === date);
    if (existing) {
      existing.status = status;
      existing.completedAt = new Date().toISOString();
      setStore(STORAGE_KEYS.completions, completions);
      return existing;
    }

    const completion: HabitCompletion = {
      id: generateId(),
      habitId,
      date,
      completedAt: new Date().toISOString(),
      status,
    };
    completions.push(completion);
    setStore(STORAGE_KEYS.completions, completions);
    return completion;
  }

  async completeHabit(habitId: string, date: string): Promise<HabitCompletion> {
    return this.setHabitDayStatus(habitId, date, 'done');
  }

  async missHabit(habitId: string, date: string): Promise<HabitCompletion> {
    return this.setHabitDayStatus(habitId, date, 'missed');
  }

  async restHabit(habitId: string, date: string): Promise<HabitCompletion> {
    return this.setHabitDayStatus(habitId, date, 'rest');
  }

  async clearHabit(habitId: string, date: string): Promise<void> {
    const completions = getStore<HabitCompletion>(STORAGE_KEYS.completions);
    const filtered = completions.filter((c) => !(c.habitId === habitId && c.date === date));
    setStore(STORAGE_KEYS.completions, filtered);
  }

  async getCompletions(
    habitId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HabitCompletion[]> {
    let completions = getStore<HabitCompletion>(STORAGE_KEYS.completions)
      .filter((c) => c.habitId === habitId)
      .map((c) => ({ ...c, status: c.status ?? 'done' }));
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

    const allCompletions = await this.getCompletions(habitId, fmtLocalDate(startDate), todayStr());
    const doneCompletions = allCompletions.filter((c) => c.status === 'done');
    const uniqueDays = new Set(doneCompletions.map((c) => c.date)).size;
    // Rest days are days off (Rule 7): drop them from the denominator so a rest
    // never lowers the performance score.
    const restDays = new Set(
      allCompletions.filter((c) => c.status === 'rest').map((c) => c.date),
    ).size;
    const effectiveDays = Math.max(0, totalDays - restDays);
    const { current, longest } = calcStreaks(allCompletions);

    return {
      habit,
      completionsThisPeriod: uniqueDays,
      totalDaysInPeriod: effectiveDays,
      completionRate: effectiveDays > 0 ? Math.round((uniqueDays / effectiveDays) * 100) : 0,
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
    return getStore<HabitCompletion>(STORAGE_KEYS.completions)
      .filter((c) => c.date >= startDate && c.date <= endDate)
      .map((c) => ({ ...c, status: c.status ?? 'done' }));
  }

  async clearData(): Promise<void> {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

// Singleton instance
export const mockDataService = new MockDataService();
