import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DayMetrics } from '@/components/calendar/calendarTypes';
import { queryKeys } from '@/lib/query';
import { getDataService } from '@/lib/services/service-provider';

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function useCalendarData(year: number, month: number) {
  const { start, end } = useMemo(() => monthRange(year, month), [year, month]);

  const {
    data: checkIns = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.checkins.range(start, end),
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getCheckIns(start, end);
    },
  });

  const calendarData = useMemo(() => {
    const result: Record<string, DayMetrics> = {};
    for (const ci of checkIns) {
      const hasData =
        ci.mood !== null || ci.sleep !== null || ci.energy !== null || ci.stress !== null;
      if (!hasData) continue;

      result[ci.date] = {
        ...(ci.mood !== null ? { mood: ci.mood } : {}),
        ...(ci.sleep !== null ? { sleep: ci.sleep } : {}),
        ...(ci.energy !== null ? { energy: ci.energy } : {}),
        ...(ci.stress !== null ? { stress: ci.stress } : {}),
      };
    }
    return result;
  }, [checkIns]);

  return {
    calendarData,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
