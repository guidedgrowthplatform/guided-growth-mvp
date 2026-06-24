import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@iconify/react';
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { DailyProgressCard } from '@/components/habits/DailyProgressCard';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { DateStrip } from '@/components/home/DateStrip';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { HabitListItem } from '@/components/home/HabitListItem';
import { HomeHeader } from '@/components/home/HomeHeader';
import { QuickActionCards } from '@/components/home/QuickActionCards';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { SchedulePicker, type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DayPicker } from '@/components/ui/DayPicker';
import { DualButton } from '@/components/ui/DualButton';
import { Toggle } from '@/components/ui/Toggle';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { CheckInResultCard } from '@/components/voice/CheckInResultCard';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { AIPulseVisual } from '@/components/welcome/AIPulseVisual';
import { SplashIntro } from '@/components/welcome/SplashIntro';

/**
 * FlowBuilder — two buckets. Left: every real component. Right: the flow.
 * Drag a component across (a drop-line shows where it lands) or click the
 * top / middle / bottom buttons to insert without dragging. Reorder by
 * dragging inside the flow. Layout persists to localStorage.
 */

// --- Stateful previews: each renders a real component with sample props. ---

function ProfileInput() {
  const [v, setV] = useState('');
  return (
    <OnboardingInput
      icon="mdi:account-outline"
      placeholder="What should I call you?"
      value={v}
      onChange={setV}
    />
  );
}

function GenderChips() {
  const [v, setV] = useState<string | null>('Male');
  return (
    <ChipSelect
      options={['Male', 'Female', 'Other']}
      value={v}
      onChange={setV}
      ariaLabel="How do you identify?"
      columns={3}
    />
  );
}

// The whole profile beat as one clean card: coach line, then age and gender
// grouped with labels, then the user's expected answer on the right.
function ProfileBeat() {
  const [age, setAge] = useState<number | ''>(28);
  const [gender, setGender] = useState<string | null>('Male');
  return (
    <div className="flex flex-col gap-4">
      <ChatBubble role="ai" text="Great to have you here. How old are you and what's your gender?" />
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-content-tertiary">
            Age
          </div>
          <AgeScrollPicker value={age} onChange={setAge} />
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-content-tertiary">
            Gender
          </div>
          <ChipSelect
            options={['Male', 'Female', 'Other']}
            value={gender}
            onChange={setGender}
            ariaLabel="Gender"
            columns={3}
          />
        </div>
      </div>
      <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-content shadow-card">
        I'm 28, and I'm male.
      </div>
    </div>
  );
}

const CATS = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

function CategoryGrid() {
  const [sel, setSel] = useState('Sleep better');
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATS.map((c) => (
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

function GoalsList() {
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
            setSel((p) => {
              const n = new Set(p);
              if (n.has(g)) n.delete(g);
              else n.add(g);
              return n;
            })
          }
        />
      ))}
    </div>
  );
}

function HabitPicker() {
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
        setSel((p) => {
          const n = new Set(p);
          if (n.has(h)) n.delete(h);
          else n.add(h);
          return n;
        })
      }
      onAddCustomHabit={(h) => setSel((p) => new Set(p).add(h))}
    />
  );
}

function ReflectionCard() {
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
        setDays((p) => {
          const n = new Set(p);
          if (n.has(d)) n.delete(d);
          else n.add(d);
          return n;
        })
      }
      reminder={reminder}
      onToggleReminder={setReminder}
      schedule={schedule}
      onScheduleChange={setSchedule}
    />
  );
}

function PlanCards() {
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

function MoodRow() {
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

function PathSelection() {
  const [sel, setSel] = useState('new');
  return (
    <div className="flex flex-col gap-3">
      <SelectionCard
        icon="mdi:sparkles"
        title="I'm new to habit tracking"
        description="I'll help you step by step"
        selected={sel === 'new'}
        onSelect={() => setSel('new')}
      />
      <SelectionCard
        icon="mdi:lightning-bolt"
        title="I already track habits"
        description="Tell me your habits and I'll organize them"
        selected={sel === 'exp'}
        onSelect={() => setSel('exp')}
      />
    </div>
  );
}

function HabitSummary() {
  return (
    <HabitSummaryCard
      habitName="No screens after 10 PM"
      selectedDays={new Set([1, 2, 3, 4, 5])}
      onEdit={() => {}}
      showCheckmark
      showEditIcon
    />
  );
}

function SchedulePick() {
  const [v, setV] = useState<ScheduleOption>('Every day');
  return <SchedulePicker value={v} onChange={setV} />;
}

function CoachBubble(props?: Record<string, string>) {
  return (
    <ChatBubble role="ai" text={props?.text ?? 'What feels most worth improving right now?'} />
  );
}

function UserBubble(props?: Record<string, string>) {
  return (
    <ChatBubble
      role="user"
      text={props?.text ?? 'Sleep, honestly.'}
      userName={props?.userName ?? 'Jordan'}
    />
  );
}

function CheckinReceipt() {
  return <CheckInResultCard sleep={3} mood={4} energy={3} stress={2} date="2026-06-23" />;
}

function HabitSuggestion() {
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  return <HabitSuggestionCard name="No screens after 10 PM" days={days} onDaysChange={setDays} />;
}

function HomeGreeting() {
  return <HomeHeader userName="Jordan" />;
}

function HomeDateStrip() {
  const [d, setD] = useState('2026-06-23');
  return <DateStrip selectedDate={d} onSelectDate={setD} />;
}

function HomeQuickActions() {
  return <QuickActionCards onCheckInPress={() => {}} onJournalPress={() => {}} />;
}

function HomeHabit() {
  const [done, setDone] = useState(false);
  return (
    <HabitListItem
      name="No screens after 10 PM"
      subtitle="10:00 PM"
      streak={6}
      isCompleted={done}
      hasNote
      onToggleComplete={() => setDone((v) => !v)}
    />
  );
}

function HomeProgress() {
  return <DailyProgressCard completed={2} total={3} />;
}

function PulseOrb() {
  return (
    <div className="flex justify-center py-2">
      <AIPulseVisual />
    </div>
  );
}

function VoiceOrb() {
  return (
    <div className="flex justify-center py-2">
      <DualButton
        size={120}
        rings
        leftIcon={<Icon icon="ic:round-mic" className="size-6 text-white" />}
        rightIcon={<Icon icon="ic:round-keyboard" className="size-6 text-white" />}
        ariaLabel="Voice control"
      />
    </div>
  );
}

function PrimaryButton() {
  return (
    <Button variant="primary" size="lg" fullWidth>
      Start my plan
    </Button>
  );
}

function ToggleRow() {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
      <span className="text-[15px] font-medium text-content">Reminder</span>
      <Toggle checked={on} onChange={setOn} ariaLabel="Reminder" />
    </div>
  );
}

function DayPickerRow() {
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <DayPicker
        selectedDays={days}
        onToggleDay={(d) =>
          setDays((p) => {
            const n = new Set(p);
            if (n.has(d)) n.delete(d);
            else n.add(d);
            return n;
          })
        }
      />
    </div>
  );
}

function OnboardingTitle(props?: Record<string, string>) {
  return (
    <OnboardingHeader
      title={props?.title ?? "Let's build your plan"}
      subtitle={props?.subtitle ?? 'A couple of quick questions'}
    />
  );
}

function TypingDots() {
  return <TypingIndicator />;
}

function AuthSignup() {
  const [mode, setMode] = useState<'default' | 'signup' | 'login'>('default');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[26px] font-bold text-primary">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </div>
      <div className="space-y-3">
        <Button variant="social-dark" size="auth" fullWidth>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </Button>
        <Button variant="social-light" size="auth" fullWidth>
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
      {mode === 'signup' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[13px] text-content-tertiary">
            <span className="h-px flex-1 bg-border" />
            sign up with email
            <span className="h-px flex-1 bg-border" />
          </div>
          <OnboardingInput
            icon="mdi:account-outline"
            placeholder="First name"
            value={first}
            onChange={setFirst}
          />
          <OnboardingInput
            icon="mdi:account-outline"
            placeholder="Last name"
            value={last}
            onChange={setLast}
          />
          <OnboardingInput
            icon="mdi:email-outline"
            placeholder="Email"
            value={email}
            onChange={setEmail}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          <Button variant="primary" size="lg" fullWidth>
            Create account
          </Button>
        </div>
      )}
      {mode === 'login' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[13px] text-content-tertiary">
            <span className="h-px flex-1 bg-border" />
            log in with email
            <span className="h-px flex-1 bg-border" />
          </div>
          <OnboardingInput
            icon="mdi:email-outline"
            placeholder="Email"
            value={email}
            onChange={setEmail}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          <Button variant="primary" size="lg" fullWidth>
            Log in
          </Button>
        </div>
      )}
      {mode === 'default' && (
        <Button variant="primary" size="lg" fullWidth onClick={() => setMode('signup')}>
          Sign up with email
        </Button>
      )}
      <div className="text-center text-[13px] text-content-secondary">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="font-semibold text-primary"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="font-semibold text-primary"
            >
              Log in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AgePicker() {
  const [age, setAge] = useState<number | ''>(28);
  return <AgeScrollPicker value={age} onChange={setAge} />;
}

function SplashIntroPreview() {
  return (
    <div
      style={{ position: 'relative', width: '100%', height: 560, overflow: 'hidden', borderRadius: 24 }}
    >
      <SplashIntro loop />
    </div>
  );
}

// --- Registry ---

interface PaletteItem {
  type: string;
  group: string;
  label: string;
  Comp: (props?: Record<string, string>) => ReactNode;
}

interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
}

const TEXT_FIELDS: Record<string, FieldDef[]> = {
  'coach-bubble': [{ key: 'text', label: 'Coach says', multiline: true }],
  'user-bubble': [
    { key: 'text', label: 'User says', multiline: true },
    { key: 'userName', label: 'Name' },
  ],
  'onboarding-header': [
    { key: 'title', label: 'Title' },
    { key: 'subtitle', label: 'Subtitle' },
  ],
};

const REGISTRY: PaletteItem[] = [
  { type: 'splash-intro', group: 'Intro', label: 'Splash intro (animated)', Comp: SplashIntroPreview },
  {
    type: 'auth-signup',
    group: 'Auth',
    label: 'Sign up (Apple / Google / email)',
    Comp: AuthSignup,
  },
  { type: 'age-picker', group: 'Onboarding', label: 'Age picker', Comp: AgePicker },
  { type: 'coach-bubble', group: 'Chat', label: 'Coach message', Comp: CoachBubble },
  { type: 'user-bubble', group: 'Chat', label: 'User message', Comp: UserBubble },
  { type: 'typing', group: 'Chat', label: 'Typing dots', Comp: TypingDots },
  { type: 'onboarding-header', group: 'Onboarding', label: 'Screen header', Comp: OnboardingTitle },
  { type: 'profile-input', group: 'Onboarding', label: 'Name input', Comp: ProfileInput },
  { type: 'gender-chips', group: 'Onboarding', label: 'Gender chips', Comp: GenderChips },
  { type: 'profile-beat', group: 'Onboarding', label: 'Profile (age + gender)', Comp: ProfileBeat },
  { type: 'path-selection', group: 'Onboarding', label: 'Path choice', Comp: PathSelection },
  { type: 'category-grid', group: 'Onboarding', label: 'Category tiles', Comp: CategoryGrid },
  { type: 'goals-list', group: 'Onboarding', label: 'Goal cards', Comp: GoalsList },
  { type: 'habit-picker', group: 'Onboarding', label: 'Habit picker', Comp: HabitPicker },
  { type: 'habit-summary', group: 'Onboarding', label: 'Habit summary', Comp: HabitSummary },
  { type: 'schedule-picker', group: 'Onboarding', label: 'Schedule picker', Comp: SchedulePick },
  { type: 'reflection-card', group: 'Onboarding', label: 'Daily reflection', Comp: ReflectionCard },
  { type: 'plan-cards', group: 'Onboarding', label: 'Plan summary', Comp: PlanCards },
  { type: 'mood-row', group: 'Check-in', label: 'Mood row', Comp: MoodRow },
  { type: 'checkin-receipt', group: 'Check-in', label: 'Check-in receipt', Comp: CheckinReceipt },
  { type: 'habit-suggestion', group: 'Check-in', label: 'Habit suggestion', Comp: HabitSuggestion },
  { type: 'home-greeting', group: 'Home', label: 'Home header', Comp: HomeGreeting },
  { type: 'home-datestrip', group: 'Home', label: 'Date strip', Comp: HomeDateStrip },
  { type: 'home-quickactions', group: 'Home', label: 'Quick actions', Comp: HomeQuickActions },
  { type: 'home-habit', group: 'Home', label: 'Habit row', Comp: HomeHabit },
  { type: 'home-progress', group: 'Home', label: 'Daily progress', Comp: HomeProgress },
  { type: 'pulse-orb', group: 'Orb', label: 'Pulse orb', Comp: PulseOrb },
  { type: 'voice-orb', group: 'Orb', label: 'Voice orb (dial)', Comp: VoiceOrb },
  { type: 'primary-button', group: 'UI', label: 'Primary button', Comp: PrimaryButton },
  { type: 'toggle-row', group: 'UI', label: 'Toggle', Comp: ToggleRow },
  { type: 'daypicker-row', group: 'UI', label: 'Day picker', Comp: DayPickerRow },
];

const REGISTRY_MAP = Object.fromEntries(REGISTRY.map((r) => [r.type, r]));
const GROUPS = ['Intro', 'Auth', 'Chat', 'Onboarding', 'Check-in', 'Home', 'Orb', 'UI'];

interface DefaultBeat {
  type: string;
  beat?: string;
  sheetStage?: string;
  props?: Record<string, string>;
}

// The default onboarding flow, pre-connected to the beats sheet so each beat
// opens with its real context. Several components can share one sheet stage
// (profile setup is name + age + gender), so they share a beat number.
const DEFAULT_FLOW: DefaultBeat[] = [
  { type: 'auth-signup', beat: '1' },
  { type: 'profile-beat', beat: '2', sheetStage: 'ONBOARD-01--FORM: Profile Setup' },
  { type: 'path-selection', beat: '3', sheetStage: 'ONBOARD-FORK--FORM: Experience Fork' },
  { type: 'category-grid', beat: '4', sheetStage: 'ONBOARD-BEGINNER-01: Category Selection' },
  { type: 'goals-list', beat: '5', sheetStage: 'ONBOARD-BEGINNER-02: Subcategory Selection' },
  { type: 'habit-picker', beat: '6', sheetStage: 'ONBOARD-BEGINNER-03: Habit Selection' },
  { type: 'reflection-card', beat: '7', sheetStage: 'ONBOARD-BEGINNER-07: Journal Setup' },
  { type: 'plan-cards', beat: '8' },
  { type: 'mood-row', beat: '9' },
];

const STORAGE_KEY = 'gg-flow-builder-v9';

const buildDefault = (): Placed[] =>
  DEFAULT_FLOW.map((b) => ({
    uid: newUid(b.type),
    type: b.type,
    beat: b.beat,
    sheetStage: b.sheetStage,
    props: b.props,
  }));

interface Lane {
  id: string;
  label: string;
  items: Placed[];
}

interface Placed {
  uid: string;
  type: string;
  props?: Record<string, string>;
  beat?: string;
  note?: string;
  sheetStage?: string;
  lanes?: Lane[];
}

let UID = 0;
const newUid = (type: string) => `${type}-${++UID}`;

function DropLine() {
  return <div className="h-[3px] rounded-full bg-primary" />;
}

function SendButtons({ onSend }: { onSend: (where: 'top' | 'middle' | 'bottom') => void }) {
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const cls =
    'flex size-7 items-center justify-center rounded-full border border-border bg-surface text-content-subtle shadow-card hover:text-primary';
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        title="Send to top"
        aria-label="Send to top"
        onPointerDown={stop}
        onClick={() => onSend('top')}
        className={cls}
      >
        <Icon icon="ic:round-vertical-align-top" className="size-4" />
      </button>
      <button
        type="button"
        title="Send to middle"
        aria-label="Send to middle"
        onPointerDown={stop}
        onClick={() => onSend('middle')}
        className={cls}
      >
        <Icon icon="ic:round-vertical-align-center" className="size-4" />
      </button>
      <button
        type="button"
        title="Send to bottom"
        aria-label="Send to bottom"
        onPointerDown={stop}
        onClick={() => onSend('bottom')}
        className={cls}
      >
        <Icon icon="ic:round-vertical-align-bottom" className="size-4" />
      </button>
    </div>
  );
}

function PaletteCard({
  item,
  onSend,
}: {
  item: PaletteItem;
  onSend: (type: string, where: 'top' | 'middle' | 'bottom') => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}`,
    data: { fromPalette: true, type: item.type, label: item.label },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="group relative cursor-grab rounded-2xl border border-border bg-surface p-3"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
        <Icon icon="ic:round-drag-indicator" className="size-3.5" />
        {item.label}
      </div>
      <div className="pointer-events-none">{item.Comp()}</div>
      <SendButtons onSend={(where) => onSend(item.type, where)} />
    </div>
  );
}

function SortableCard({
  item,
  onRemove,
  onUpdate,
  sheetBeats,
}: {
  item: Placed;
  onRemove: () => void;
  onUpdate: (patch: Partial<Placed>) => void;
  sheetBeats: { stage: string; suggested: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });
  const entry = REGISTRY_MAP[item.type];
  const fields = TEXT_FIELDS[item.type];
  const [editing, setEditing] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const setField = (key: string, value: string) =>
    onUpdate({ props: { ...item.props, [key]: value } });

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-3">
      {/* The beat card: component plus optional text editor */}
      <div className="relative w-[380px] shrink-0">
        <div className="absolute -top-2 right-1 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {fields && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-label="Edit text"
              className={`flex size-7 items-center justify-center rounded-full border border-border bg-surface shadow-card ${
                editing ? 'text-primary' : 'text-content-tertiary'
              }`}
            >
              <Icon icon="ic:round-edit" className="size-4" />
            </button>
          )}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="flex size-7 cursor-grab items-center justify-center rounded-full border border-border bg-surface text-content-tertiary shadow-card"
          >
            <Icon icon="ic:round-drag-indicator" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="flex size-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-card"
          >
            <Icon icon="ic:round-close" className="size-4" />
          </button>
        </div>

        {fields && editing && (
          <div className="mb-2 flex flex-col gap-1.5 rounded-xl border border-primary/40 bg-surface p-2.5">
            {fields.map((f) =>
              f.multiline ? (
                <textarea
                  key={f.key}
                  value={item.props?.[f.key] ?? ''}
                  placeholder={f.label}
                  rows={2}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[13px] text-content"
                />
              ) : (
                <input
                  key={f.key}
                  value={item.props?.[f.key] ?? ''}
                  placeholder={f.label}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-[13px] text-content"
                />
              ),
            )}
          </div>
        )}

        {entry ? entry.Comp(item.props) : null}
      </div>

      {/* Metadata sidecar: beat number, sheet link, context */}
      <div className="flex w-[250px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-content-tertiary">
            Beat
          </span>
          <input
            value={item.beat ?? ''}
            onChange={(e) => onUpdate({ beat: e.target.value })}
            placeholder="#"
            className="w-12 rounded-md border border-border bg-page px-1.5 py-1 text-[12px] text-content"
          />
        </div>
        <select
          value={item.sheetStage ?? ''}
          onChange={(e) => {
            const stage = e.target.value;
            const match = sheetBeats.find((b) => b.stage === stage);
            onUpdate({ sheetStage: stage, note: match ? match.suggested : item.note });
          }}
          className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-[12px] text-content"
        >
          <option value="">Connect to a sheet beat...</option>
          {sheetBeats.map((b) => (
            <option key={b.stage} value={b.stage}>
              {b.stage}
            </option>
          ))}
        </select>
        <textarea
          value={item.note ?? ''}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="beat context (what the coach is doing here)"
          rows={6}
          className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[11px] leading-[1.5] text-content"
        />
      </div>
    </div>
  );
}

function EndZone() {
  const { setNodeRef } = useDroppable({ id: 'end-zone' });
  return <div ref={setNodeRef} className="min-h-[28px] w-full" />;
}

// --- Split / lane rendering ---

function LaneItem({
  item,
  onRemove,
  onUpdate,
  onMove,
}: {
  item: Placed;
  onRemove: () => void;
  onUpdate: (patch: Partial<Placed>) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const entry = REGISTRY_MAP[item.type];
  const fields = TEXT_FIELDS[item.type];
  const [editing, setEditing] = useState(false);
  const tbtn =
    'flex size-7 items-center justify-center rounded-full border border-border bg-surface text-content-tertiary shadow-card';
  const setField = (key: string, value: string) =>
    onUpdate({ props: { ...item.props, [key]: value } });
  return (
    <div className="group relative rounded-xl border border-border bg-surface p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-content-tertiary">
          Beat
        </span>
        <input
          value={item.beat ?? ''}
          onChange={(e) => onUpdate({ beat: e.target.value })}
          placeholder="#"
          className="w-9 rounded-md border border-border bg-surface px-1 py-1 text-[12px] text-content"
        />
        <input
          value={item.note ?? ''}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="beat context"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-content"
        />
      </div>
      <div className="absolute right-1 top-9 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {fields && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Edit text"
            className={tbtn}
          >
            <Icon icon="ic:round-edit" className="size-4" />
          </button>
        )}
        <button type="button" onClick={() => onMove(-1)} aria-label="Move up" className={tbtn}>
          <Icon icon="ic:round-keyboard-arrow-up" className="size-4" />
        </button>
        <button type="button" onClick={() => onMove(1)} aria-label="Move down" className={tbtn}>
          <Icon icon="ic:round-keyboard-arrow-down" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="flex size-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-card"
        >
          <Icon icon="ic:round-close" className="size-4" />
        </button>
      </div>
      {fields && editing && (
        <div className="mb-2 flex flex-col gap-1.5 rounded-xl border border-primary/40 bg-surface p-2.5">
          {fields.map((f) =>
            f.multiline ? (
              <textarea
                key={f.key}
                value={item.props?.[f.key] ?? ''}
                placeholder={f.label}
                rows={2}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[13px] text-content"
              />
            ) : (
              <input
                key={f.key}
                value={item.props?.[f.key] ?? ''}
                placeholder={f.label}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-[13px] text-content"
              />
            ),
          )}
        </div>
      )}
      {entry ? entry.Comp(item.props) : null}
    </div>
  );
}

function LaneZone({
  splitUid,
  lane,
  canRemove,
  onLabel,
  onRemoveLane,
  onItem,
  onRemoveItem,
  onMoveItem,
}: {
  splitUid: string;
  lane: Lane;
  canRemove: boolean;
  onLabel: (v: string) => void;
  onRemoveLane: () => void;
  onItem: (uid: string, patch: Partial<Placed>) => void;
  onRemoveItem: (uid: string) => void;
  onMoveItem: (uid: string, dir: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${splitUid}:${lane.id}` });
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon icon="ic:round-alt-route" className="size-4 text-primary" />
        <input
          value={lane.label}
          onChange={(e) => onLabel(e.target.value)}
          className="flex-1 rounded-md border border-border bg-page px-2 py-1 text-[13px] font-semibold text-content"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemoveLane}
            aria-label="Remove lane"
            className="flex size-6 items-center justify-center rounded text-content-tertiary hover:text-danger"
          >
            <Icon icon="ic:round-close" className="size-4" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[64px] flex-col gap-3 rounded-xl p-2 ${
          isOver ? 'bg-primary/5 ring-1 ring-primary' : 'bg-page'
        }`}
      >
        {lane.items.length === 0 && (
          <div className="py-5 text-center text-[12px] text-content-tertiary">
            Drag components here
          </div>
        )}
        {lane.items.map((it) => (
          <LaneItem
            key={it.uid}
            item={it}
            onRemove={() => onRemoveItem(it.uid)}
            onUpdate={(p) => onItem(it.uid, p)}
            onMove={(d) => onMoveItem(it.uid, d)}
          />
        ))}
      </div>
    </div>
  );
}

function SplitBlock({
  item,
  onRemove,
  onAddLane,
  onLabel,
  onRemoveLane,
  onItem,
  onRemoveItem,
  onMoveItem,
}: {
  item: Placed;
  onRemove: () => void;
  onAddLane: () => void;
  onLabel: (laneId: string, v: string) => void;
  onRemoveLane: (laneId: string) => void;
  onItem: (laneId: string, uid: string, patch: Partial<Placed>) => void;
  onRemoveItem: (laneId: string, uid: string) => void;
  onMoveItem: (laneId: string, uid: string, dir: -1 | 1) => void;
}) {
  const lanes = item.lanes ?? [];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-[24px] border-2 border-dashed border-primary/50 bg-primary/5 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold text-primary">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag split"
            className="cursor-grab"
          >
            <Icon icon="ic:round-drag-indicator" className="size-4 text-content-tertiary" />
          </button>
          <Icon icon="ic:round-call-split" className="size-5" /> Splits into {lanes.length} paths
        </div>
        <div className="flex gap-2">
          {lanes.length < 3 && (
            <button
              type="button"
              onClick={onAddLane}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-content-subtle"
            >
              + lane
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-danger"
          >
            Remove split
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {lanes.map((lane) => (
          <LaneZone
            key={lane.id}
            splitUid={item.uid}
            lane={lane}
            canRemove={lanes.length > 2}
            onLabel={(v) => onLabel(lane.id, v)}
            onRemoveLane={() => onRemoveLane(lane.id)}
            onItem={(uid, p) => onItem(lane.id, uid, p)}
            onRemoveItem={(uid) => onRemoveItem(lane.id, uid)}
            onMoveItem={(uid, d) => onMoveItem(lane.id, uid, d)}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-success">
        <Icon icon="ic:round-call-merge" className="size-4" /> Rejoins below
      </div>
    </div>
  );
}

// --- Play: the flow as a clean, interactive onboarding demo ---

function FlowPhone({ placed }: { placed: Placed[] }) {
  const renderComp = (item: Placed) => {
    const entry = REGISTRY_MAP[item.type];
    return entry ? entry.Comp(item.props) : null;
  };
  return (
    <div className="flex w-[390px] max-w-full flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-elevated">
      <div className="flex items-center gap-2 border-b border-border-light px-5 py-4">
        <Icon icon="ic:round-auto-awesome" className="size-5 text-primary" />
        <span className="text-[15px] font-bold text-content">Coach</span>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6" style={{ background: '#f9f9f9' }}>
        {placed.length === 0 && (
          <div className="py-16 text-center text-[14px] text-content-tertiary">
            Nothing in the flow yet. Add beats in the middle.
          </div>
        )}
        {placed.map((item) =>
          item.type === 'split' ? (
            <div key={item.uid} className="flex flex-col gap-5">
              {(item.lanes ?? []).map((lane) => (
                <div key={lane.id} className="flex flex-col gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                    {lane.label}
                  </div>
                  {lane.items.map((it) => (
                    <div key={it.uid}>{renderComp(it)}</div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div key={item.uid}>{renderComp(item)}</div>
          ),
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border-light px-4 py-3">
        <div className="flex-1 rounded-full bg-surface-secondary px-4 py-2 text-[14px] text-content-tertiary">
          Type or talk...
        </div>
        <DualButton
          size={44}
          rings
          leftIcon={<Icon icon="ic:round-mic" className="size-5 text-white" />}
          rightIcon={<Icon icon="ic:round-graphic-eq" className="size-5 text-white" />}
          ariaLabel="Voice orb"
        />
      </div>
    </div>
  );
}

function PlayView({ placed, onExit }: { placed: Placed[]; onExit: () => void }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center gap-4 p-6"
      style={{ fontFamily: 'Urbanist, -apple-system, sans-serif', background: '#e8ecf1' }}
    >
      <div className="flex w-[390px] max-w-full items-center justify-between">
        <div className="text-[14px] font-bold text-content">Onboarding preview</div>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
        >
          <Icon icon="ic:round-edit" className="size-4" /> Edit
        </button>
      </div>
      <FlowPhone placed={placed} />
    </div>
  );
}

function PlayPanel({ placed, onFullscreen }: { placed: Placed[]; onFullscreen: () => void }) {
  return (
    <div className="sticky top-5 flex h-[calc(100vh-2.5rem)] w-[420px] shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[15px] font-bold text-content">
          <Icon icon="ic:round-play-circle" className="size-5 text-primary" /> Play (live)
        </div>
        <button
          type="button"
          onClick={onFullscreen}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
        >
          <Icon icon="ic:round-fullscreen" className="size-4" /> Fullscreen
        </button>
      </div>
      <div className="flex flex-1 justify-center overflow-y-auto rounded-2xl border border-border bg-page p-4">
        <FlowPhone placed={placed} />
      </div>
    </div>
  );
}

export function FlowBuilder() {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeFromPalette, setActiveFromPalette] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [beats, setBeats] = useState<{ stage: string; suggested: string }[] | null>(null);
  const [beatsErr, setBeatsErr] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const paletteDrop = useDroppable({ id: 'palette-zone' });
  const removing = paletteDrop.isOver && !activeFromPalette && activeLabel !== null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const init = raw ? JSON.parse(raw) : DEFAULT_FLOW;
      setPlaced(
        (
          init as Array<{
            type: string;
            props?: Record<string, string>;
            beat?: string;
            note?: string;
            sheetStage?: string;
          }>
        ).map((b) => ({
          uid: newUid(b.type),
          type: b.type,
          props: b.props,
          beat: b.beat,
          note: b.note,
          sheetStage: b.sheetStage,
        })),
      );
    } catch {
      setPlaced(buildDefault());
    }
  }, []);

  useEffect(() => {
    if (placed.length)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          placed.map(({ type, props, beat, note, sheetStage }) => ({
            type,
            props,
            beat,
            note,
            sheetStage,
          })),
        ),
      );
    else localStorage.removeItem(STORAGE_KEY);
  }, [placed]);

  // Auto-load the beats sheet so each beat can connect to its sheet context.
  useEffect(() => {
    fetch('https://guidedgrowthos.com/internal/flow/beats')
      .then((r) => r.json())
      .then((d) => (d.error ? setBeatsErr(d.error) : setBeats(d.beats || [])))
      .catch((e) => setBeatsErr(String(e)));
  }, []);

  // When the sheet loads, fill any beat that is linked to a stage but has no
  // context yet (the pre-connected defaults), without overwriting edits.
  useEffect(() => {
    if (!beats || !beats.length) return;
    setPlaced((p) =>
      p.map((it) => {
        if (it.sheetStage && !it.note) {
          const m = beats.find((b) => b.stage === it.sheetStage);
          if (m) return { ...it, note: m.suggested };
        }
        return it;
      }),
    );
  }, [beats]);

  const insertAt = (type: string, index: number) =>
    setPlaced((p) => {
      const i = Math.max(0, Math.min(index, p.length));
      return [...p.slice(0, i), { uid: newUid(type), type }, ...p.slice(i)];
    });

  const insertWhere = (type: string, where: 'top' | 'middle' | 'bottom') =>
    setPlaced((p) => {
      const i = where === 'top' ? 0 : where === 'bottom' ? p.length : Math.floor(p.length / 2);
      return [...p.slice(0, i), { uid: newUid(type), type }, ...p.slice(i)];
    });

  const remove = (uid: string) => setPlaced((p) => p.filter((x) => x.uid !== uid));
  const update = (uid: string, patch: Partial<Placed>) =>
    setPlaced((p) => p.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));

  const addSplit = () =>
    setPlaced((p) => [
      ...p,
      {
        uid: newUid('split'),
        type: 'split',
        lanes: [
          { id: 'l1', label: 'Beginner', items: [] },
          { id: 'l2', label: 'Advanced', items: [] },
        ],
      },
    ]);
  const mutateLanes = (splitUid: string, fn: (lanes: Lane[]) => Lane[]) =>
    setPlaced((p) => p.map((x) => (x.uid === splitUid ? { ...x, lanes: fn(x.lanes ?? []) } : x)));
  const mutateLane = (splitUid: string, laneId: string, fn: (lane: Lane) => Lane) =>
    mutateLanes(splitUid, (lanes) => lanes.map((l) => (l.id === laneId ? fn(l) : l)));
  const addToLane = (splitUid: string, laneId: string, type: string) =>
    mutateLane(splitUid, laneId, (l) => ({
      ...l,
      items: [...l.items, { uid: newUid(type), type }],
    }));
  const updateLaneItem = (splitUid: string, laneId: string, uid: string, patch: Partial<Placed>) =>
    mutateLane(splitUid, laneId, (l) => ({
      ...l,
      items: l.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)),
    }));
  const removeLaneItem = (splitUid: string, laneId: string, uid: string) =>
    mutateLane(splitUid, laneId, (l) => ({ ...l, items: l.items.filter((it) => it.uid !== uid) }));
  const moveLaneItem = (splitUid: string, laneId: string, uid: string, dir: -1 | 1) =>
    mutateLane(splitUid, laneId, (l) => {
      const i = l.items.findIndex((it) => it.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.items.length) return l;
      return { ...l, items: arrayMove(l.items, i, j) };
    });
  const addLane = (splitUid: string) =>
    mutateLanes(splitUid, (lanes) =>
      lanes.length >= 3
        ? lanes
        : [...lanes, { id: newUid('lane'), label: `Path ${lanes.length + 1}`, items: [] }],
    );
  const removeLane = (splitUid: string, laneId: string) =>
    mutateLanes(splitUid, (lanes) =>
      lanes.length <= 2 ? lanes : lanes.filter((l) => l.id !== laneId),
    );
  const setLaneLabel = (splitUid: string, laneId: string, label: string) =>
    mutateLane(splitUid, laneId, (l) => ({ ...l, label }));

  const reset = () => setPlaced(buildDefault());
  const clear = () => setPlaced([]);


  const serializeBeat = (p: Placed, i: number) => ({
    beat: p.beat || String(i + 1),
    name: REGISTRY_MAP[p.type]?.label ?? p.type,
    componentType: p.type,
    context: p.note ?? '',
    props: p.props ?? {},
  });
  const exportJson = JSON.stringify(
    placed.map((p, i) =>
      p.type === 'split'
        ? {
            type: 'split',
            lanes: (p.lanes ?? []).map((l) => ({
              label: l.label,
              beats: l.items.map(serializeBeat),
            })),
          }
        : serializeBeat(p, i),
    ),
    null,
    2,
  );

  const indexFromOver = (overId: string | number) =>
    overId === 'end-zone' ? placed.length : placed.findIndex((x) => x.uid === overId);

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current;
    if (d?.fromPalette) {
      setActiveFromPalette(true);
      setActiveLabel(d.label as string);
    } else {
      setActiveFromPalette(false);
      const it = placed.find((p) => p.uid === e.active.id);
      setActiveLabel(it ? (REGISTRY_MAP[it.type]?.label ?? '') : '');
    }
  };

  const onDragOver = (e: DragOverEvent) => {
    const oid = e.over ? String(e.over.id) : '';
    if (
      !e.active.data.current?.fromPalette ||
      !e.over ||
      oid === 'palette-zone' ||
      oid.startsWith('lane:')
    ) {
      setDropIndex(null);
      return;
    }
    const idx = indexFromOver(e.over.id);
    setDropIndex(idx < 0 ? placed.length : idx);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const fromPalette = e.active.data.current?.fromPalette;
    if (fromPalette) {
      const oid = e.over ? String(e.over.id) : '';
      const type = e.active.data.current!.type as string;
      if (!e.over || oid === 'palette-zone') {
        // Dropped back on the components bucket means cancel, do not add.
      } else if (oid.startsWith('lane:')) {
        const parts = oid.split(':');
        addToLane(parts[1], parts[2], type);
      } else {
        const idx = indexFromOver(e.over.id);
        insertAt(type, idx < 0 ? placed.length : idx);
      }
    } else if (e.over) {
      if (e.over.id === 'palette-zone') {
        // Dragged a flow component back to the components bucket: remove it.
        setPlaced((p) => p.filter((x) => x.uid !== e.active.id));
      } else if (e.active.id !== e.over.id) {
        setPlaced((p) => {
          const from = p.findIndex((x) => x.uid === e.active.id);
          const to =
            e.over!.id === 'end-zone' ? p.length - 1 : p.findIndex((x) => x.uid === e.over!.id);
          if (from < 0 || to < 0) return p;
          return arrayMove(p, from, to);
        });
      }
    }
    setActiveLabel(null);
    setActiveFromPalette(false);
    setDropIndex(null);
  };

  if (play) {
    return <PlayView placed={placed} onExit={() => setPlay(false)} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveLabel(null);
        setDropIndex(null);
      }}
    >
      <div
        className="flex min-h-screen gap-5 p-5"
        style={{ fontFamily: 'Urbanist, -apple-system, sans-serif', background: '#e8ecf1' }}
      >
        {/* Left bucket: every component, rendered. Also a drop target to remove. */}
        <div
          ref={paletteDrop.setNodeRef}
          className={`sticky top-5 flex h-[calc(100vh-2.5rem)] w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface ${
            removing ? 'border-danger ring-2 ring-danger' : 'border-border'
          }`}
        >
          <div className="border-b border-border-light px-4 py-3">
            <div className={`text-[15px] font-bold ${removing ? 'text-danger' : 'text-content'}`}>
              {removing ? 'Drop here to remove' : 'Components'}
            </div>
            <div className="text-[12px] text-content-tertiary">
              drag into the flow, or hover and send to top / middle / bottom
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {GROUPS.map((g) => (
              <div key={g} className="mb-4">
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
                  {g}
                </div>
                <div className="flex flex-col gap-3">
                  {REGISTRY.filter((r) => r.group === g).map((r) => (
                    <PaletteCard key={r.type} item={r} onSend={insertWhere} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right bucket: the flow */}
        <div className="flex flex-1 flex-col items-start gap-3">
          <div className="flex w-[400px] max-w-full items-center justify-between">
            <div className="text-[15px] font-bold text-content">Flow</div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-content-tertiary">{placed.length} components</span>
              <button
                type="button"
                onClick={addSplit}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-primary"
              >
                + Split
              </button>
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
              >
                {showJson ? 'Hide JSON' : 'Export'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
              >
                Clear
              </button>
            </div>
          </div>

          {showJson && (
            <textarea
              readOnly
              value={exportJson}
              onFocus={(e) => e.currentTarget.select()}
              className="h-56 w-[400px] max-w-full rounded-xl border border-border bg-surface p-3 font-mono text-[11px] leading-[1.5] text-content"
            />
          )}

          <div className="w-full">
            <div className="min-h-[200px]">
              {placed.length === 0 && dropIndex === null && (
                <div className="py-16 text-center text-[14px] text-content-tertiary">
                  Drag a component here, or hover one on the left and pick top / middle / bottom.
                </div>
              )}
              <SortableContext
                items={placed.map((p) => p.uid)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-5">
                  {placed.map((item, i) => (
                    <div key={item.uid} className="flex flex-col gap-5">
                      {dropIndex === i && <DropLine />}
                      {item.type === 'split' ? (
                        <SplitBlock
                          item={item}
                          onRemove={() => remove(item.uid)}
                          onAddLane={() => addLane(item.uid)}
                          onLabel={(laneId, v) => setLaneLabel(item.uid, laneId, v)}
                          onRemoveLane={(laneId) => removeLane(item.uid, laneId)}
                          onItem={(laneId, uid, patch) =>
                            updateLaneItem(item.uid, laneId, uid, patch)
                          }
                          onRemoveItem={(laneId, uid) => removeLaneItem(item.uid, laneId, uid)}
                          onMoveItem={(laneId, uid, dir) =>
                            moveLaneItem(item.uid, laneId, uid, dir)
                          }
                        />
                      ) : (
                        <SortableCard
                          item={item}
                          onRemove={() => remove(item.uid)}
                          onUpdate={(patch) => update(item.uid, patch)}
                          sheetBeats={beats ?? []}
                        />
                      )}
                    </div>
                  ))}
                  {dropIndex === placed.length && <DropLine />}
                  <EndZone />
                </div>
              </SortableContext>
            </div>
          </div>
        </div>

        <PlayPanel placed={placed} onFullscreen={() => setPlay(true)} />
      </div>

      <DragOverlay>
        {activeLabel ? (
          <div className="rounded-lg border-2 border-primary bg-surface px-3 py-2 text-[13px] font-semibold text-primary shadow-elevated">
            {activeLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
