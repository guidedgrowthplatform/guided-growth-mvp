/**
 * Check-in flow persistence: routes a beat's tool to the check-in save path
 * (record_checkin -> daily_checkins), parallel to onboarding's step save.
 *
 * Built here; injected at the home morning-card entry point (Milestone 2).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { recordCheckinTool } from '@/api/checkinTool';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query/keys';
import { Sentry } from '@/lib/sentry';
import type { CheckInData, OnboardingStepData } from '@gg/shared/types';
import type { FlowPersistence } from './persistence';

export function useCheckinFlowPersistence(
  onComplete?: (finalData?: Partial<OnboardingStepData>) => void,
): FlowPersistence {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { logEvent } = useSessionLog();

  return useMemo<FlowPersistence>(
    () => ({
      // Check-in beats carry no onboarding step.
      saveStep: () => {},
      complete: (finalData) => {
        onComplete?.(finalData);
      },
      saveTool: (toolName, data) => {
        if (toolName !== 'record_checkin') {
          Sentry.captureException(new Error(`checkin saveTool: unmapped tool ${toolName}`));
          return;
        }
        const args = (data as { checkin?: Partial<CheckInData> }).checkin ?? {};
        // Optimistic: the beat already advanced; fire-and-forget the write.
        recordCheckinTool(args)
          .then(() => {
            qc.invalidateQueries({ queryKey: queryKeys.checkins.all });
            logEvent('checkin_completed', {
              type: 'morning',
              via: 'tap',
              sleep: args.sleep ?? undefined,
              mood: args.mood ?? undefined,
              energy: args.energy ?? undefined,
              stress: args.stress ?? undefined,
            });
          })
          .catch((err) => {
            Sentry.captureException(err);
            addToast('error', "Couldn't save your check-in just now.");
          });
      },
    }),
    [qc, addToast, logEvent, onComplete],
  );
}
