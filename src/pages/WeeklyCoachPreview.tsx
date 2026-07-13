import { Icon } from '@iconify/react';
import { useState } from 'react';

// Standalone, auth-free design mock of the Weekly Coach ("The Weekly"): a
// coach-led review of the week shown as a chat moment -- the week grid
// (habits x 7 days, streak flames), a coach reading of what landed, and a
// forward focus. A toggle flips between a strong week (p78) and the gaps frame
// ("a reassess is still a win"), per handoff-weekly-projection-rules.md.
// Route /__weekly-coach. Mock only.

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface HabitWeek {
  name: string;
  cells: boolean[]; // 7, filled or not
  streak: number;
}

const STRONG: HabitWeek[] = [
  { name: 'Morning walk', cells: [true, true, true, true, true, false, true], streak: 5 },
  { name: 'Evening reset', cells: [true, true, false, true, true, true, true], streak: 4 },
  { name: 'Journal', cells: [true, false, true, true, false, true, true], streak: 2 },
];

const GAPS: HabitWeek[] = [
  { name: 'Morning walk', cells: [true, false, false, true, false, false, false], streak: 0 },
  { name: 'Evening reset', cells: [false, true, false, false, false, false, true], streak: 0 },
  { name: 'Journal', cells: [false, false, false, true, false, false, false], streak: 0 },
];

function fillRate(habits: HabitWeek[]): number {
  const total = habits.length * 7;
  const filled = habits.reduce((s, h) => s + h.cells.filter(Boolean).length, 0);
  return Math.round((filled / total) * 100);
}

function WeekGrid({ habits }: { habits: HabitWeek[] }) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card">
      <div className="mb-3 grid grid-cols-[1fr_repeat(7,minmax(0,1fr))_auto] items-center gap-1.5">
        <span />
        {DAYS.map((d, i) => (
          <span key={i} className="text-center text-[11px] font-bold text-content-tertiary">
            {d}
          </span>
        ))}
        <span className="w-6" />
      </div>
      <div className="flex flex-col gap-2.5">
        {habits.map((h) => (
          <div
            key={h.name}
            className="grid grid-cols-[1fr_repeat(7,minmax(0,1fr))_auto] items-center gap-1.5"
          >
            <span className="truncate pr-1 text-xs font-semibold text-content">{h.name}</span>
            {h.cells.map((on, i) => (
              <span
                key={i}
                className={`mx-auto h-6 w-6 rounded-lg ${on ? 'bg-primary' : 'bg-primary-bg'}`}
              />
            ))}
            <span className="flex w-6 items-center justify-end gap-0.5">
              {h.streak > 0 ? (
                <>
                  <Icon icon="ph:fire-fill" width={13} className="text-amber-500" />
                  <span className="text-xs font-bold text-content">{h.streak}</span>
                </>
              ) : (
                <span className="text-xs font-medium text-content-tertiary">–</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon icon="ph:sparkle-fill" width={18} className="text-primary" />
      </div>
      <div className="max-w-[280px] rounded-2xl rounded-tl-md bg-surface p-4 text-sm leading-relaxed text-content shadow-card">
        {children}
      </div>
    </div>
  );
}

export function WeeklyCoachPreview() {
  const [frame, setFrame] = useState<'strong' | 'gaps'>('strong');
  const habits = frame === 'strong' ? STRONG : GAPS;
  const rate = fillRate(habits);

  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-content">Your week</h1>
        <div className="flex gap-1 rounded-full bg-surface-secondary p-1">
          {(['strong', 'gaps'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrame(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                frame === f ? 'bg-surface text-content shadow-sm' : 'text-content-tertiary'
              }`}
            >
              {f === 'strong' ? 'Strong week' : 'Gaps week'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <CoachBubble>
          {frame === 'strong' ? (
            <>Here is how your week landed. You filled {rate}% of it, and your mornings held.</>
          ) : (
            <>A lighter week, {rate}% filled. That is real information, not a failure.</>
          )}
        </CoachBubble>

        <WeekGrid habits={habits} />

        {frame === 'strong' ? (
          <CoachBubble>
            What I notice: the morning walk is becoming automatic. The evening reset slips midweek.
            Next week, let us protect Wednesday evening.
          </CoachBubble>
        ) : (
          <CoachBubble>
            Two days stayed empty and the streaks reset. A reassess is still a win. Let us pick one
            habit to carry, and drop the rest for now.
          </CoachBubble>
        )}

        <button
          type="button"
          className="w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
        >
          {frame === 'strong' ? 'Set next week’s focus' : 'Choose one to carry'}
        </button>
      </div>
    </div>
  );
}
