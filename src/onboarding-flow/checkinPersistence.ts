/**
 * Check-in flow persistence: routes a beat's tool to the check-in save path
 * (record_checkin -> daily_checkins), parallel to onboarding's step save.
 *
 * Built here; injected at the home morning-card entry point (Milestone 2).
 */
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo } from 'react';
import { completeHabitTool, logReflectionTool, recordCheckinTool } from '@/api/checkinTool';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query/keys';
import { Sentry } from '@/lib/sentry';
import type { CheckInRecord, HabitDayStatus } from '@/lib/services/data-service.interface';
import type { CheckInData, OnboardingStepData } from '@gg/shared/types';
import type { FlowPersistence } from './persistence';

export function useCheckinFlowPersistence(
  onComplete?: (finalData?: Partial<OnboardingStepData>) => void,
  type: 'morning' | 'evening' = 'morning',
): FlowPersistence {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { logEvent } = useSessionLog();

  return useMemo<FlowPersistence>(() => {
    const reportSaveError = (msg: string) => (err: unknown) => {
      Sentry.captureException(err);
      addToast('error', msg);
    };
    return {
      // Check-in beats carry no onboarding step.
      saveStep: () => {},
      complete: (finalData) => {
        onComplete?.(finalData);
      },
      // Fire-and-forget; the beat already advanced.
      saveTool: (toolName, data) => {
        if (toolName === 'record_checkin') {
          const args = (data as { checkin?: Partial<CheckInData> }).checkin ?? {};
          recordCheckinTool(args)
            .then((res) => {
              // Flip Home before the refetch; invalidate converges the full row.
              const today = format(new Date(), 'yyyy-MM-dd');
              qc.setQueryData<CheckInRecord | null>(queryKeys.checkins.byDate(today), (old) => ({
                id: old?.id ?? '',
                date: old?.date ?? res.result.date,
                createdAt: old?.createdAt ?? '',
                ...res.result.checkin,
              }));
              qc.invalidateQueries({ queryKey: queryKeys.checkins.all });
              logEvent('checkin_completed', {
                type,
                via: 'tap',
                sleep: args.sleep ?? undefined,
                mood: args.mood ?? undefined,
                energy: args.energy ?? undefined,
                stress: args.stress ?? undefined,
              });
            })
            .catch(reportSaveError("Couldn't save your check-in just now."));
          return;
        }

        if (toolName === 'complete_habit') {
          const statuses =
            (data as { habitStatuses?: Record<string, HabitDayStatus> }).habitStatuses ?? {};
          // Unmarked = miss; only a `done` records a win.
          const doneIds = Object.entries(statuses)
            .filter(([, s]) => s === 'done')
            .map(([id]) => id);
          if (doneIds.length === 0) return;
          // allSettled so a single failure still refreshes the ones that saved.
          Promise.allSettled(doneIds.map((id) => completeHabitTool(id))).then((results) => {
            qc.invalidateQueries({ queryKey: queryKeys.habits.all });
            const failed = results.find((r) => r.status === 'rejected');
            if (failed)
              reportSaveError("Couldn't save your habits just now.")(
                (failed as PromiseRejectedResult).reason,
              );
          });
          return;
        }

        if (toolName === 'log_reflection') {
          const text = (data as { reflectionText?: string }).reflectionText?.trim();
          if (!text) return;
          logReflectionTool(text)
            .then(() => logEvent('checkin_completed', { type, via: 'tap' }))
            .catch(reportSaveError("Couldn't save your reflection just now."));
          return;
        }

        Sentry.captureException(new Error(`checkin saveTool: unmapped tool ${toolName}`));
      },
    };
  }, [qc, addToast, logEvent, onComplete, type]);
}
