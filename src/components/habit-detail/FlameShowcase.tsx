import { Check } from 'lucide-react';
import { useState } from 'react';
import { FlameMark, type FlameSize } from './FlameMark';
import { StreakFlame } from './StreakFlame';

// Standalone playground for the streak flame. Route: /flame-showcase.
// Shows every size, both resting states, the count variants, and interactive
// rows where tapping the check fires the Stage 2 celebration (burst + +1 + count
// bump). Not part of the app shell, just a place to see and tune the component.

const SIZES: FlameSize[] = ['sm', 'md', 'lg'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-content-tertiary">{title}</h2>
      {children}
    </section>
  );
}

function MarkRow({ name, start }: { name: string; start: number }) {
  const [streak, setStreak] = useState(start);
  const [done, setDone] = useState(false);

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-content">{name}</p>
        <p className="text-xs text-content-tertiary">
          {start === 0 ? 'starts a new streak' : `continues from ${start}`}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <StreakFlame streak={streak} size="md" celebrateOnIncrement />
        <button
          type="button"
          aria-label="mark done"
          disabled={done}
          onClick={() => {
            setStreak((s) => s + 1);
            setDone(true);
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90 ${
            done ? 'bg-success/40' : 'bg-success'
          }`}
        >
          <Check size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}

export function FlameShowcase() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="mx-auto min-h-screen max-w-[520px] space-y-4 bg-surface-secondary/40 p-5">
      <header>
        <h1 className="text-xl font-bold text-content">Streak flame</h1>
        <p className="mt-1 text-sm text-content-tertiary">
          FlameMark (graphic) and StreakFlame (graphic plus count). Tap a check to fire the
          celebration.
        </p>
      </header>

      <Section title="Sizes, both states">
        <div className="space-y-4">
          {SIZES.map((size) => (
            <div key={size} className="flex items-center gap-6">
              <span className="w-8 text-xs font-bold uppercase text-content-tertiary">{size}</span>
              <div className="flex items-center gap-2">
                <FlameMark lit size={size} />
                <span className="text-xs text-content-tertiary">lit</span>
              </div>
              <div className="flex items-center gap-2">
                <FlameMark lit={false} size={size} />
                <span className="text-xs text-content-tertiary">zero</span>
              </div>
              <div className="flex items-center gap-2">
                <StreakFlame streak={7} size={size} />
                <StreakFlame streak={0} size={size} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Counts">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {[0, 1, 3, 7, 14, 30, 100].map((n) => (
            <StreakFlame key={n} streak={n} size="md" />
          ))}
        </div>
      </Section>

      <Section title="Mark it done (live celebration)">
        <div className="space-y-3">
          <MarkRow key={`mind-${resetKey}`} name="Morning mindfulness" start={0} />
          <MarkRow key={`walk-${resetKey}`} name="Afternoon walk" start={12} />
        </div>
        <button
          type="button"
          onClick={() => setResetKey((k) => k + 1)}
          className="mt-4 text-xs font-semibold text-primary underline"
        >
          reset rows
        </button>
      </Section>
    </div>
  );
}
