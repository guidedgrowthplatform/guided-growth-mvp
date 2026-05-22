import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useOnboardingVoice as useOnboardingVoiceSession,
  useOnboardingTranscripts,
} from '@/contexts/useOnboardingVoiceSession';

type DisplayState = 'expanded' | 'collapsed' | 'closed';

const BAR_HEIGHT = 88;
const BAR_BOTTOM = 240;

export function OnboardingSubtitleBar() {
  const session = useOnboardingVoiceSession();
  const status = session?.status ?? 'idle';
  const [latestText, setLatestText] = useState<string>('');
  const [state, setState] = useState<DisplayState>('expanded');

  useOnboardingTranscripts((evt) => setLatestText(evt.text));

  useEffect(() => {
    if (status === 'active') {
      setState((prev) => (prev === 'closed' ? 'closed' : 'expanded'));
    } else {
      setLatestText('');
    }
  }, [status]);

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
