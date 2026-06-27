import { useState } from 'react';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';

function HabitPickerBeat(props?: Record<string, string>) {
  // One panel per goal picked upstream, each showing that goal's real habits.
  // Selection is the shared, capped habit set so the plan beat reads it.
  const flow = useFlowState();
  const goals = flow?.goals.length ? flow.goals : ['Fall asleep earlier'];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const selected = flow ? flow.habits : localSel;
  const selectedSet = new Set(selected);
  const atCap = selected.length >= MAX_HABITS_ONBOARDING;
  const toggle = (h: string) =>
    flow
      ? flow.toggleHabit(h, MAX_HABITS_ONBOARDING)
      : setLocalSel((p) =>
          p.includes(h)
            ? p.filter((x) => x !== h)
            : p.length < MAX_HABITS_ONBOARDING
              ? [...p, h]
              : p,
        );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => expanded[g] ?? true;

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Here are a few habits that fit. Pick the ones you'll actually do.",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col gap-3">
          {goals.map((g) => (
            <HabitPickerPanel
              key={g}
              goal={g}
              habits={habitsByGoal[g] ?? []}
              expanded={isOpen(g)}
              onToggleExpanded={() => setExpanded((e) => ({ ...e, [g]: !isOpen(g) }))}
              selectedHabits={selectedSet}
              maxReached={atCap}
              onToggleHabit={(h) => toggle(h)}
              onAddCustomHabit={(h) => toggle(h)}
            />
          ))}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const habitPickerBeat: BeatDef = {
  type: 'habit-picker',
  group: 'Onboarding',
  label: 'Habit picker',
  Comp: HabitPickerBeat,
};

export default habitPickerBeat;
