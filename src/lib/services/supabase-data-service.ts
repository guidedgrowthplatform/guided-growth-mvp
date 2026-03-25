import { authClient } from '../auth-client';
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
  CheckInRecord,
  FocusSession,
} from './data-service.interface';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function getCurrentUserId(): Promise<string> {
  const { data } = await authClient.getSession();
  if (data?.user?.id) return data.user.id;
  throw new Error('Not authenticated');
}

export class SupabaseDataService implements DataService {
  async createHabit(name: string, frequency = 'daily'): Promise<Habit> {
    const existing = await this.getHabitByName(name);
    if (existing) {
      throw new Error(`You already have a habit called "${existing.name}"`);
    }

    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('user_habits')
      .insert({
        user_id: userId,
        name,
        habit_type: 'binary_do',
        cadence:
          frequency === 'daily'
            ? 'daily'
            : frequency === '3x/week'
              ? '3_specific_days'
              : frequency === 'weekly'
                ? 'once_a_week'
                : frequency === 'weekdays'
                  ? 'weekdays'
                  : 'daily',
        daily_goal: 1,
        is_active: true,
        sort_order: 9999, // Put new habits at end; reorder will fix
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

    return (data || []).map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.cadence,
      createdAt: h.created_at,
      active: h.is_active,
    }));
  }

  async getAllHabits(): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.cadence,
      createdAt: h.created_at,
      active: h.is_active,
    }));
  }

  async getHabitById(id: string): Promise<Habit | null> {
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('id', id)
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

  async getHabitByName(name: string): Promise<Habit | null> {
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .ilike('name', name)
      .eq('is_active', true)
      .limit(1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return null;
    const row = data[0];

    return {
      id: row.id,
      name: row.name,
      frequency: row.cadence,
      createdAt: row.created_at,
      active: row.is_active,
    };
  }

  async updateHabit(
    id: string,
    updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>,
  ): Promise<Habit> {
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
        { onConflict: 'user_habit_id,date' },
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

  async getCompletions(
    habitId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HabitCompletion[]> {
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

    return (data || []).map((c) => ({
      id: c.id,
      habitId: c.user_habit_id,
      date: c.date,
      completedAt: c.created_at,
    }));
  }

  async createMetric(
    name: string,
    inputType = 'scale',
    frequency = 'daily',
    scaleMin?: number,
    scaleMax?: number,
  ): Promise<TrackedMetric> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('metrics')
      .insert({
        user_id: userId,
        name,
        input_type: inputType,
        frequency,
        scale_min: scaleMin ?? null,
        scale_max: scaleMax ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      inputType: data.input_type as TrackedMetric['inputType'],
      frequency: data.frequency,
      scaleMin: data.scale_min ?? undefined,
      scaleMax: data.scale_max ?? undefined,
      createdAt: data.created_at,
    };
  }

  async getMetrics(): Promise<TrackedMetric[]> {
    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((m) => ({
      id: m.id,
      name: m.name,
      inputType: m.input_type as TrackedMetric['inputType'],
      frequency: m.frequency,
      scaleMin: m.scale_min ?? undefined,
      scaleMax: m.scale_max ?? undefined,
      createdAt: m.created_at,
    }));
  }

  async getMetricByName(name: string): Promise<TrackedMetric | null> {
    const { data, error } = await supabase.from('metrics').select('*').ilike('name', name).limit(1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return null;
    const row = data[0];

    return {
      id: row.id,
      name: row.name,
      inputType: row.input_type as TrackedMetric['inputType'],
      frequency: row.frequency,
      scaleMin: row.scale_min ?? undefined,
      scaleMax: row.scale_max ?? undefined,
      createdAt: row.created_at,
    };
  }

  async deleteMetric(id: string): Promise<void> {
    const { error } = await supabase.from('metrics').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }

  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const { data, error } = await supabase
      .from('metric_entries')
      .upsert(
        {
          metric_id: metricId,
          value: String(value),
          date,
        },
        { onConflict: 'metric_id,date' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      metricId: data.metric_id,
      value: data.value,
      date: data.date,
      loggedAt: data.logged_at,
    };
  }

  async getMetricEntries(
    metricId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MetricEntry[]> {
    let query = supabase
      .from('metric_entries')
      .select('*')
      .eq('metric_id', metricId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((e) => ({
      id: e.id,
      metricId: e.metric_id,
      value: e.value,
      date: e.date,
      loggedAt: e.logged_at,
    }));
  }

  async createJournalEntry(
    content: string,
    mood?: string,
    themes?: string[],
  ): Promise<JournalEntry> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
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

    return (data || []).map((j) => ({
      id: j.id,
      content: j.response,
      mood: undefined,
      themes: j.prompt ? j.prompt.split(', ') : undefined,
      date: j.date,
      createdAt: j.created_at,
    }));
  }

  async getHabitSummary(habitId: string, period: 'week' | 'month'): Promise<HabitSummary> {
    const habits = await this.getHabits();
    const habit = habits.find((h) => h.id === habitId);
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
    const habitSummaries = await Promise.all(habits.map((h) => this.getHabitSummary(h.id, 'week')));

    const journalEntries = await this.getJournalEntries(startStr, endStr);
    const metrics = await this.getMetrics();

    return {
      habits: habitSummaries,
      metricsLogged: metrics.length,
      journalEntries: journalEntries.length,
      period: { start: startStr, end: endStr },
    };
  }

  async saveCheckIn(
    date: string,
    data: {
      sleep: number | null;
      mood: number | null;
      energy: number | null;
      stress: number | null;
    },
  ): Promise<CheckInRecord> {
    const userId = await getCurrentUserId();

    const { data: row, error } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          user_id: userId,
          date,
          sleep_quality: data.sleep,
          mood_score: data.mood,
          energy_level: data.energy,
          stress_level: data.stress,
        },
        { onConflict: 'user_id,date' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: row.id,
      date: row.date,
      sleep: row.sleep_quality,
      mood: row.mood_score,
      energy: row.energy_level,
      stress: row.stress_level,
      createdAt: row.created_at,
    };
  }

  async getCheckIn(date: string): Promise<CheckInRecord | null> {
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      date: data.date,
      sleep: data.sleep_quality,
      mood: data.mood_score,
      energy: data.energy_level,
      stress: data.stress_level,
      createdAt: data.created_at,
    };
  }

  async getCheckIns(startDate: string, endDate: string): Promise<CheckInRecord[]> {
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      sleep: row.sleep_quality,
      mood: row.mood_score,
      energy: row.energy_level,
      stress: row.stress_level,
      createdAt: row.created_at,
    }));
  }

  async getAllCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]> {
    const { data, error } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('completed', true)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((c) => ({
      id: c.id,
      habitId: c.user_habit_id,
      date: c.date,
      completedAt: c.created_at,
    }));
  }

  async saveFocusSession(
    habitId: string | null,
    durationMinutes: number,
    actualMinutes: number | null,
    startedAt: string,
  ): Promise<FocusSession> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        user_habit_id: habitId,
        duration_minutes: durationMinutes,
        actual_minutes: actualMinutes,
        status: 'completed',
        started_at: startedAt,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      habitId: data.user_habit_id ?? null,
      durationMinutes: data.duration_minutes,
      actualMinutes: data.actual_minutes ?? null,
      status: data.status,
      startedAt: data.started_at,
    };
  }

  async getFocusSessions(startDate?: string, endDate?: string): Promise<FocusSession[]> {
    let query = supabase
      .from('focus_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (startDate) query = query.gte('started_at', startDate);
    if (endDate) query = query.lte('started_at', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((s) => ({
      id: s.id,
      habitId: s.user_habit_id ?? null,
      durationMinutes: s.duration_minutes,
      actualMinutes: s.actual_minutes ?? null,
      status: s.status,
      startedAt: s.started_at,
    }));
  }

  async seedData(): Promise<void> {
    // Seeded data already exists in Supabase via seed.sql
    try {
      await getCurrentUserId();
    } catch {
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
    // Note: Supabase data is not cleared via this method for safety
    // User data is protected by RLS — deletion requires explicit per-table calls
    console.warn('[SupabaseDataService] clearData is a no-op. Supabase data preserved for safety.');
  }
}

// Singleton instance
export const supabaseDataService = new SupabaseDataService();
