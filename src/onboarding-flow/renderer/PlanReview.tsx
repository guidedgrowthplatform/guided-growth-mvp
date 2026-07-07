/**
 * PlanReview - the ONBOARD-COMPLETE plan review + edit surface. Shows the whole
 * plan the user just built (habits with their schedules, plus the display-only
 * morning check-in, evening reflection, and weekly review day), lets them edit
 * the HABITS (remove, change days/time/reminder, add), then commit.
 *
 * Presentational + fully controlled: every value comes from props and every
 * edit flows back through a callback, so the container (IntoAppAdapter) owns the
 * single source of truth (the flow answers) and this renders without any of the
 * orchestrator, context, or Supabase wiring. Edit affordances appear only when
 * their callbacks are supplied, so the same component renders read-only.
 *
 * Reuses PlanSummaryCard (the plan row) and DailyReflectionCard variant
 * "schedule" (the per-habit time+days+reminder editor). NO EM DASHES.
 */
import { useState } from 'react';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { Button } from '@/components/ui/Button';
import {
  cadenceLabel,
  type PlanHabit,
  type PlanRitual,
  ruleLabel,
  weeklyDayName,
} from './planReviewData';

const HABIT_ICON = 'mdi:checkbox-marked-circle-outline';
const REFLECTION_ICON = 'mdi:book-edit-outline';
const MORNING_ICON = 'mdi:weather-sunny';
const WEEKLY_ICON = 'mdi:calendar-week';

const SECTION_LABEL = 'text-[13px] font-semibold uppercase tracking-[0.5px] text-content-tertiary';

export interface PlanReviewProps {
  habits: PlanHabit[];
  reflection: PlanRitual | null;
  morning: PlanRitual | null;
  weeklyDayIndex: number | null;
  /** Max habits the add affordance allows (path-aware). */
  habitCap: number;
  ctaLabel: string;
  onConfirm: () => void;
  // Edit callbacks. Omit all three to render read-only.
  onRemoveHabit?: (name: string) => void;
  onChangeHabit?: (name: string, patch: Partial<PlanHabit>) => void;
  onAddHabit?: (name: string) => void;
}

export function PlanReview({
  habits,
  reflection,
  morning,
  weeklyDayIndex,
  habitCap,
  ctaLabel,
  onConfirm,
  onRemoveHabit,
  onChangeHabit,
  onAddHabit,
}: PlanReviewProps) {
  const editable = !!(onRemoveHabit || onChangeHabit || onAddHabit);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newHabit, setNewHabit] = useState('');
  const atCap = habits.length >= habitCap;

  const toggleExpanded = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  const changeDays = (habit: PlanHabit, day: number) => {
    const set = new Set(habit.days);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChangeHabit?.(habit.name, { days: [...set].sort((a, b) => a - b) });
  };

  const submitNewHabit = () => {
    const trimmed = newHabit.trim();
    if (!trimmed || atCap) return;
    onAddHabit?.(trimmed);
    setNewHabit('');
  };

  return (
    <div className="mt-3 flex flex-col gap-5">
      {/* Habits */}
      <div className="flex flex-col gap-3">
        <span className={SECTION_LABEL}>Your habits</span>
        {habits.length === 0 && (
          <p className="rounded-[16px] border border-dashed border-border bg-surface-secondary/50 p-4 text-[14px] text-content-secondary">
            No habits yet. Add one below to start.
          </p>
        )}
        {habits.map((habit) => (
          <div key={habit.name} className="flex flex-col gap-2">
            <PlanSummaryCard
              icon={HABIT_ICON}
              typeLabel="Habit"
              title={habit.name}
              cadence={cadenceLabel(habit.days)}
              rule={ruleLabel(habit.time, habit.reminder)}
              onEdit={onChangeHabit ? () => toggleExpanded(habit.name) : undefined}
            />
            {editable && expanded === habit.name && (
              <div className="flex flex-col gap-3">
                <DailyReflectionCard
                  variant="schedule"
                  title={habit.name}
                  subtitle="When you'll do this"
                  time={habit.time}
                  onTimeChange={(time) => onChangeHabit?.(habit.name, { time })}
                  days={new Set(habit.days)}
                  onToggleDay={(day) => changeDays(habit, day)}
                  reminder={habit.reminder}
                  onToggleReminder={(reminder) => onChangeHabit?.(habit.name, { reminder })}
                />
                {onRemoveHabit && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(null);
                      onRemoveHabit(habit.name);
                    }}
                    aria-label={`Remove ${habit.name}`}
                    className="self-start rounded-full px-3 py-2 text-[14px] font-semibold text-danger"
                  >
                    Remove this habit
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {onAddHabit && (
          <div className="flex flex-col gap-2">
            {atCap ? (
              <p className="text-[13px] text-content-tertiary">
                You can track up to {habitCap} habit{habitCap === 1 ? '' : 's'} to start. Remove one
                to add another.
              </p>
            ) : (
              <>
                <OnboardingInput
                  icon="si:add-circle-line"
                  placeholder="Add a habit, e.g. evening walk"
                  value={newHabit}
                  onChange={setNewHabit}
                  onEnter={submitNewHabit}
                />
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  disabled={!newHabit.trim()}
                  onClick={submitNewHabit}
                >
                  Add habit
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Coaching rhythm (display only here; edited at their own beats) */}
      {(morning || reflection || weeklyDayIndex !== null) && (
        <div className="flex flex-col gap-3">
          <span className={SECTION_LABEL}>Your coaching rhythm</span>
          {morning && (
            <PlanSummaryCard
              icon={MORNING_ICON}
              typeLabel="Check-in"
              title="Morning check-in"
              cadence={cadenceLabel(morning.days)}
              rule={ruleLabel(morning.time, morning.reminder)}
            />
          )}
          {reflection && (
            <PlanSummaryCard
              icon={REFLECTION_ICON}
              typeLabel="Reflection"
              title="Evening reflection"
              cadence={cadenceLabel(reflection.days)}
              rule={ruleLabel(reflection.time, reflection.reminder)}
            />
          )}
          {weeklyDayIndex !== null && (
            <PlanSummaryCard
              icon={WEEKLY_ICON}
              typeLabel="Weekly"
              title="Weekly review"
              cadence="Weekly"
              rule={`On ${weeklyDayName(weeklyDayIndex)}`}
            />
          )}
        </div>
      )}

      <Button variant="primary" size="lg" fullWidth onClick={onConfirm} className="mt-1">
        {ctaLabel}
      </Button>
    </div>
  );
}
