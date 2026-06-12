import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCoachTranscripts, useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useVoiceStore } from '@/stores/voiceStore';

type DisplayState = 'expanded' | 'collapsed' | 'closed';

const BAR_HEIGHT = 88;
const BAR_BOTTOM = 240;

// Mirrors OnboardingSubtitleBar's UI exactly. Shows the latest coach activity
// (user partial while Soniox is listening; assistant partial/final while/after
// the LLM responds) when the overlay is closed. Separate component so we
// don't touch onboarding's bar.
export function CoachSubtitleBar() {
  const session = useCoachVoice();
  const isListening = session?.voiceState === 'listening';
  const speaking = session?.speaking ?? false;
  const { voiceOn, micOn } = useDualButtonControls();
  // UX-26 State 4: opening line only, then silent.
  const textOnly = !voiceOn && !micOn;
  const [busText, setBusText] = useState<string>('');
  const [state, setState] = useState<DisplayState>('expanded');

  // Fallback path: Soniox interim writes useVoiceStore.interim directly in
  // useCoachChat. Even if the transcript bus has a gap, the store always
  // reflects the latest user partial.
  const interim = useVoiceStore((s) => s.interim);

  const openerDoneRef = useRef(false);
  useEffect(() => {
    openerDoneRef.current = false;
  }, [textOnly, session?.currentScreenId]);

  useCoachTranscripts((evt) => {
    if (!evt.text) return;
    if (textOnly && openerDoneRef.current) return;
    setBusText(evt.text);
    if (textOnly && evt.role === 'assistant' && evt.kind === 'final') {
      openerDoneRef.current = true;
    }
  });

  useEffect(() => {
    if (speaking || isListening) {
      setState((prev) => (prev === 'closed' ? 'closed' : 'expanded'));
    }
  }, [speaking, isListening]);

  // Live user interim wins while Soniox is hot; otherwise whatever last
  // landed on the bus (assistant or user final).
  const latestText = interim && isListening ? interim : busText;

  if (!latestText) return null;
  if (state === 'closed') return null;

  if (state === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setState('expanded')}
        aria-label="Show coach subtitle"
        style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
        className="fixed left-0 z-30 flex w-7 items-center justify-center rounded-r-2xl bg-surface-secondary text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
      className="fixed inset-x-4 z-30 flex items-center gap-2 rounded-2xl bg-surface-secondary px-3 pr-8 text-content shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
    >
      <button
        type="button"
        onClick={() => setState('collapsed')}
        aria-label="Collapse subtitle"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="line-clamp-2 flex-1 text-[15px] font-semibold leading-[20px]">{latestText}</p>
      <button
        type="button"
        onClick={() => setState('closed')}
        aria-label="Dismiss subtitle"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
