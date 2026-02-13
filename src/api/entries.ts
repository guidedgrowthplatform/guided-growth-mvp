import { apiGet, apiPut } from './client';
import type { EntriesMap, DayEntries } from '@shared/types';

export async function fetchEntries(start: string, end: string): Promise<EntriesMap> {
  return apiGet<EntriesMap>(`/api/entries?start=${start}&end=${end}`);
}

export async function saveEntries(date: string, entries: DayEntries): Promise<void> {
  await apiPut(`/api/entries/${date}`, entries);
}

export async function saveBulkEntries(entriesMap: EntriesMap): Promise<void> {
  await apiPut('/api/entries/bulk', entriesMap);
}
