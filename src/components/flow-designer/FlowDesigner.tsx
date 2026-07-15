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
 * FlowDesigner — the chat-native onboarding flow as one continuous scroll,
 * built from the REAL app components (not lookalikes) with real onboarding
 * content (the 8 categories, real goals, real sub-habits, real gender
 * options, real coach lines).
 *
 * Lives in three places: a Storybook story (Flow / Flow Designer), a dev-only
 * /flow-designer route in the app, and a standalone hosted build.
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
        options={['Male', 'Female', 'Other']}
        value={gender}
        onChange={setGender}
        ariaLabel="How do you identify?"
        columns={3}
      />
    </div>
  );
}

function CategoryBody() {
  const cats = [
    { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
    { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
    { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
    { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
    { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
    { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
    { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
    { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
  ];
  const [sel, setSel] = useState('Sleep better');
  return (
    <div className="grid grid-cols-2 gap-3">
      {cats.map((c) => (
        <CategoryCard
          key={c.label}
          image={c.image}
          label={c.label}
          selected={sel === c.label}
          onSelect={() => setSel(c.label)}
        />
      ))}
    </div>
  );
}

function GoalsBody() {
  const goals = [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ];
  const [sel, setSel] = useState<Set<string>>(new Set(['Fall asleep earlier']));
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
  const [sel, setSel] = useState<Set<string>>(new Set(['No screens after 10 PM']));
  const habits = [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
  ];
  return (
    <HabitPickerPanel
      goal="Fall asleep earlier"
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
        title="No screens after 10 PM"
        cadence="Every day"
        rule="10:00 PM"
        onEdit={() => {}}
      />
      <PlanSummaryCard
        icon="mdi:notebook-outline"
        typeLabel="Journal"
        title="Daily Reflection"
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
  reply?: string;
}

const BEATS: Beat[] = [
  {
    id: 'profile',
    name: 'Profile',
    coachLine: "Hey, I'm your coach. Before we start, what should I call you?",
    Body: ProfileBody,
  },
  {
    id: 'category',
    name: 'Focus area',
    coachLine: 'What feels most worth improving right now?',
    Body: CategoryBody,
    reply: "Sleep, yeah. That's the foundation of everything else.",
  },
  {
    id: 'goals',
    name: 'Goals',
    coachLine: 'Within sleep, what matters most? Pick one or two.',
    Body: GoalsBody,
  },
  {
    id: 'habits',
    name: 'Habits',
    coachLine:
      "Can't fall asleep is so common, and it's fixable. Let's pick a habit or two to start.",
    Body: HabitsBody,
  },
  {
    id: 'reflection',
    name: 'Reflection',
    coachLine: 'Last thing, want a short daily reflection too?',
    Body: ReflectionBody,
  },
  {
    id: 'plan',
    name: 'Plan',
    coachLine: "Here's the plan you just built. You can tweak anything.",
    Body: PlanBody,
  },
  {
    id: 'checkin',
    name: 'Daily check-in',
    coachLine: "You're all set. Quick check-in, how's your mood today?",
    Body: CheckinBody,
  },
];

export function FlowDesigner() {
  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ fontFamily: 'Poppins, -apple-system, sans-serif', background: '#e8ecf1' }}
    >
      <div className="mx-auto flex w-full max-w-[420px] flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-elevated">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-light bg-surface px-5 py-4">
          <Icon icon="ic:round-auto-awesome" className="size-5 text-primary" />
          <span className="text-[15px] font-bold text-content">Coach</span>
        </div>

        <div className="flex flex-col gap-6 px-5 py-6" style={{ background: '#f9f9f9' }}>
          {BEATS.map((b) => {
            const Body = b.Body;
            return (
              <div key={b.id} className="flex flex-col gap-3">
                <div className="mr-auto max-w-[290px] rounded-2xl rounded-tl-md bg-surface-secondary px-4 py-3 text-[15px] leading-[21px] text-content">
                  {b.coachLine}
                </div>
                <Body />
                {b.reply && (
                  <div className="ml-auto max-w-[280px] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-[15px] font-medium leading-[21px] text-white">
                    {b.reply}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border-light bg-surface px-4 py-3">
          <div className="flex-1 rounded-full bg-surface-secondary px-4 py-2 text-[14px] text-content-tertiary">
            Type or talk...
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary">
            <Icon icon="ic:round-mic" className="size-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
