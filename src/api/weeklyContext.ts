/**
 * Client fetch wrapper for The Weekly's context endpoint. Mirrors the shape
 * of src/api/checkinTool.ts / src/api/reflectionSettings.ts.
 */
import { apiGet } from './client';

export interface WeeklyGridRow {
  name: string;
  cells: Array<'done' | 'missed' | 'gap' | 'off'>;
  done: number;
  scheduled: number;
}

export interface WeeklyGridPayload {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  rows: WeeklyGridRow[];
}

export interface WeeklyContextResponse {
  block: string;
  grid: WeeklyGridPayload;
  thinData: boolean;
  weekNumber: number;
  weeklyDay: number;
  alreadyRanThisWeek: boolean;
}

export function fetchWeeklyContext(): Promise<WeeklyContextResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiGet<WeeklyContextResponse>(
    `/api/weekly/context?timezone=${encodeURIComponent(timezone)}`,
  );
}
