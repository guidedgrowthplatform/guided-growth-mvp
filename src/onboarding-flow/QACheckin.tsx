import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckinFlowOverlay } from '@/components/home/CheckinFlowOverlay';
import {
  type CheckinScreenId,
  CoachChatProvider,
  useCoachChatLauncher,
} from '@/contexts/CoachChatContext';
import { CoachVoiceProvider } from '@/contexts/CoachVoiceProvider';
import type { CheckinFlowId } from '@/onboarding-flow/useCheckinFlow';

/**
 * QA-only direct entry to a check-in: the real beat-engine overlay (the same path
 * that ships, where the recorded MP3 openers play). Reached from the QA Control
 * launcher after the mic grant.
 *
 * It renders CheckinFlowOverlay standalone, inside the same providers Layout uses,
 * so it does NOT depend on the home screen or the onboarding gate (a fresh or
 * mid-onboarding test user reaches it without bouncing to onboarding). Marking the
 * open screen as MCHECK-01 / ECHECK-01 keeps CoachVoiceProvider's own session OFF
 * (engine check-ins own their voice loop), so there is no dual mic/session.
 */
const CONFIG: Record<'morning' | 'evening', { flowId: CheckinFlowId; screenId: CheckinScreenId }> =
  {
    morning: { flowId: 'morning-checkin-v1', screenId: 'MCHECK-01' },
    evening: { flowId: 'evening-checkin-v1', screenId: 'ECHECK-01' },
  };

function QACheckinInner({ type }: { type: 'morning' | 'evening' }) {
  const navigate = useNavigate();
  const { openCoachChat } = useCoachChatLauncher();
  const { flowId, screenId } = CONFIG[type];

  useEffect(() => {
    openCoachChat(screenId, { initiateCheckin: true });
  }, [openCoachChat, screenId]);

  return (
    <CheckinFlowOverlay
      flowId={flowId}
      alreadyDone={false}
      onClose={() => navigate('/onboarding/qa')}
      showVoiceControls
    />
  );
}

export function QACheckin({ type }: { type: 'morning' | 'evening' }) {
  return (
    <CoachChatProvider>
      <CoachVoiceProvider>
        <QACheckinInner type={type} />
      </CoachVoiceProvider>
    </CoachChatProvider>
  );
}

export default QACheckin;
