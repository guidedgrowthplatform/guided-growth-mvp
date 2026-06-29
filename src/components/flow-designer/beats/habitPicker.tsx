import { useState } from 'react';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import { FONT, PRIMARY, SUBTLE, SPACE } from './_beatStyle';

// "Less is more" cap for this beat. The check-ins are already habits, so
// one or two additional habits is plenty. One is totally fine.
// MAX_HABITS_ONBOARDING is imported from onboardingHabits (currently 2).
const HABIT_PICKER_CAP = MAX_HABITS_ONBOARDING; // 1-2 per spec; cap is enforced here + via maxReached prop

function HabitPickerBeat(props?: Record<string, string>) {
  // One panel per goal picked upstream, each showing that goal's real habits.
  // Selection is the shared, capped habit set so the plan beat reads it.
  const flow = useFlowState();
  const goals = flow?.goals.length ? flow.goals : ['Fall asleep earlier'];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const selected = flow ? flow.habits : localSel;
  const selectedSet = new Set(selected);
  const atCap = selected.length >= HABIT_PICKER_CAP;
  const toggle = (h: string) =>
    flow
      ? flow.toggleHabit(h, HABIT_PICKER_CAP)
      : setLocalSel((p) =>
          p.includes(h)
            ? p.filter((x) => x !== h)
            : p.length < HABIT_PICKER_CAP
              ? [...p, h]
              : p,
        );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => expanded[g] ?? true;

  // Selection hint: shows "1 of 2 selected" or "2 of 2" when at cap.
  // Reminds the user that the cap is intentional, not a bug.
  const selectionCount = selected.length;
  const selectionHint =
    selectionCount === 0
      ? `Pick one to start. One is plenty.`
      : selectionCount >= HABIT_PICKER_CAP
        ? `${selectionCount} of ${HABIT_PICKER_CAP} selected. That's a great start.`
        : `${selectionCount} of ${HABIT_PICKER_CAP} selected. One more is fine, or this is enough.`;

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      // Placeholder: real copy comes from beatContexts.ts.
      // Framing: the check-ins are already habits. One or two more is plenty. One is fine.
      say:
        props?.coachLine ??
        "Your check-in is already a habit. Pick one or two more to build on, if you like. One is plenty.",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col" style={{ gap: SPACE.md }}>
          {/* Selection hint: "less is more" nudge, updates as they pick */}
          <p
            style={{
              fontFamily: FONT,
              fontSize: 12.5,
              fontWeight: 600,
              color: selectionCount >= HABIT_PICKER_CAP ? PRIMARY : SUBTLE,
              textAlign: 'center',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            {selectionHint}
          </p>
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
