// SupabaseDataService — Real backend implementation
// Implements DataService interface using Supabase PostgreSQL
// Replaces MockDataService (localStorage) for production

import { supabase } from '../supabase';
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

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export class SupabaseDataService implements DataService {

  // ─── Habits ───

  async createHabit(name: string, frequency = 'daily'): Promise<Habit> {
    // Duplicate check (FIX-01: #21)
    const existing = await this.getHabitByName(name);
    if (existing) {
      throw new Error(`You already have a habit called "${existing.name}"`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Determine next sort_order by finding the current max
    const { data: maxData } = await supabase
      .from('user_habits')
      .select('sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (maxData?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from('user_habits')
      .insert({
        user_id: user.id,
        name,
        habit_type: 'binary_do',
        cadence: frequency === 'daily' ? 'daily' :
                 frequency === '3x/week' ? '3_specific_days' :
                 frequency === 'weekly' ? 'once_a_week' :
                 frequency === 'weekdays' ? 'weekdays' : 'daily',
        daily_goal: 1,
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async getHabits(): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map(h => ({
      id: h.id,
      name: h.name,
      frequency: h.cadence,
      createdAt: h.created_at,
      active: h.is_active,
    }));
  }

  async getHabitByName(name: string): Promise<Habit | null> {
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .ilike('name', name)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async updateHabit(id: string, updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>): Promise<Habit> {
    const supaUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.frequency !== undefined) supaUpdates.cadence = updates.frequency;
    if (updates.active !== undefined) supaUpdates.is_active = updates.active;

    const { data, error } = await supabase
      .from('user_habits')
      .update(supaUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async deleteHabit(id: string): Promise<void> {
    // Soft delete: archive instead of removing
    const { error } = await supabase
      .from('user_habits')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async reorderHabits(habitIds: string[]): Promise<void> {
    const results = await Promise.all(
      habitIds.map((id, i) =>
        supabase
          .from('user_habits')
          .update({ sort_order: i + 1 })
          .eq('id', id)
      )
    );

    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      throw new Error(`Failed to reorder ${failed.length}/${habitIds.length} habits: ${failed[0].error!.message}`);
    }
  }

  // ─── Completions ───

  async completeHabit(habitId: string, date: string): Promise<HabitCompletion> {
    const { data, error } = await supabase
      .from('habit_completions')
      .upsert(
        {
          user_habit_id: habitId,
          date,
          completed: true,
          completed_via: 'ui',
        },
        { onConflict: 'user_habit_id,date' }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      habitId: data.user_habit_id,
      date: data.date,
      completedAt: data.created_at,
    };
  }

  async uncompleteHabit(habitId: string, date: string): Promise<void> {
    const { error } = await supabase
      .from('habit_completions')
      .delete()
      .eq('user_habit_id', habitId)
      .eq('date', date);

    if (error) throw new Error(error.message);
  }

  async getCompletions(habitId: string, startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    let query = supabase
      .from('habit_completions')
      .select('*')
      .eq('user_habit_id', habitId)
      .eq('completed', true)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(c => ({
      id: c.id,
      habitId: c.user_habit_id,
      date: c.date,
      completedAt: c.created_at,
    }));
  }

  async getCompletionsBatch(habitIds: string[], startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    if (habitIds.length === 0) return [];

    let query = supabase
      .from('habit_completions')
      .select('*')
      .in('user_habit_id', habitIds)
      .eq('completed', true)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(c => ({
      id: c.id,
      habitId: c.user_habit_id,
      date: c.date,
      completedAt: c.created_at,
    }));
  }

  // ─── Metrics ───
  // Uses user_tracked_metrics table in Supabase

  async createMetric(name: string, inputType = 'scale', frequency = 'daily', scaleMin?: number, scaleMax?: number): Promise<TrackedMetric> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_tracked_metrics')
      .insert({
        user_id: user.id,
        name,
        input_type: inputType,
        frequency,
        scale_min: scaleMin ?? (inputType === 'scale' ? 1 : null),
        scale_max: scaleMax ?? (inputType === 'scale' ? 10 : null),
        sort_order: 9999,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      inputType: data.input_type as TrackedMetric['inputType'],
      frequency: data.frequency,
      scaleMin: data.scale_min,
      scaleMax: data.scale_max,
      createdAt: data.created_at,
    };
  }

  async getMetrics(): Promise<TrackedMetric[]> {
    const { data, error } = await supabase
      .from('user_tracked_metrics')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map(m => ({
      id: m.id,
      name: m.name,
      inputType: m.input_type as TrackedMetric['inputType'],
      frequency: m.frequency,
      scaleMin: m.scale_min,
      scaleMax: m.scale_max,
      createdAt: m.created_at,
    }));
  }

  async getMetricByName(name: string): Promise<TrackedMetric | null> {
    const { data, error } = await supabase
      .from('user_tracked_metrics')
      .select('*')
      .ilike('name', name)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      inputType: data.input_type as TrackedMetric['inputType'],
      frequency: data.frequency,
      scaleMin: data.scale_min,
      scaleMax: data.scale_max,
      createdAt: data.created_at,
    };
  }

  async deleteMetric(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_tracked_metrics')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  // ─── Metric Entries ───

  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const { data, error } = await supabase
      .from('user_metric_entries')
      .upsert(
        {
          metric_id: metricId,
          value: String(value),
          date,
        },
        { onConflict: 'metric_id,date' }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      metricId: data.metric_id,
      value: isNaN(Number(data.value)) ? data.value : Number(data.value),
      date: data.date,
      loggedAt: data.created_at,
    };
  }

  async getMetricEntries(metricId: string, startDate?: string, endDate?: string): Promise<MetricEntry[]> {
    let query = supabase
      .from('user_metric_entries')
      .select('*')
      .eq('metric_id', metricId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(e => ({
      id: e.id,
      metricId: e.metric_id,
      value: isNaN(Number(e.value)) ? e.value : Number(e.value),
      date: e.date,
      loggedAt: e.created_at,
    }));
  }

  // ─── Journal ───

  async createJournalEntry(content: string, mood?: string, themes?: string[]): Promise<JournalEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        date: todayStr(),
        response: content,
        prompt: themes?.join(', ') || null,
        input_mode: 'text',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      content: data.response,
      mood,
      themes,
      date: data.date,
      createdAt: data.created_at,
    };
  }

  async getJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(j => ({
      id: j.id,
      content: j.response,
      mood: undefined,
      themes: j.prompt ? j.prompt.split(', ') : undefined,
      date: j.date,
      createdAt: j.created_at,
    }));
  }

  // ─── Summaries ───

  async getHabitSummary(habitId: string, period: 'week' | 'month'): Promise<HabitSummary> {
    const summaries = await this.getHabitSummaries([habitId], period);
    if (summaries.length === 0) throw new Error('Habit not found');
    return summaries[0];
  }

  async getHabitSummaries(habitIds: string[], period: 'week' | 'month'): Promise<HabitSummary[]> {
    if (habitIds.length === 0) return [];

    const habits = await this.getHabits();
    const habitMap = new Map(habits.map(h => [h.id, h]));

    // Validate all requested habit IDs exist
    const validIds = habitIds.filter(id => habitMap.has(id));
    if (validIds.length === 0) return [];

    const daysBack = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startStr = startDate.toISOString().split('T')[0];

    // Batch fetch: completions and streaks in parallel (2 queries total instead of 2N)
    const [allCompletions, streakResult] = await Promise.all([
      this.getCompletionsBatch(validIds, startStr),
      supabase
        .from('habit_streaks')
        .select('*')
        .in('user_habit_id', validIds),
    ]);

    if (streakResult.error) throw new Error(streakResult.error.message);

    // Group completions by habit ID
    const completionsByHabit = new Map<string, HabitCompletion[]>();
    for (const c of allCompletions) {
      const list = completionsByHabit.get(c.habitId) ?? [];
      list.push(c);
      completionsByHabit.set(c.habitId, list);
    }

    // Index streaks by habit ID
    const streaksByHabit = new Map<string, { current_streak: number; longest_streak: number }>();
    for (const s of (streakResult.data || [])) {
      streaksByHabit.set(s.user_habit_id, s);
    }

    return validIds.map(id => {
      const habit = habitMap.get(id)!;
      const completions = completionsByHabit.get(id) ?? [];
      const streakData = streaksByHabit.get(id);

      return {
        habit,
        completionsThisPeriod: completions.length,
        totalDaysInPeriod: daysBack,
        completionRate: (completions.length / daysBack) * 100,
        currentStreak: streakData?.current_streak || 0,
        longestStreak: streakData?.longest_streak || 0,
      };
    });
  }

  async getWeeklySummary(): Promise<WeeklySummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = todayStr();

    // Fetch habits, journal entries, and metrics in parallel
    const [habits, journalEntries, metrics] = await Promise.all([
      this.getHabits(),
      this.getJournalEntries(startStr, endStr),
      this.getMetrics(),
    ]);

    // Batch fetch all habit summaries (2 queries instead of 2N)
    const habitSummaries = await this.getHabitSummaries(
      habits.map(h => h.id),
      'week',
    );

    return {
      habits: habitSummaries,
      metricsLogged: metrics.length,
      journalEntries: journalEntries.length,
      period: { start: startStr, end: endStr },
    };
  }

  // ─── Seed & Clear ───

  async seedData(): Promise<void> {
    // Seeded data already exists in Supabase via seed.sql
    // This method seeds user-specific demo data for testing
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[SupabaseDataService] Not authenticated — cannot seed data');
      return;
    }

    // Create some demo habits
    try {
      await this.createHabit('Morning meditation', 'daily');
      await this.createHabit('Read 10 pages', 'daily');
      await this.createHabit('Workout', '3x/week');
    } catch {
      // Ignore duplicate errors
    }
  }

  // ─── Preferences ───

  async getPreferences(): Promise<import('./data-service.interface').PreferencesData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { default_view: 'spreadsheet', spreadsheet_range: 'month' };

    const { data } = await supabase
      .from('user_preferences')
      .select('default_view, spreadsheet_range')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) return { default_view: 'spreadsheet', spreadsheet_range: 'month' };
    return { default_view: data.default_view, spreadsheet_range: data.spreadsheet_range };
  }

  async savePreferences(prefs: Partial<import('./data-service.interface').PreferencesData>): Promise<import('./data-service.interface').PreferencesData> {
    const current = await this.getPreferences();
    const merged = { ...current, ...prefs };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return merged;

    await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        default_view: merged.default_view,
        spreadsheet_range: merged.spreadsheet_range,
      }, { onConflict: 'user_id' });

    return merged;
  }

  // ─── Reflection Config & Affirmation ───

  async getReflectionConfig(): Promise<import('./data-service.interface').ReflectionConfig> {
    const defaultConfig: import('./data-service.interface').ReflectionConfig = {
      fields: [
        { id: 'gratitude', label: 'What are you grateful for?', order: 1 },
        { id: 'highlight', label: "Today's highlight", order: 2 },
        { id: 'mood', label: 'How do you feel?', order: 3 },
      ],
      show_affirmation: true,
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return defaultConfig;

    const { data } = await supabase
      .from('user_preferences')
      .select('reflection_config')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data?.reflection_config) return defaultConfig;
    return data.reflection_config as import('./data-service.interface').ReflectionConfig;
  }

  async saveReflectionConfig(config: import('./data-service.interface').ReflectionConfig): Promise<import('./data-service.interface').ReflectionConfig> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return config;

    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, reflection_config: config }, { onConflict: 'user_id' });

    return config;
  }

  async getAffirmation(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';

    const { data } = await supabase
      .from('user_preferences')
      .select('affirmation')
      .eq('user_id', user.id)
      .maybeSingle();

    return data?.affirmation || '';
  }

  async saveAffirmation(value: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, affirmation: value }, { onConflict: 'user_id' });
  }

  async clearData(): Promise<void> {
    // Metrics and entries are now in Supabase, not localStorage
    // Note: Supabase data is not cleared via this method for safety
    console.warn('[SupabaseDataService] clearData is a no-op. Supabase data preserved for safety.');
  }
}

// Singleton instance
export const supabaseDataService = new SupabaseDataService();
