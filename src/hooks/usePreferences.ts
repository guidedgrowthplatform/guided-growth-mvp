import { useState, useEffect, useCallback } from 'react';
import type { ViewMode, SpreadsheetRange } from '@shared/types';
import * as prefsApi from '@/api/preferences';

export function usePreferences() {
  const [defaultView, setDefaultView] = useState<ViewMode>('spreadsheet');
  const [spreadsheetRange, setSpreadsheetRange] = useState<SpreadsheetRange>(
    window.innerWidth < 768 ? 'week' : 'month'
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    prefsApi.fetchPreferences().then((prefs) => {
      setDefaultView(prefs.default_view);
      setSpreadsheetRange(prefs.spreadsheet_range);
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  const saveView = useCallback((view: ViewMode) => {
    setDefaultView(view);
    prefsApi.savePreferences({ default_view: view }).catch(() => {});
  }, []);

  const saveRange = useCallback((range: SpreadsheetRange) => {
    setSpreadsheetRange(range);
    prefsApi.savePreferences({ spreadsheet_range: range }).catch(() => {});
  }, []);

  return { defaultView, spreadsheetRange, loaded, saveView, saveRange };
}
