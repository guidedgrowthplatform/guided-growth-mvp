import type {
  DataService,
  Habit,
  HabitCompletion,
  TrackedMetric,
  MetricEntry,
  JournalEntry,
  HabitSummary,
  WeeklySummary,
} from './data-service.interface';

const STORAGE_KEYS = {
  habits: 'mvp03_habits',
  completions: 'mvp03_completions',
  metrics: 'mvp03_metrics',
  metricEntries: 'mvp03_metric_entries',
  journal: 'mvp03_journal',
} as const;

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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

  let current = 0;
  let longest = 0;
  let streak = 0;
  const today = new Date();

  // Check if today or yesterday is completed (allows for "haven't completed today yet")
  const todayDate = todayStr();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);

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
  current = 0;
  if (dates.includes(todayDate) || dates.includes(yesterdayDate)) {
    const startDate = dates.includes(todayDate) ? todayDate : yesterdayDate;
    const checkDate = new Date(startDate);
    while (dates.includes(checkDate.toISOString().slice(0, 10))) {
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

  async getHabitByName(name: string): Promise<Habit | null> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const lower = name.toLowerCase();
    return habits.find((h) => h.active && h.name.toLowerCase().includes(lower)) || null;
  }

  async updateHabit(id: string, updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>): Promise<Habit> {
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

  async reorderHabits(habitIds: string[]): Promise<void> {
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const ordered: Habit[] = [];
    for (const id of habitIds) {
      const h = habits.find((h) => h.id === id);
      if (h) ordered.push(h);
    }
    // Append any habits not in the reorder list
    for (const h of habits) {
      if (!habitIds.includes(h.id)) ordered.push(h);
    }
    setStore(STORAGE_KEYS.habits, ordered);
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

  async getCompletions(habitId: string, startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    let completions = getStore<HabitCompletion>(STORAGE_KEYS.completions).filter((c) => c.habitId === habitId);
    if (startDate) completions = completions.filter((c) => c.date >= startDate);
    if (endDate) completions = completions.filter((c) => c.date <= endDate);
    return completions;
  }

  async getCompletionsBatch(habitIds: string[], startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    const idSet = new Set(habitIds);
    let completions = getStore<HabitCompletion>(STORAGE_KEYS.completions).filter((c) => idSet.has(c.habitId));
    if (startDate) completions = completions.filter((c) => c.date >= startDate);
    if (endDate) completions = completions.filter((c) => c.date <= endDate);
    return completions;
  }

  // ─── Metrics ───
  async createMetric(name: string, inputType = 'scale', frequency = 'daily', scaleMin?: number, scaleMax?: number): Promise<TrackedMetric> {
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
    setStore(STORAGE_KEYS.metrics, metrics.filter((m) => m.id !== id));
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

  async getMetricEntries(metricId: string, startDate?: string, endDate?: string): Promise<MetricEntry[]> {
    let entries = getStore<MetricEntry>(STORAGE_KEYS.metricEntries).filter((e) => e.metricId === metricId);
    if (startDate) entries = entries.filter((e) => e.date >= startDate);
    if (endDate) entries = entries.filter((e) => e.date <= endDate);
    return entries;
  }

  // ─── Journal ───
  async createJournalEntry(content: string, mood?: string, themes?: string[]): Promise<JournalEntry> {
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
    const summaries = await this.getHabitSummaries([habitId], period);
    if (summaries.length === 0) throw new Error(`Habit not found: ${habitId}`);
    return summaries[0];
  }

  async getHabitSummaries(habitIds: string[], period: 'week' | 'month'): Promise<HabitSummary[]> {
    if (habitIds.length === 0) return [];

    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    const habitMap = new Map(habits.map((h) => [h.id, h]));

    const validIds = habitIds.filter((id) => habitMap.has(id));
    if (validIds.length === 0) return [];

    const now = new Date();
    const totalDays = period === 'week' ? 7 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - totalDays);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = todayStr();

    // Batch fetch all completions at once
    const allCompletions = await this.getCompletionsBatch(validIds, startStr, endStr);

    // Group completions by habit ID
    const completionsByHabit = new Map<string, HabitCompletion[]>();
    for (const c of allCompletions) {
      const list = completionsByHabit.get(c.habitId) ?? [];
      list.push(c);
      completionsByHabit.set(c.habitId, list);
    }

    return validIds.map((id) => {
      const habit = habitMap.get(id)!;
      const completions = completionsByHabit.get(id) ?? [];
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
    });
  }

  async getWeeklySummary(): Promise<WeeklySummary> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const start = weekStart.toISOString().slice(0, 10);
    const end = todayStr();

    const habits = await this.getHabits();
    const habitSummaries = await this.getHabitSummaries(
      habits.map((h) => h.id),
      'week',
    );

    const allMetricEntries = getStore<MetricEntry>(STORAGE_KEYS.metricEntries)
      .filter((e) => e.date >= start && e.date <= end);

    const journalEntries = await this.getJournalEntries(start, end);

    return {
      habits: habitSummaries,
      metricsLogged: allMetricEntries.length,
      journalEntries: journalEntries.length,
      period: { start, end },
    };
  }

  // ─── Seed & Clear ───
  async seedData(): Promise<void> {
    // Only seed if empty
    const habits = getStore<Habit>(STORAGE_KEYS.habits);
    if (habits.length > 0) return;

    // 3 sample habits
    const meditation = await this.createHabit('meditation', 'daily');
    const exercise = await this.createHabit('exercise', 'daily');
    const reading = await this.createHabit('reading', 'daily');

    // 2 sample metrics
    await this.createMetric('sleep quality', 'scale', 'daily', 1, 10);
    await this.createMetric('mood', 'scale', 'daily', 1, 10);

    // Some completions for the past week
    const today = new Date();
    for (let i = 1; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);

      if (i <= 4) await this.completeHabit(meditation.id, dateStr);
      if (i <= 3) await this.completeHabit(exercise.id, dateStr);
      if (i <= 2) await this.completeHabit(reading.id, dateStr);
    }
  }

  // ─── Preferences ───

  async getPreferences(): Promise<import('./data-service.interface').PreferencesData> {
    try {
      const raw = localStorage.getItem('gg_preferences');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { default_view: 'spreadsheet', spreadsheet_range: 'month' };
  }

  async savePreferences(prefs: Partial<import('./data-service.interface').PreferencesData>): Promise<import('./data-service.interface').PreferencesData> {
    const current = await this.getPreferences();
    const merged = { ...current, ...prefs };
    localStorage.setItem('gg_preferences', JSON.stringify(merged));
    return merged;
  }

  // ─── Reflection Config & Affirmation ───

  async getReflectionConfig(): Promise<import('./data-service.interface').ReflectionConfig> {
    try {
      const raw = localStorage.getItem('gg_reflections_config');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      fields: [
        { id: 'gratitude', label: 'What are you grateful for?', order: 1 },
        { id: 'highlight', label: "Today's highlight", order: 2 },
        { id: 'mood', label: 'How do you feel?', order: 3 },
      ],
      show_affirmation: true,
    };
  }

  async saveReflectionConfig(config: import('./data-service.interface').ReflectionConfig): Promise<import('./data-service.interface').ReflectionConfig> {
    localStorage.setItem('gg_reflections_config', JSON.stringify(config));
    return config;
  }

  async getAffirmation(): Promise<string> {
    return localStorage.getItem('gg_affirmation') || '';
  }

  async saveAffirmation(value: string): Promise<void> {
    localStorage.setItem('gg_affirmation', value);
  }

  async clearData(): Promise<void> {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

// Singleton instance
export const mockDataService = new MockDataService();
