import { Icon } from '@iconify/react';
import { useState } from 'react';

// Screen Time · Moment 08 from the teardown: the reflection and coaching loop.
// The category stops at the number; GG is the only one that asks whether the
// number meant anything, by putting a kept/missed boundary beside the user's own
// words. It never claims the boundary caused the feeling; it asks "does this fit?"
// and treats "not really" as just as useful as "yes". Our UI/UX. Mock.

const MOODS = [
  { key: 'calmer', label: 'Calmer', icon: 'ph:wind-bold' },
  { key: 'tired', label: 'Tired', icon: 'ph:moon-stars-bold' },
  { key: 'restless', label: 'Restless', icon: 'ph:waveform-bold' },
];

const REPLY: Record<string, string> = {
  calmer:
    'Good to hear. I am not saying the boundary did that, only that they showed up together tonight. Worth keeping an eye on.',
  tired:
    'Thanks for being straight. Tired and kept can sit side by side. Does the 9pm boundary still feel like the right one, or too early?',
  restless:
    'That is useful, not a bad answer. Restless on a kept night tells me the boundary is not the whole story. Want to note what is underneath it?',
};

export function ReflectionCheckInPreview({ onBack }: { onBack?: () => void } = {}) {
  const [mood, setMood] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => onBack?.()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content"
        >
          <Icon icon="ic:round-chevron-left" width={22} />
        </button>
        <h1 className="text-[22px] font-semibold text-content">Evening check-in</h1>
      </div>

      <p className="mt-2 text-sm text-content-secondary">Quick note before anything else.</p>

      {/* The boundary status, stated plainly and without a score. */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <Icon icon="ph:seal-check-bold" width={24} className="shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-bold text-emerald-900">Late-night feeds boundary</p>
          <p className="text-sm text-emerald-700">Kept, 3rd evening running</p>
        </div>
      </div>

      {/* The reflection, in the user's own words. */}
      <div className="mt-6 rounded-3xl bg-surface p-6 shadow-card">
        <p className="text-base font-bold text-content">
          How are you feeling right now, in a word or two?
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {MOODS.map((m) => {
            const on = mood === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMood(m.key)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  on
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-light bg-surface text-content'
                }`}
              >
                <Icon icon={m.icon} width={18} />
                {m.label}
              </button>
            );
          })}
        </div>

        {mood && (
          <div className="mt-5 flex gap-3 border-t border-border-light pt-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon icon="ph:sparkle-bold" width={18} className="text-primary" />
            </div>
            <p className="text-sm leading-relaxed text-content">{REPLY[mood]}</p>
          </div>
        )}
      </div>

      {!mood && (
        <p className="mt-4 text-center text-xs text-content-tertiary">
          Tap a word above. There is no wrong answer here.
        </p>
      )}
    </div>
  );
}
