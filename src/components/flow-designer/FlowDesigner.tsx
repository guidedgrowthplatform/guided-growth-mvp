import { Icon } from '@iconify/react';
import { useState, type ReactElement } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { ChipSelect } from '@/components/ui/ChipSelect';

/**
 * FlowDesigner — an interactive preview of the chat-native onboarding flow,
 * built from the REAL app components (not lookalikes). Each beat renders the
 * actual production card with its own live state, framed in a phone preview.
 *
 * Lives in two places: a Storybook story (Flow / Flow Designer) for fast
 * iteration, and a dev-only /flow-designer route for in-app use.
 */

// --- Beat bodies: each holds its own local state and renders real components.

function ProfileBody() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<string | null>('Male');
  return (
    <div className="flex flex-col gap-4">
      <OnboardingInput
        icon="mdi:account-outline"
        placeholder="What should I call you?"
        value={name}
        onChange={setName}
      />
      <ChipSelect
        options={['Male', 'Female', 'Non-binary', 'Prefer not to say']}
        value={gender}
        onChange={setGender}
        ariaLabel="How do you identify?"
        columns={2}
      />
    </div>
  );
}

function CategoryBody() {
  const cats = [
    { emoji: '🌙', label: 'Sleep better' },
    { emoji: '🏃', label: 'Move more' },
    { emoji: '🥗', label: 'Eat better' },
    { emoji: '⚡', label: 'More energy' },
  ];
  const [sel, setSel] = useState('Sleep better');
  return (
    <div className="grid grid-cols-2 gap-3">
      {cats.map((c) => (
        <CategoryCard
          key={c.label}
          emoji={c.emoji}
          label={c.label}
          selected={sel === c.label}
          onSelect={() => setSel(c.label)}
        />
      ))}
    </div>
  );
}

function GoalsBody() {
  const goals = ['Fall asleep faster', 'Sleep through the night', 'Wake up rested'];
  const [sel, setSel] = useState<Set<string>>(new Set(['Fall asleep faster']));
  return (
    <div className="flex flex-col gap-3">
      {goals.map((g) => (
        <GoalCard
          key={g}
          label={g}
          selected={sel.has(g)}
          onToggle={() =>
            setSel((prev) => {
              const next = new Set(prev);
              if (next.has(g)) next.delete(g);
              else next.add(g);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}

function HabitsBody() {
  const [expanded, setExpanded] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set(['Wind down without a screen']));
  const habits = [
    'Wind down without a screen',
    'No caffeine after 2pm',
    'Same bedtime every night',
  ];
  return (
    <HabitPickerPanel
      goal="Sleep better"
      habits={habits}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      selectedHabits={sel}
      onToggleHabit={(h) =>
        setSel((prev) => {
          const next = new Set(prev);
          if (next.has(h)) next.delete(h);
          else next.add(h);
          return next;
        })
      }
      onAddCustomHabit={(h) => setSel((prev) => new Set(prev).add(h))}
    />
  );
}

function ReflectionBody() {
  const [time, setTime] = useState('21:30');
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Every day');
  return (
    <DailyReflectionCard
      time={time}
      onTimeChange={setTime}
      days={days}
      onToggleDay={(d) =>
        setDays((prev) => {
          const next = new Set(prev);
          if (next.has(d)) next.delete(d);
          else next.add(d);
          return next;
        })
      }
      reminder={reminder}
      onToggleReminder={setReminder}
      schedule={schedule}
      onScheduleChange={setSchedule}
    />
  );
}

function PlanBody() {
  return (
    <div className="flex flex-col gap-3">
      <PlanSummaryCard
        icon="mdi:bed-outline"
        typeLabel="Habit"
        title="Wind down without a screen"
        cadence="Every day"
        rule="30 min before bed"
        onEdit={() => {}}
      />
      <PlanSummaryCard
        icon="mdi:notebook-outline"
        typeLabel="Journal"
        title="Evening reflection"
        cadence="Every day"
        rule="3 questions"
        onEdit={() => {}}
      />
    </div>
  );
}

function CheckinBody() {
  const mood = checkInDimensions.find((d) => d.key === 'mood')!;
  const [sel, setSel] = useState<number | null>(4);
  return (
    <div className="flex w-full justify-between">
      {mood.options.map((o) => (
        <EmojiOptionButton
          key={o.value}
          icon={o.icon}
          label={o.label}
          color={o.color}
          isSelected={sel === o.value}
          onClick={() => setSel(o.value)}
        />
      ))}
    </div>
  );
}

interface Beat {
  id: string;
  name: string;
  coachLine: string;
  Body: () => ReactElement;
}

const BEATS: Beat[] = [
  {
    id: 'profile',
    name: 'Profile',
    coachLine: 'First, what should I call you?',
    Body: ProfileBody,
  },
  {
    id: 'category',
    name: 'Focus area',
    coachLine: 'What feels most worth improving right now?',
    Body: CategoryBody,
  },
  { id: 'goals', name: 'Goals', coachLine: 'Within sleep, what matters most?', Body: GoalsBody },
  {
    id: 'habits',
    name: 'Habits',
    coachLine: 'Let us pick one or two habits to start with.',
    Body: HabitsBody,
  },
  {
    id: 'reflection',
    name: 'Reflection',
    coachLine: 'When should we reflect each day?',
    Body: ReflectionBody,
  },
  { id: 'plan', name: 'Plan', coachLine: 'Here is the plan you just built.', Body: PlanBody },
  {
    id: 'checkin',
    name: 'Daily check-in',
    coachLine: 'How is your mood today?',
    Body: CheckinBody,
  },
];

export function FlowDesigner() {
  const [active, setActive] = useState(0);
  const beat = BEATS[active];
  const Body = beat.Body;

  return (
    <div
      className="flex min-h-screen gap-6 p-6"
      style={{ fontFamily: 'Urbanist, -apple-system, sans-serif', background: '#f4f6f9' }}
    >
      {/* Beats rail */}
      <div className="w-[220px] shrink-0">
        <div className="mb-1 text-[15px] font-bold text-content">Flow Designer</div>
        <div className="mb-3 text-[12px] text-content-tertiary">onboarding · real components</div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
          Beats
        </div>
        <div className="flex flex-col gap-1">
          {BEATS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive(i)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[14px] transition-colors ${
                i === active
                  ? 'bg-primary/10 font-bold text-primary'
                  : 'text-content-subtle hover:bg-surface-secondary'
              }`}
            >
              <span>{b.name}</span>
              <span className="text-[11px] text-content-tertiary">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            disabled={active === 0}
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-content-subtle disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setActive((i) => Math.min(BEATS.length - 1, i + 1))}
            disabled={active === BEATS.length - 1}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Phone preview */}
      <div className="flex flex-1 justify-center">
        <div className="flex h-[720px] w-[390px] flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-elevated">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-4">
            <Icon icon="ic:round-auto-awesome" className="size-5 text-primary" />
            <span className="text-[15px] font-bold text-content">Coach</span>
          </div>
          <div
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
            style={{ background: '#f9f9f9' }}
          >
            <div className="mr-auto max-w-[280px] rounded-2xl bg-surface-secondary px-4 py-3 text-[15px] leading-[21px] text-content">
              {beat.coachLine}
            </div>
            <Body />
          </div>
          <div className="flex items-center gap-2 border-t border-border-light px-4 py-3">
            <div className="flex-1 rounded-full bg-surface-secondary px-4 py-2 text-[14px] text-content-tertiary">
              Type or talk...
            </div>
            <div className="flex size-10 items-center justify-center rounded-full bg-primary">
              <Icon icon="ic:round-mic" className="size-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
