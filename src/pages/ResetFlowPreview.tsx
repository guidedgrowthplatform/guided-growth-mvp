import { Icon } from '@iconify/react';
import { useState } from 'react';
import { BreathCircle } from '@/components/reset/BreathCircle';
import { ResetTrackRow } from '@/components/reset/ResetTrackRow';

// Standalone, self-contained PREVIEW of the Reset Library as a coach-guided
// FLOW (intro -> recommend -> player -> close), built the same "own it fully,
// clickable, faithful UI" way the onboarding render is its own preview. Not the
// real /reset tab (that is ResetLibraryPage); this shows the coach-led vision.
// Reuses the real app tokens + the reset components. Mock only.

type Step = 'intro' | 'recommend' | 'player' | 'close';

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[280px] rounded-2xl rounded-tl-md bg-surface p-4 text-base font-medium text-content shadow-card">
      {children}
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border-light bg-surface px-4 py-2.5 text-sm font-bold text-content transition-shadow active:shadow-card-hover"
    >
      {label}
    </button>
  );
}

export function ResetFlowPreview() {
  const [step, setStep] = useState<Step>('intro');

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex items-center gap-2">
        <div className="size-2 rounded-full bg-primary" />
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-content-tertiary">
          Coach
        </span>
      </div>

      {step === 'intro' && (
        <div className="flex flex-col gap-6">
          <CoachBubble>Let&apos;s find you a reset. How much time do you have?</CoachBubble>
          <div className="flex flex-wrap gap-2.5">
            <Chip label="1 min" onClick={() => setStep('recommend')} />
            <Chip label="2 min" onClick={() => setStep('recommend')} />
            <Chip label="5 min" onClick={() => setStep('recommend')} />
            <Chip label="Sleep" onClick={() => setStep('recommend')} />
          </div>
        </div>
      )}

      {step === 'recommend' && (
        <div className="flex flex-col gap-6">
          <CoachBubble>Two minutes. Try Settle, it&apos;s the quick come-home.</CoachBubble>
          <div className="flex flex-col gap-2.5">
            <ResetTrackRow
              title="Settle"
              whatFor="Touch and breath. Your come-home."
              kind="guided"
              durationSec={120}
              paired
              onClick={() => setStep('player')}
            />
            <button
              type="button"
              onClick={() => setStep('player')}
              className="self-center py-2 text-sm font-medium text-content-secondary"
            >
              See all resets
            </button>
          </div>
        </div>
      )}

      {step === 'player' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <BreathCircle active />
          <div>
            <p className="text-xl font-bold text-content">Settle</p>
            <p className="mt-1 text-sm text-content-secondary">0:46 / 2:00</p>
          </div>
          <div className="flex items-center gap-8">
            <Icon
              icon="mingcute:rewind-backward-15-line"
              width={26}
              className="text-content-secondary"
            />
            <div className="flex size-16 items-center justify-center rounded-full bg-primary">
              <Icon icon="mingcute:pause-fill" width={28} className="text-white" />
            </div>
            <Icon
              icon="mingcute:rewind-forward-15-line"
              width={26}
              className="text-content-secondary"
            />
          </div>
          <button
            type="button"
            onClick={() => setStep('close')}
            className="mt-2 text-sm font-medium text-content-secondary"
          >
            Done
          </button>
        </div>
      )}

      {step === 'close' && (
        <div className="flex flex-col gap-6">
          <CoachBubble>How do you feel now?</CoachBubble>
          <div className="flex flex-wrap gap-2.5">
            <Chip label="Calmer" onClick={() => setStep('intro')} />
            <Chip label="About the same" onClick={() => setStep('intro')} />
            <Chip label="Still wound up" onClick={() => setStep('intro')} />
          </div>
          <p className="max-w-[280px] text-xs text-content-tertiary">
            Feeds the check-in state data, so The Weekly notices what actually helped.
          </p>
        </div>
      )}
    </div>
  );
}
