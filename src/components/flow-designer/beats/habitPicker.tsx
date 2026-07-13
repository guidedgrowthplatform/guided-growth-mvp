import { useState } from 'react';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import { BeatPlayer, Bloom, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, SUBTLE, SPACE } from './_beatStyle';

// "Less is more" cap for this beat. The check-ins are already habits, so
// one or two additional habits is plenty. One is totally fine.
// MAX_HABITS_ONBOARDING is imported from onboardingHabits (currently 2).
const HABIT_PICKER_CAP = MAX_HABITS_ONBOARDING; // 1-2 per spec; cap is enforced here + via maxReached prop

function HabitPickerBeat(props?: Record<string, string>) {
  // One panel per goal picked upstream, each showing that goal's real habits.
  // Selection is the shared, capped habit set so the plan beat reads it.
  const flow = useFlowState();
  const goals = flow?.goals.length
    ? flow.goals
    : props?.goal
      ? [props.goal]
      : ['Fall asleep earlier'];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const [customGoalByHabit, setCustomGoalByHabit] = useState<Record<string, string>>({});
  const [continued, setContinued] = useState(false);
  const selected = flow ? flow.habits : localSel;
  const selectedSet = new Set(selected);
  const atCap = selected.length >= HABIT_PICKER_CAP;
  const selectedForGoal = (goal: string) =>
    selected.some(
      (habit) => customGoalByHabit[habit] === goal || habitsByGoal[goal]?.includes(habit),
    );
  const maxReachedForGoal = (goal: string) =>
    atCap || (goals.length === 2 && selectedForGoal(goal));
  const toggle = (habit: string, goal: string) => {
    const isSelected = selectedSet.has(habit);
    if (!isSelected && maxReachedForGoal(goal)) return;
    if (flow) flow.toggleHabit(habit, HABIT_PICKER_CAP);
    else
      setLocalSel((current) =>
        isSelected ? current.filter((value) => value !== habit) : [...current, habit],
      );
  };
  const addCustomHabit = (habit: string, goal: string) => {
    setCustomGoalByHabit((current) => ({ ...current, [habit]: goal }));
    toggle(habit, goal);
  };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (g: string) => expanded[g] ?? true;
  const reveal = useElementReveal(goals.length);

  // Selection hint: shows "1 of 2 selected" or "2 of 2" when at cap.
  // Reminds the user that the cap is intentional, not a bug.
  const selectionCount = selected.length;
  const selectionHint =
    selectionCount === 0
      ? `Pick one to start. One is plenty.`
      : selectionCount >= HABIT_PICKER_CAP
        ? `${selectionCount} of ${HABIT_PICKER_CAP} selected. That's a great start.`
        : `${selectionCount} of ${HABIT_PICKER_CAP} selected. One more is fine, or this is enough.`;

  function handleContinue() {
    if (selectionCount === 0) return;
    setContinued(true);
  }

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      // Placeholder: real copy comes from beatContexts.ts.
      // Framing: the check-ins are already habits. One or two more is plenty. One is fine.
      say:
        props?.coachLine ??
        "Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.",
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
          {goals.map((g, i) => (
            <Bloom key={g} show={i < reveal}>
              <HabitPickerPanel
                goal={g}
                habits={habitsByGoal[g] ?? []}
                expanded={isOpen(g)}
                onToggleExpanded={() => setExpanded((e) => ({ ...e, [g]: !isOpen(g) }))}
                selectedHabits={selectedSet}
                maxReached={maxReachedForGoal(g)}
                onToggleHabit={(h) => toggle(h, g)}
                onAddCustomHabit={(h) => addCustomHabit(h, g)}
              />
            </Bloom>
          ))}
          <button
            type="button"
            onClick={handleContinue}
            disabled={selectionCount === 0}
            className="w-full rounded-[24px] bg-primary px-[16px] py-[14px] text-[16px] font-bold leading-[24px] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
          {continued && (
            <p className="text-center text-[13px] font-semibold text-success">
              Habits captured. The host flow can continue.
            </p>
          )}
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
