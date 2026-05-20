import { getDataService } from '@/lib/services/service-provider';
import type { EntriesMap, DayEntries } from '@shared/types';

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

export function fetchEntries(start: string, end: string): Promise<EntriesMap> {
  return buildEntriesFromDataService(start, end);
}

export function saveEntries(date: string, dayEntries: DayEntries): Promise<void> {
  return saveEntriesToDataService(date, dayEntries);
}

export async function saveBulkEntries(entriesMap: EntriesMap): Promise<void> {
  for (const [date, dayEntries] of Object.entries(entriesMap)) {
    await saveEntriesToDataService(date, dayEntries);
  }
}
