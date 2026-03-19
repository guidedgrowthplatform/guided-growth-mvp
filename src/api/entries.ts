import { getDataService } from '@/lib/services/service-provider';
import type { EntriesMap, DayEntries } from '@shared/types';
import { apiGet, apiPut } from './client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const useSupabase = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

async function buildEntriesFromDataService(start: string, end: string): Promise<EntriesMap> {
  const ds = await getDataService();
  const habits = await ds.getHabits();
  const entries: EntriesMap = {};

  for (const habit of habits) {
    const completions = await ds.getCompletions(habit.id, start, end);
    for (const c of completions) {
      if (!entries[c.date]) entries[c.date] = {};
      entries[c.date][habit.id] = 'yes';
    }
  }
  return entries;
}

async function saveEntriesToDataService(date: string, dayEntries: DayEntries): Promise<void> {
  const ds = await getDataService();
  // Import supabase directly for uncomplete operations
  const { supabase } = await import('@/lib/supabase');

  for (const [metricId, value] of Object.entries(dayEntries)) {
    try {
      if (value === 'yes' || value === '1' || value === 'true') {
        await ds.completeHabit(metricId, date);
      } else {
        // Toggle OFF — delete the completion row
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('user_habit_id', metricId)
          .eq('date', date);
        if (error) console.error('[Entries] Delete completion error:', error);
      }
    } catch (err) {
      console.error('[Entries] Save entry error:', metricId, err);
    }
  }
}

export async function fetchEntries(start: string, end: string): Promise<EntriesMap> {
  if (useSupabase) {
    return buildEntriesFromDataService(start, end);
  }
  try {
    return await apiGet<EntriesMap>(`/api/entries?start=${start}&end=${end}`);
  } catch {
    return buildEntriesFromDataService(start, end);
  }
}

export async function saveEntries(date: string, dayEntries: DayEntries): Promise<void> {
  if (useSupabase) {
    return saveEntriesToDataService(date, dayEntries);
  }
  try {
    await apiPut(`/api/entries/${date}`, dayEntries);
  } catch {
    await saveEntriesToDataService(date, dayEntries);
  }
}

export async function saveBulkEntries(entriesMap: EntriesMap): Promise<void> {
  if (useSupabase) {
    for (const [date, dayEntries] of Object.entries(entriesMap)) {
      await saveEntriesToDataService(date, dayEntries);
    }
    return;
  }
  try {
    await apiPut('/api/entries/bulk', entriesMap);
  } catch {
    for (const [date, dayEntries] of Object.entries(entriesMap)) {
      await saveEntriesToDataService(date, dayEntries);
    }
  }
}
