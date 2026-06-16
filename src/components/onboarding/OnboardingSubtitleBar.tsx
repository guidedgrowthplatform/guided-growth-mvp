import { useEffect, useState } from 'react';
import { SubtitleBar } from '@/components/ui/SubtitleBar';
import {
  useOnboardingVoice as useOnboardingVoiceSession,
  useOnboardingTranscripts,
} from '@/contexts/useOnboardingVoiceSession';

export function OnboardingSubtitleBar() {
  const session = useOnboardingVoiceSession();
  const status = session?.status ?? 'idle';
  // voice-in keeps Vapi idle but still produces coach replies.
  const voiceInActive = session?.voiceInListening ?? false;
  const [latestText, setLatestText] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);

  // Coach subtitle only — the bus now also carries voice-in user transcripts.
  useOnboardingTranscripts((evt) => {
    if (evt.role !== 'assistant') return;
    setLatestText(evt.text);
  });

  // Drop the subtitle only when neither Vapi nor voice-in is engaged.
  useEffect(() => {
    if (status !== 'active' && !voiceInActive) setLatestText('');
  }, [status, voiceInActive]);

  if (!latestText) return null;

  return (
    <SubtitleBar
      text={latestText}
      collapsed={collapsed}
      onCollapse={() => setCollapsed(true)}
      onExpand={() => setCollapsed(false)}
    />
  );
}
