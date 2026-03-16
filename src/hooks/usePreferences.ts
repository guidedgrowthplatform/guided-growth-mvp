import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ViewMode, SpreadsheetRange } from '@shared/types';
import * as prefsApi from '@/api/preferences';
import { queryKeys } from '@/lib/query';

const defaultPrefs = {
  default_view: 'spreadsheet' as ViewMode,
  spreadsheet_range: (window.innerWidth < 768 ? 'week' : 'month') as SpreadsheetRange,
};

export function usePreferences() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.preferences.all,
    queryFn: prefsApi.fetchPreferences,
    placeholderData: defaultPrefs,
  });

  const defaultView = data?.default_view ?? defaultPrefs.default_view;
  const spreadsheetRange = data?.spreadsheet_range ?? defaultPrefs.spreadsheet_range;
  const loaded = !isLoading;

  const saveView = useCallback((view: ViewMode) => {
    qc.setQueryData(queryKeys.preferences.all, (old: any) => ({ ...old, default_view: view }));
    prefsApi.savePreferences({ default_view: view }).catch(() => {});
  }, [qc]);

  const saveRange = useCallback((range: SpreadsheetRange) => {
    qc.setQueryData(queryKeys.preferences.all, (old: any) => ({ ...old, spreadsheet_range: range }));
    prefsApi.savePreferences({ spreadsheet_range: range }).catch(() => {});
  }, [qc]);

  return { defaultView, spreadsheetRange, loaded, saveView, saveRange };
}
