/**
 * WeeklyStoryDemo — a self-contained, auto-playing walkthrough of the whole
 * onboarding arc, at /weekly-projection-story. No voice, no API keys, no
 * dependency on the live capture file. It scripts the sequence with the REAL
 * components so you can watch the whole thing end to end:
 *   coach prompt -> you "talk" -> habits appear as cards -> days set ->
 *   coach handoff -> the weekly projection (empty -> green -> red + narration).
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { HabitScheduleCard } from '@/components/onboarding/HabitScheduleCard';
import { WeeklyProjection, type ProjectionHabit } from './WeeklyProjection';

type Phase = 'intro' | 'dump' | 'capture' | 'handoff' | 'projection';
const RANK: Record<Phase, number> = {
  intro: 0,
  dump: 1,
  capture: 2,
  handoff: 3,
  projection: 4,
};

// The habits the user captures in this scripted run (the 3 coach rituals get
// added on top inside WeeklyProjection).
const CAPTURED: ProjectionHabit[] = [
  { name: 'Meditate', polarity: 'positive', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Workout', polarity: 'positive', days: [1, 3, 5] },
  { name: 'Read 10 pages', polarity: 'positive', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'No phone in bed', polarity: 'negative', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Journal', polarity: 'positive', days: [1, 2, 3, 4, 5] },
];

const DUMP_TEXT =
  'Okay, I want to meditate every day, work out Monday Wednesday Friday, read ten pages a day, no phone in bed, and journal on weekdays.';

const noop = () => {};

function CoachBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-[1px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Sparkles size={14} />
      </span>
      <div className="max-w-[82%] rounded-[18px] rounded-tl-[4px] bg-surface-secondary px-4 py-2.5 text-[15px] leading-relaxed text-content">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto max-w-[82%] rounded-[18px] rounded-tr-[4px] bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-white">
      {children}
    </div>
  );
}

export function WeeklyStoryDemo() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [revealed, setRevealed] = useState(0);
  const [runId, setRunId] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('intro');
    setRevealed(0);
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(1600, () => setPhase('dump'));
    at(3600, () => setPhase('capture'));
    CAPTURED.forEach((_, k) => at(3600 + k * 650, () => setRevealed(k + 1)));
    at(7900, () => setPhase('handoff'));
    at(9700, () => setPhase('projection'));
    return () => timers.current.forEach(clearTimeout);
  }, [runId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [phase, revealed]);

  const rank = RANK[phase];

  return (
    <div className="bg-background flex min-h-screen w-screen justify-center">
      <div className="w-full max-w-[460px] px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-content-tertiary">
            Onboarding · build your week
          </span>
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-content"
          >
            Replay
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {rank >= RANK.intro && (
            <CoachBubble>
              Let's set up your week. Tell me the habits you want to build, or the ones you want to
              break.
            </CoachBubble>
          )}

          {rank >= RANK.dump && <UserBubble>{DUMP_TEXT}</UserBubble>}

          {rank >= RANK.capture && revealed > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-medium text-content-tertiary">
                {revealed < CAPTURED.length ? 'Catching your habits…' : 'Your habits'}
              </span>
              {CAPTURED.slice(0, revealed).map((h) => (
                <HabitScheduleCard
                  key={h.name}
                  habitName={h.name}
                  polarity={h.polarity === 'negative' ? 'break' : 'build'}
                  selectedDays={new Set(h.days)}
                  onChangePolarity={noop}
                  onToggleDay={noop}
                  onEdit={noop}
                />
              ))}
            </div>
          )}

          {rank >= RANK.handoff && (
            <CoachBubble>Nice. Here's your week, with your daily check-ins and reflection built in.</CoachBubble>
          )}

          {rank >= RANK.projection && (
            <div className="mt-1">
              <WeeklyProjection habits={CAPTURED} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
