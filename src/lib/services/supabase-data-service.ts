import type { UserPreferences, Affirmation, OnboardingState } from '@gg/shared/types';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../supabase';
import { encryptJournal, decryptJournal } from '../utils/journal-crypto';
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

function todayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentAnonId(): string {
  const anonId = useAuthStore.getState().anonId;
  if (anonId) return anonId;
  throw new Error('Not authenticated');
}

// crypto key — pre-025 ciphertext keyed off auth.users.id
function getCurrentAuthUserId(): string {
  const user = useAuthStore.getState().user;
  if (user?.id) return user.id;
  throw new Error('Not authenticated');
}

export class SupabaseDataService implements DataService {
  async createHabit(
    name: string,
    frequency = 'daily',
    scheduleDays?: number[],
    habitType: HabitType = 'binary_do',
  ): Promise<Habit> {
    if (name.length > 100) throw new Error('Habit name too long (max 100 characters)');

    const existing = await this.getHabitByName(name);
    if (existing) {
      throw new Error(`You already have a habit called "${existing.name}"`);
    }

    const anonId = getCurrentAnonId();

    const { data, error } = await supabase
      .from('user_habits')
      .insert({
        anon_id: anonId,
        name,
        habit_type: habitType,
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
        schedule_days: scheduleDays ?? null,
        is_active: true,
        sort_order: 9999,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      scheduleDays: data.schedule_days ?? null,
      habitType: (data.habit_type as HabitType) ?? 'binary_do',
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async getHabits(): Promise<Habit[]> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('anon_id', anonId)
      .eq('is_active', true)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.cadence,
      scheduleDays: h.schedule_days ?? null,
      habitType: (h.habit_type as HabitType) ?? 'binary_do',
      createdAt: h.created_at,
      active: h.is_active,
    }));
  }

  async getAllHabits(): Promise<Habit[]> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('anon_id', anonId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.cadence,
      scheduleDays: h.schedule_days ?? null,
      habitType: (h.habit_type as HabitType) ?? 'binary_do',
      createdAt: h.created_at,
      active: h.is_active,
    }));
  }

  async getHabitById(id: string): Promise<Habit | null> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('id', id)
      .eq('anon_id', anonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      scheduleDays: data.schedule_days ?? null,
      habitType: (data.habit_type as HabitType) ?? 'binary_do',
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async getHabitByName(name: string): Promise<Habit | null> {
    const anonId = getCurrentAnonId();
    // Exact case-insensitive match. Used by createHabit() for the
    // duplicate-blocker, which must be strict (substring would block
    // "Run" because "Running" exists). Voice dispatchers that need
    // fuzzy matching should call findHabitFuzzy() instead.
    const { data, error } = await supabase
      .from('user_habits')
      .select('*')
      .eq('anon_id', anonId)
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
      scheduleDays: row.schedule_days ?? null,
      habitType: (row.habit_type as HabitType) ?? 'binary_do',
      createdAt: row.created_at,
      active: row.is_active,
    };
  }

  async updateHabit(
    id: string,
    updates: Partial<Pick<Habit, 'name' | 'frequency' | 'active'>>,
  ): Promise<Habit> {
    const anonId = getCurrentAnonId();
    const supaUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) supaUpdates.name = updates.name;
    if (updates.frequency !== undefined) supaUpdates.cadence = updates.frequency;
    if (updates.active !== undefined) supaUpdates.is_active = updates.active;

    const { data, error } = await supabase
      .from('user_habits')
      .update(supaUpdates)
      .eq('id', id)
      .eq('anon_id', anonId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      frequency: data.cadence,
      scheduleDays: data.schedule_days ?? null,
      habitType: (data.habit_type as HabitType) ?? 'binary_do',
      createdAt: data.created_at,
      active: data.is_active,
    };
  }

  async deleteHabit(id: string): Promise<void> {
    const anonId = getCurrentAnonId();
    // Soft delete: archive instead of removing
    const { error } = await supabase
      .from('user_habits')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('anon_id', anonId);

    if (error) throw new Error(error.message);
  }

  async completeHabit(habitId: string, date: string): Promise<HabitCompletion> {
    if (date > todayStr()) throw new Error('Cannot complete habit for future dates');

    const anonId = getCurrentAnonId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('anon_id', anonId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Habit not found');

    const { data, error } = await supabase
      .from('habit_completions')
      .upsert(
        {
          anon_id: anonId,
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
    const anonId = getCurrentAnonId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('anon_id', anonId)
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
    const anonId = getCurrentAnonId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('user_habits')
      .select('id')
      .eq('id', habitId)
      .eq('anon_id', anonId)
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
    const anonId = getCurrentAnonId();

    const { data, error } = await supabase
      .from('metrics')
      .insert({
        anon_id: anonId,
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
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('anon_id', anonId)
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
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('anon_id', anonId)
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
    const anonId = getCurrentAnonId();
    const { error } = await supabase.from('metrics').delete().eq('id', id).eq('anon_id', anonId);

    if (error) throw new Error(error.message);
  }

  async logMetric(metricId: string, value: number | string, date: string): Promise<MetricEntry> {
    const anonId = getCurrentAnonId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('metrics')
      .select('id')
      .eq('id', metricId)
      .eq('anon_id', anonId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Metric not found');

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
      loggedAt: data.created_at,
    };
  }

  async getMetricEntries(
    metricId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MetricEntry[]> {
    const anonId = getCurrentAnonId();
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('metrics')
      .select('id')
      .eq('id', metricId)
      .eq('anon_id', anonId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!ownerCheck) throw new Error('Metric not found');

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
      loggedAt: e.created_at,
    }));
  }

  async createJournalEntry(
    content: string,
    mood?: string,
    themes?: string[],
  ): Promise<JournalEntry> {
    const anonId = getCurrentAnonId();
    // crypto key — pre-025 ciphertext keyed off auth.users.id
    const cryptoKeyId = getCurrentAuthUserId();

    let storedContent: string;
    try {
      storedContent = await encryptJournal(content, cryptoKeyId);
    } catch (err) {
      console.warn('[Journal] Encryption failed, storing plaintext:', err);
      storedContent = content;
    }

    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .insert({ anon_id: anonId, type: 'freeform', date: todayStr() })
      .select()
      .single();
    if (entryErr) throw new Error(entryErr.message);

    const fields: { entry_id: string; field_key: string; content: string }[] = [
      { entry_id: entry.id, field_key: 'content', content: storedContent },
    ];
    if (mood) fields.push({ entry_id: entry.id, field_key: 'mood', content: mood });
    if (themes && themes.length > 0) {
      fields.push({ entry_id: entry.id, field_key: 'themes', content: themes.join(',') });
    }

    const { error: fieldsErr } = await supabase.from('journal_entry_fields').insert(fields);
    if (fieldsErr) {
      // compensating delete — no RPC available, best-effort orphan cleanup
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      throw new Error(fieldsErr.message);
    }

    return {
      id: entry.id,
      content,
      mood,
      themes,
      date: entry.date,
      createdAt: entry.created_at,
    };
  }

  async getJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
    const anonId = getCurrentAnonId();
    const cryptoKeyId = getCurrentAuthUserId();
    let query = supabase
      .from('journal_entries')
      .select('id, date, created_at, journal_entry_fields(field_key, content)')
      .eq('anon_id', anonId)
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return Promise.all(
      (data || []).map(async (j) => {
        const fieldsRows = (j.journal_entry_fields ?? []) as Array<{
          field_key: string;
          content: string;
        }>;
        const fields: Record<string, string> = {};
        for (const f of fieldsRows) fields[f.field_key] = f.content;

        let content = fields.content ?? '';
        try {
          if (content) content = await decryptJournal(content, cryptoKeyId);
        } catch {
          // ciphertext that fails decrypt — return as-is
        }
        return {
          id: j.id,
          content,
          mood: fields.mood,
          themes: fields.themes ? fields.themes.split(',').filter(Boolean) : undefined,
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
    if (date > todayStr()) throw new Error('Cannot save check-in for future dates');
    const anonId = getCurrentAnonId();

    const { data: row, error } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          anon_id: anonId,
          date,
          sleep: data.sleep,
          mood: data.mood,
          energy: data.energy,
          stress: data.stress,
        },
        { onConflict: 'anon_id,date' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: row.id,
      date: row.date,
      sleep: row.sleep,
      mood: row.mood,
      energy: row.energy,
      stress: row.stress,
      createdAt: row.created_at,
    };
  }

  async getCheckIn(date: string): Promise<CheckInRecord | null> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('anon_id', anonId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      date: data.date,
      sleep: data.sleep,
      mood: data.mood,
      energy: data.energy,
      stress: data.stress,
      createdAt: data.created_at,
    };
  }

  async getCheckIns(startDate: string, endDate: string): Promise<CheckInRecord[]> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('anon_id', anonId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      sleep: row.sleep,
      mood: row.mood,
      energy: row.energy,
      stress: row.stress,
      createdAt: row.created_at,
    }));
  }

  async getAllCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]> {
    const anonId = getCurrentAnonId();
    const { data: userHabits } = await supabase
      .from('user_habits')
      .select('id')
      .eq('anon_id', anonId);
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
    const anonId = getCurrentAnonId();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        anon_id: anonId,
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
    const anonId = getCurrentAnonId();
    let query = supabase
      .from('focus_sessions')
      .select('*')
      .eq('anon_id', anonId)
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

  async getPreferences(): Promise<UserPreferences | null> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data ?? null) as UserPreferences | null;
  }

  async upsertPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const anonId = getCurrentAnonId();
    const { id: _id, anon_id: _anonId, ...rest } = prefs as Record<string, unknown>;
    void _id;
    void _anonId;

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ anon_id: anonId, ...rest }, { onConflict: 'anon_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as UserPreferences;
  }

  async getCurrentAffirmation(): Promise<Affirmation | null> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('affirmations')
      .select('*')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return { id: data.id, anon_id: data.anon_id, value: data.value };
  }

  async upsertAffirmation(value: string): Promise<Affirmation> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('affirmations')
      .upsert({ anon_id: anonId, value }, { onConflict: 'anon_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id, anon_id: data.anon_id, value: data.value };
  }

  async getOnboardingState(): Promise<OnboardingState | null> {
    const anonId = getCurrentAnonId();
    const { data, error } = await supabase
      .from('onboarding_states')
      .select('*')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      anon_id: data.anon_id,
      path: data.path,
      status: data.status,
      current_step: data.current_step,
      data: data.data,
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getOnboardingProfile(): Promise<{
    name: string | null;
    nickname: string | null;
    image: string | null;
  } | null> {
    const authUserId = getCurrentAuthUserId();
    const { data, error } = await supabase
      .from('profiles')
      .select('name, nickname, image')
      .eq('id', authUserId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      name: data.name ?? null,
      nickname: data.nickname ?? null,
      image: data.image ?? null,
    };
  }

  async clearData(): Promise<void> {
    const anonId = getCurrentAnonId();

    // Delete in dependency order: children first, then parents
    const tables = [
      { table: 'habit_completions', fk: 'habit_id', via: 'user_habits' },
      { table: 'focus_sessions', column: 'anon_id' },
      { table: 'journal_entries', column: 'anon_id' },
      { table: 'daily_checkins', column: 'anon_id' },
      { table: 'metric_entries', fk: 'metric_id', via: 'metrics' },
      { table: 'entries', fk: 'metric_id', via: 'metrics' },
      { table: 'affirmations', column: 'anon_id' },
      { table: 'metrics', column: 'anon_id' },
      { table: 'user_habits', column: 'anon_id' },
      { table: 'user_preferences', column: 'anon_id' },
      { table: 'onboarding_states', column: 'anon_id' },
    ] as const;

    for (const spec of tables) {
      if ('column' in spec && spec.column) {
        const { error } = await supabase.from(spec.table).delete().eq(spec.column, anonId);
        if (error) {
          console.warn(`[clearData] Failed to delete from ${spec.table}:`, error.message);
        }
      } else if ('via' in spec && spec.via) {
        const { data: parentRows } = await supabase
          .from(spec.via)
          .select('id')
          .eq('anon_id', anonId);
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
