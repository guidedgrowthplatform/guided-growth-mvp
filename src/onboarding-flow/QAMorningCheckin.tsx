import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckinFlowOverlay } from '@/components/home/CheckinFlowOverlay';
import { CoachChatProvider, useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { CoachVoiceProvider } from '@/contexts/CoachVoiceProvider';

/**
 * QA-only direct entry to the MORNING check-in: the real beat-engine overlay (the
 * same path that ships, where the recorded MP3 openers play). Reached from the QA
 * Control "Morning check-in" launcher after the mic grant.
 *
 * It renders CheckinFlowOverlay standalone, inside the same providers Layout uses,
 * so it does NOT depend on the home screen or the onboarding gate (a fresh or
 * mid-onboarding test user reaches it without bouncing to onboarding). Marking the
 * open screen as MCHECK-01 keeps CoachVoiceProvider's own session OFF (engine
 * check-ins own their voice loop), so there is no dual mic/session.
 */
function QAMorningInner() {
  const navigate = useNavigate();
  const { openCoachChat } = useCoachChatLauncher();

  useEffect(() => {
    openCoachChat('MCHECK-01', { initiateCheckin: true });
  }, [openCoachChat]);

  return (
    <CheckinFlowOverlay
      flowId="morning-checkin-v1"
      alreadyDone={false}
      onClose={() => navigate('/onboarding/qa')}
      showVoiceControls
    />
  );
}

export function QAMorningCheckin() {
  return (
    <CoachChatProvider>
      <CoachVoiceProvider>
        <QAMorningInner />
      </CoachVoiceProvider>
    </CoachChatProvider>
  );
}

export default QAMorningCheckin;
