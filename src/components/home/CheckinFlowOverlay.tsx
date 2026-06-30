import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { track } from '@/analytics';
import { OnboardingVoiceContext } from '@/contexts/useOnboardingVoiceSession';
import { useCheckinFlowPersistence } from '@/onboarding-flow/checkinPersistence';
import { FlowRenderer } from '@/onboarding-flow/renderer/FlowRenderer';
import { resolveCheckinOpeners } from '@/onboarding-flow/resolveCheckinOpeners';
import { useCheckinFlow, type CheckinFlowId } from '@/onboarding-flow/useCheckinFlow';
import { useFlowOrchestrator } from '@/onboarding-flow/useFlowOrchestrator';
import type { CheckInData } from '@gg/shared/types';
import { buildCheckinCompleteEvent, TYPE_FOR_FLOW } from './checkinCompleteEvent';
import { useCheckinVoice } from './useCheckinVoice';

interface CheckinFlowOverlayProps {
  flowId: CheckinFlowId;
  onClose: () => void;
  alreadyDone?: boolean;
}

export function CheckinFlowOverlay({
  flowId,
  onClose,
  alreadyDone = false,
}: CheckinFlowOverlayProps) {
  const type = TYPE_FOR_FLOW[flowId];
  const { flow, tag, problems } = useCheckinFlow(flowId);

  const resolvedFlow = useMemo(() => resolveCheckinOpeners(flow), [flow]);

  useEffect(() => {
    if (problems.length && import.meta.env.DEV) console.error('[checkin] invalid flow', problems);
  }, [problems]);

  const answersRef = useRef<Record<string, unknown>>({});
  const startedAtRef = useRef(Date.now());

  const handleComplete = useCallback(() => {
    const checkin = (answersRef.current.checkin ?? {}) as Partial<CheckInData>;
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    track('complete_checkin', buildCheckinCompleteEvent(type, checkin, alreadyDone, duration));
    onClose();
  }, [type, alreadyDone, onClose]);

  const persistence = useCheckinFlowPersistence(handleComplete, type);
  const orchestrator = useFlowOrchestrator(resolvedFlow, persistence, {
    flowTag: tag,
    serverSync: false,
  });

  useEffect(() => {
    answersRef.current = orchestrator.answers;
  }, [orchestrator.answers]);

  const { value: voiceValue } = useCheckinVoice(
    orchestrator.currentNode,
    orchestrator.answers.nickname ?? undefined,
    type === 'morning' ? 'MCHECK-01' : 'ECHECK-01',
  );

  return (
    <div
      className="fixed inset-0 z-[55] bg-gradient-to-b from-primary-bg via-primary to-primary-dark"
      role="dialog"
      aria-modal="true"
      aria-label="Check-in"
    >
      <button
        type="button"
        aria-label="Close check-in"
        onClick={onClose}
        className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-content shadow-card"
      >
        <Icon icon="ic:round-close" width={20} height={20} />
      </button>
      <OnboardingVoiceContext.Provider value={voiceValue}>
        <FlowRenderer orchestrator={orchestrator} variant="overlay" />
      </OnboardingVoiceContext.Provider>
    </div>
  );
}
