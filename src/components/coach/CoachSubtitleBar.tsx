import { useEffect, useRef, useState } from 'react';
import { SubtitleBar } from '@/components/ui/SubtitleBar';
import { useCoachTranscripts, useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useVoiceStore } from '@/stores/voiceStore';

export function CoachSubtitleBar() {
  const session = useCoachVoice();
  const isListening = session?.voiceState === 'listening';
  const { voiceOn, micOn } = useDualButtonControls();
  // UX-26 State 4: opening line only, then silent.
  const textOnly = !voiceOn && !micOn;
  const [busText, setBusText] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);

  // Fallback: Soniox interim writes useVoiceStore.interim directly in
  // useCoachChat, so the store always reflects the latest user partial.
  const interim = useVoiceStore((s) => s.interim);

  // Sticky per screen — a mode flip must not re-open the gate.
  const openerDoneRef = useRef(false);
  useEffect(() => {
    openerDoneRef.current = false;
  }, [session?.currentScreenId]);

  useCoachTranscripts((evt) => {
    if (!evt.text) return;
    if (textOnly && openerDoneRef.current) return;
    setBusText(evt.text);
    if (evt.role === 'assistant' && evt.kind === 'final') {
      openerDoneRef.current = true;
    }
  });

  const latestText = interim && isListening ? interim : busText;
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
