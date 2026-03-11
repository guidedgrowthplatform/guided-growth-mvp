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
        sort_order: 9999,  // Put new habits at end; reorder will fix
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
    for (let i = 0; i < habitIds.length; i++) {
      const { error } = await supabase
        .from('user_habits')
        .update({ sort_order: i + 1 })
        .eq('id', habitIds[i]);

      if (error) throw new Error(error.message);
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

  // ─── Metrics ───
  // Note: Metrics map to daily_checkins in the new schema
  // For MVP, we store them as custom entries

  async createMetric(name: string, inputType = 'scale', frequency = 'daily', scaleMin?: number, scaleMax?: number): Promise<TrackedMetric> {
    // Store metrics as a special habit type for now
    // In future, metrics could have their own table
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const metric: TrackedMetric = {
      id: crypto.randomUUID(),
      name,
      inputType: inputType as 'scale' | 'binary' | 'numeric' | 'text',
      frequency,
      scaleMin,
      scaleMax,
      createdAt: new Date().toISOString(),
    };

    // Store in localStorage for now (metrics don't have a direct Supabase table in MVP)
    const existing = JSON.parse(localStorage.getItem('supabase_metrics') || '[]');
    existing.push(metric);
    localStorage.setItem('supabase_metrics', JSON.stringify(existing));

    return metric;
  }

  async getMetrics(): Promise<TrackedMetric[]> {
    return JSON.parse(localStorage.getItem('supabase_metrics') || '[]');
  }

  async getMetricByName(name: string): Promise<TrackedMetric | null> {
    const metrics = await this.getMetrics();
    return metrics.find(m => m.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async deleteMetric(id: string): Promise<void> {
    const metrics = await this.getMetrics();
    localStorage.setItem('supabase_metrics', JSON.stringify(metrics.filter(m => m.id !== id)));
  }

  // ─── Metric Entries ───

  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const entry: MetricEntry = {
      id: crypto.randomUUID(),
      metricId,
      value,
      date,
      loggedAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem('supabase_metric_entries') || '[]');
    existing.push(entry);
    localStorage.setItem('supabase_metric_entries', JSON.stringify(existing));

    return entry;
  }

  async getMetricEntries(metricId: string, startDate?: string, endDate?: string): Promise<MetricEntry[]> {
    const entries: MetricEntry[] = JSON.parse(localStorage.getItem('supabase_metric_entries') || '[]');
    return entries.filter(e => {
      if (e.metricId !== metricId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
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
    const habits = await this.getHabits();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) throw new Error('Habit not found');

    const daysBack = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startStr = startDate.toISOString().split('T')[0];

    const completions = await this.getCompletions(habitId, startStr);

    // Get streak from habit_streaks table
    const { data: streakData } = await supabase
      .from('habit_streaks')
      .select('*')
      .eq('user_habit_id', habitId)
      .maybeSingle();

    return {
      habit,
      completionsThisPeriod: completions.length,
      totalDaysInPeriod: daysBack,
      completionRate: (completions.length / daysBack) * 100,
      currentStreak: streakData?.current_streak || 0,
      longestStreak: streakData?.longest_streak || 0,
    };
  }

  async getWeeklySummary(): Promise<WeeklySummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = todayStr();

    const habits = await this.getHabits();
    const habitSummaries = await Promise.all(
      habits.map(h => this.getHabitSummary(h.id, 'week'))
    );

    const journalEntries = await this.getJournalEntries(startStr, endStr);
    const metrics = await this.getMetrics();

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

  async clearData(): Promise<void> {
    // Clear user's local metric data
    localStorage.removeItem('supabase_metrics');
    localStorage.removeItem('supabase_metric_entries');
    
    // Note: Supabase data is not cleared via this method for safety
    console.warn('[SupabaseDataService] clearData only clears local metric cache. Supabase data preserved.');
  }
}

// Singleton instance
export const supabaseDataService = new SupabaseDataService();
