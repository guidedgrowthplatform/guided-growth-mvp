import { useEffect, useState } from 'react';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { classifyHabitPolarity } from '@/components/onboarding/habitPolarity';
import { toggleSetItem, WEEKDAYS } from '@/components/onboarding/constants';
import type { HabitScheduleCfg } from '../flowStateCtx';
import { BeatPlayer, Bloom, useAnimations, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

// Advanced path, the frequency step. Redesigned 2026-06-29.
//
// After the user approves the captured habits, this beat shows the SAME cards
// (same Build/Break chip, auto-classified the same way as the capture beat so
// the read matches) and grows the day-circle picker out of each card. The grow
// only animates while animations are playing (animateDaysIn={anims}); in the
// static canvas the day circles render in place so the beat is never blank.
// Day selections are lifted to shared FlowState via setHabitConfig so the plan
// recap and home tour reflect the real schedule.
//
// Polarity here is derived from the habit name, the same as the capture beat, so
// the two beats agree without threading state. A user flip made in capture is not
// carried forward yet; that is an engine follow-up when the two beats are wired
// in-place rather than as separate preview beats.

const SAMPLE_HABITS = ['Morning walk', 'No screens after 10 PM', 'Meditate 5 minutes'];

interface HabitEntry {
  name: string;
  polarity: HabitPolarity;
  days: Set<number>;
}

function AdvancedFrequencyBeat(props?: Record<string, string>) {
  const flow = useFlowState();
  const anims = useAnimations();
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;

  const [entries, setEntries] = useState<HabitEntry[]>(() =>
    habits.map((name) => ({ name, polarity: classifyHabitPolarity(name), days: new Set(WEEKDAYS) }))
  );

  // Lift day selections to shared flow state whenever they change so the plan
  // recap and home tour show the real schedule the user picked.
  useEffect(() => {
    if (!flow) return;
    for (const e of entries) {
      const cfg: HabitScheduleCfg = {
        days: [...e.days].sort((a, b) => a - b),
        time: '08:00',
        reminder: false,
      };
      flow.setHabitConfig(e.name, cfg);
    }
    // react to entries only; flow is read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  function toggleDay(idx: number, day: number) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, days: toggleSetItem(e.days, day) } : e)));
  }

  function changePolarity(idx: number, polarity: HabitPolarity) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, polarity } : e)));
  }

  const reveal = useElementReveal(entries.length);

  const cards = (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      {entries.map((e, idx) => (
        <Bloom key={e.name} show={idx < reveal}>
          <HabitScheduleCard
            habitName={e.name}
            polarity={e.polarity}
            selectedDays={e.days}
            onChangePolarity={(p) => changePolarity(idx, p)}
            onToggleDay={(d) => toggleDay(idx, d)}
            onEdit={() => undefined}
            showDays
            animateDaysIn={anims}
          />
        </Bloom>
      ))}
      {/* The grow keyframe the card references when animateDaysIn is set. */}
      <style>{`@keyframes ggDaysGrow{from{max-height:0;opacity:0}to{max-height:160px;opacity:1}}`}</style>
    </div>
  );

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Now the days. Tell me how often each one runs and I'll fill them in.",
    },
    { id: 'cards', speaker: 'coach', render: cards },
    {
      id: 'confirm',
      speaker: 'coach',
      say: props?.confirmCoachLine ?? 'Your habits are all set, your plan is ready.',
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const advancedFrequencyBeat: BeatDef = {
  type: 'advanced-frequency',
  group: 'Onboarding',
  label: 'Advanced frequency (day circles)',
  Comp: AdvancedFrequencyBeat,
};

export default advancedFrequencyBeat;
