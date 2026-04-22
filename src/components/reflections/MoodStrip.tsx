import { track } from '@/lib/analytics';
import { MOOD_PRESETS } from './constants';

interface MoodStripProps {
  value: string | null;
  onChange: (mood: string | null) => void;
  label?: string;
}

export function MoodStrip({ value, onChange, label = 'How are you feeling?' }: MoodStripProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-content">{label}</p>
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        {MOOD_PRESETS.map((mood) => {
          const selected = value === mood.key;
          return (
            <button
              key={mood.key}
              type="button"
              onClick={() => {
                const next = selected ? null : mood.key;
                if (next) track('mood_selected', { mood: next });
                onChange(next);
              }}
              aria-pressed={selected}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-primary-light'
                  : 'border-border-light bg-surface-secondary text-content-secondary'
              }`}
            >
              <span className="text-base leading-none">{mood.emoji}</span>
              {mood.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
