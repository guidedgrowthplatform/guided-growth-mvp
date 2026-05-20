import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VoiceMessage } from '@/components/onboarding/OnboardingChatOverlay';

interface OnboardingSubtitleBarProps {
  messages: VoiceMessage[];
}

type DisplayState = 'expanded' | 'collapsed' | 'closed';

// Fixed-height caption bar (Google Meet style). Collapsed tab shares the
// bar's height + bottom anchor so the toggle never shifts vertically.
const BAR_HEIGHT = 88;
const BAR_BOTTOM = 240;

export function OnboardingSubtitleBar({ messages }: OnboardingSubtitleBarProps) {
  const lastAi = [...messages].reverse().find((m) => m.role === 'ai' && m.id !== 'prompt');
  const [state, setState] = useState<DisplayState>('expanded');

  useEffect(() => {
    if (lastAi) setState('expanded');
  }, [lastAi?.id]);

  if (!lastAi) return null;
  if (state === 'closed') return null;

  if (state === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setState('expanded')}
        aria-label="Show coach subtitle"
        style={{ bottom: BAR_BOTTOM, height: BAR_HEIGHT }}
        className="fixed left-0 z-30 flex w-7 items-center justify-center rounded-r-2xl bg-content/80 text-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]"
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
      className="fixed inset-x-4 z-30 flex items-center gap-2 rounded-2xl bg-content/80 px-3 pr-8 text-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => setState('collapsed')}
        aria-label="Collapse subtitle"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="line-clamp-2 flex-1 text-[15px] font-semibold leading-[20px]">{lastAi.text}</p>
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
