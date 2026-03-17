import { apiGet, apiPut } from './client';
import type { EntriesMap, DayEntries } from '@shared/types';
import { getDataService, useSupabase, AUTH_BYPASS } from '@/lib/services/service-provider';

// Use DataService when Supabase is active OR when auth is bypassed (mock mode)
const useDataService = useSupabase || AUTH_BYPASS;

async function buildEntriesFromDataService(start: string, end: string): Promise<EntriesMap> {
  const ds = await getDataService();
  const habits = await ds.getHabits();
  const entries: EntriesMap = {};

  // Batch fetch all completions in a single query instead of one per habit
  const habitIds = habits.map(h => h.id);
  const allCompletions = await ds.getCompletionsBatch(habitIds, start, end);

  for (const c of allCompletions) {
    if (!entries[c.date]) entries[c.date] = {};
    entries[c.date][c.habitId] = 'yes';
  }
  return entries;
}

async function saveEntriesToDataService(date: string, dayEntries: DayEntries): Promise<void> {
  const ds = await getDataService();
  
  for (const [metricId, value] of Object.entries(dayEntries)) {
    try {
      if (value === 'yes' || value === '1' || value === 'true') {
        await ds.completeHabit(metricId, date);
      } else {
        // Toggle OFF — delete the completion via DataService (not raw Supabase)
        await ds.uncompleteHabit(metricId, date);
      }
    } catch (err) {
      console.error('[Entries] Save entry error:', metricId, err);
    }
  }
}

export async function fetchEntries(start: string, end: string): Promise<EntriesMap> {
  if (useDataService) {
    return buildEntriesFromDataService(start, end);
  }
  try {
    return await apiGet<EntriesMap>(`/api/entries?start=${start}&end=${end}`);
  } catch {
    return buildEntriesFromDataService(start, end);
  }
}

export async function saveEntries(date: string, dayEntries: DayEntries): Promise<void> {
  if (useDataService) {
    return saveEntriesToDataService(date, dayEntries);
  }
  try {
    await apiPut(`/api/entries/${date}`, dayEntries);
  } catch {
    await saveEntriesToDataService(date, dayEntries);
  }
}

export async function saveBulkEntries(entriesMap: EntriesMap): Promise<void> {
  if (useDataService) {
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
