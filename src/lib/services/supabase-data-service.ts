import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../supabase';
import { encryptJournal, decryptJournal } from '../utils/journal-crypto';
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

const moodFromDb: Record<string, number> = { awful: 1, unhappy: 2, okay: 3, calm: 4, joyful: 5 };
const stressFromDb: Record<string, number> = { high: 1, moderate: 3, low: 5 };

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentUserId(): string {
  const user = useAuthStore.getState().user;
  if (user?.id) return user.id;
  throw new Error('Not authenticated');
}

export class SupabaseDataService implements DataService {
  async createHabit(name: string, frequency = 'daily'): Promise<Habit> {
    if (name.length > 100) throw new Error('Habit name too long (max 100 characters)');

    const existing = await this.getHabitByName(name);
    if (existing) {
      throw new Error(`You already have a habit called "${existing.name}"`);
    }

    const userId = getCurrentUserId();

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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    const supaUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.frequency !== undefined) supaUpdates.cadence = updates.frequency;
    if (updates.active !== undefined) supaUpdates.is_active = updates.active;

    const { data, error } = await supabase
      .from('user_habits')
      .update(supaUpdates)
      .eq('id', id)
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    // Soft delete: archive instead of removing
    const { error } = await supabase
      .from('user_habits')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async completeHabit(habitId: string, date: string): Promise<HabitCompletion> {
    if (new Date(date) > new Date()) throw new Error('Cannot complete habit for future dates');

    const userId = getCurrentUserId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', userId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Habit not found');

    const { data, error } = await supabase
      .from('habit_completions')
      .upsert(
        {
          user_id: userId,
          habit_id: habitId,
          date,
        },
        { onConflict: 'habit_id,date' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      habitId: data.habit_id,
      date: data.date,
      completedAt: data.completed_at,
    };
  }

  async uncompleteHabit(habitId: string, date: string): Promise<void> {
    const userId = getCurrentUserId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', userId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Habit not found');

    const { error } = await supabase
      .from('habit_completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('date', date);

    if (error) throw new Error(error.message);
  }

  async getCompletions(
    habitId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HabitCompletion[]> {
    const userId = getCurrentUserId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', userId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Habit not found');

    let query = supabase
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((c) => ({
      id: c.id,
      habitId: c.habit_id,
      date: c.date,
      completedAt: c.completed_at,
    }));
  }

  async createMetric(
    name: string,
    inputType = 'scale',
    frequency = 'daily',
    scaleMin?: number,
    scaleMax?: number,
  ): Promise<TrackedMetric> {
    const userId = getCurrentUserId();

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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', userId)
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
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', name)
      .limit(1);

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
    const userId = getCurrentUserId();
    const { error } = await supabase.from('metrics').delete().eq('id', id).eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const userId = getCurrentUserId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('metrics')
      .select('id')
      .eq('id', metricId)
      .eq('user_id', userId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Metric not found');

    const { data, error } = await supabase
      .from('user_metric_entries')
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
      loggedAt: data.created_at,
    };
  }

  async getMetricEntries(
    metricId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MetricEntry[]> {
    const userId = getCurrentUserId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('metrics')
      .select('id')
      .eq('id', metricId)
      .eq('user_id', userId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Metric not found');

    let query = supabase
      .from('user_metric_entries')
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
      loggedAt: e.created_at,
    }));
  }

  async createJournalEntry(
    content: string,
    mood?: string,
    themes?: string[],
  ): Promise<JournalEntry> {
    const userId = getCurrentUserId();

    // Encrypt content before storing (client-side encryption for privacy)
    const encryptedContent = await encryptJournal(content, userId);

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        date: todayStr(),
        response: encryptedContent,
        prompt: themes?.join(', ') || null,
        input_mode: 'text',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      content, // Return original plaintext to caller
      mood,
      themes,
      date: data.date,
      createdAt: data.created_at,
    };
  }

  async getJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    const userId = getCurrentUserId();
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Decrypt each journal entry's response field
    return Promise.all(
      (data || []).map(async (j) => {
        let content: string;
        try {
          // Try to decrypt; if it fails, treat as unencrypted plaintext
          content = await decryptJournal(j.response, userId);
        } catch {
          // Fallback for unencrypted entries (for backward compatibility)
          content = j.response;
        }
        return {
          id: j.id,
          content,
          mood: undefined,
          themes: j.prompt ? j.prompt.split(', ') : undefined,
          date: j.date,
          createdAt: j.created_at,
        };
      }),
    );
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

    return {
      habit,
      completionsThisPeriod: completions.length,
      totalDaysInPeriod: daysBack,
      completionRate: (completions.length / daysBack) * 100,
      currentStreak: 0,
      longestStreak: 0,
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
    if (new Date(date) > new Date()) throw new Error('Cannot save check-in for future dates');
    const userId = getCurrentUserId();

    const moodToDb: Record<number, string> = {
      1: 'awful',
      2: 'unhappy',
      3: 'okay',
      4: 'calm',
      5: 'joyful',
    };
    const stressToDb: Record<number, string> = {
      1: 'high',
      2: 'high',
      3: 'moderate',
      4: 'low',
      5: 'low',
    };

    const { data: row, error } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          user_id: userId,
          date,
          sleep_quality: data.sleep,
          mood: data.mood != null ? (moodToDb[data.mood] ?? String(data.mood)) : null,
          energy_level: data.energy,
          stress_level:
            data.stress != null ? (stressToDb[data.stress] ?? String(data.stress)) : null,
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
      mood: moodFromDb[row.mood] ?? null,
      energy: row.energy_level,
      stress: stressFromDb[row.stress_level] ?? null,
      createdAt: row.created_at,
    };
  }

  async getCheckIn(date: string): Promise<CheckInRecord | null> {
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      date: data.date,
      sleep: data.sleep_quality,
      mood: moodFromDb[data.mood] ?? null,
      energy: data.energy_level,
      stress: stressFromDb[data.stress_level] ?? null,
      createdAt: data.created_at,
    };
  }

  async getCheckIns(startDate: string, endDate: string): Promise<CheckInRecord[]> {
    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      sleep: row.sleep_quality,
      mood: moodFromDb[row.mood] ?? null,
      energy: row.energy_level,
      stress: stressFromDb[row.stress_level] ?? null,
      createdAt: row.created_at,
    }));
  }

  async getAllCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]> {
    // Filter by user ownership: get user's habit IDs first, then filter completions
    const userId = getCurrentUserId();
    const { data: userHabits } = await supabase
      .from('user_habits')
      .select('id')
      .eq('user_id', userId);
    const habitIds = (userHabits ?? []).map((h) => h.id);
    if (habitIds.length === 0) return [];

    const { data, error } = await supabase
      .from('habit_completions')
      .select('*')
      .in('habit_id', habitIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((c) => ({
      id: c.id,
      habitId: c.habit_id,
      date: c.date,
      completedAt: c.completed_at,
    }));
  }

  async saveFocusSession(
    habitId: string | null,
    durationMinutes: number,
    actualMinutes: number | null,
    startedAt: string,
  ): Promise<FocusSession> {
    const userId = getCurrentUserId();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        habit_id: habitId,
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
      habitId: data.habit_id ?? null,
      durationMinutes: data.duration_minutes,
      actualMinutes: data.actual_minutes ?? null,
      status: data.status,
      startedAt: data.started_at,
    };
  }

  async getFocusSessions(startDate?: string, endDate?: string): Promise<FocusSession[]> {
    const userId = getCurrentUserId();
    let query = supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (startDate) query = query.gte('started_at', startDate);
    if (endDate) query = query.lte('started_at', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((s) => ({
      id: s.id,
      habitId: s.habit_id ?? null,
      durationMinutes: s.duration_minutes,
      actualMinutes: s.actual_minutes ?? null,
      status: s.status,
      startedAt: s.started_at,
    }));
  }

  async clearData(): Promise<void> {
    const userId = getCurrentUserId();

    // Delete in dependency order: children first, then parents
    const tables = [
      { table: 'habit_completions', fk: 'habit_id', via: 'user_habits' },
      { table: 'focus_sessions', column: 'user_id' },
      { table: 'journal_entries', column: 'user_id' },
      { table: 'daily_checkins', column: 'user_id' },
      { table: 'metric_entries', fk: 'metric_id', via: 'metrics' },
      { table: 'entries', fk: 'metric_id', via: 'metrics' },
      { table: 'reflections', column: 'user_id' },
      { table: 'reflection_configs', column: 'user_id' },
      { table: 'affirmations', column: 'user_id' },
      { table: 'metrics', column: 'user_id' },
      { table: 'user_habits', column: 'user_id' },
      { table: 'user_preferences', column: 'user_id' },
      { table: 'onboarding_states', column: 'user_id' },
    ] as const;

    for (const spec of tables) {
      if ('column' in spec && spec.column) {
        const { error } = await supabase.from(spec.table).delete().eq(spec.column, userId);
        if (error) {
          console.warn(`[clearData] Failed to delete from ${spec.table}:`, error.message);
        }
      } else if ('via' in spec && spec.via) {
        // For child tables that reference a parent owned by the user,
        // fetch parent IDs first, then delete children
        const { data: parentRows } = await supabase
          .from(spec.via)
          .select('id')
          .eq('user_id', userId);
        const parentIds = (parentRows ?? []).map((r) => r.id);
        if (parentIds.length > 0) {
          const { error } = await supabase.from(spec.table).delete().in(spec.fk, parentIds);
          if (error) {
            console.warn(`[clearData] Failed to delete from ${spec.table}:`, error.message);
          }
        }
      }
    }
  }
}

// Singleton instance
export const supabaseDataService = new SupabaseDataService();
