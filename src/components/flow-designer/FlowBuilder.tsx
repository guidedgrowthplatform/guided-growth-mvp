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
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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

import { BEAT_DEFS } from './beats';
import { EXTRA_REGISTRY, EXTRA_GROUPS } from './paletteExtras';
import { CheckInResultCard } from '@/components/voice/CheckInResultCard';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { AIPulseVisual } from '@/components/welcome/AIPulseVisual';
import {
  BEAT_TRANSITION_KINDS,
  BeatTransition,
  type BeatTransitionKind,
} from '@/components/welcome/BeatTransition';
import { COACH_BG, USER_BG } from '@/components/welcome/beatMood';
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
// The current user's name, set once for the whole flow via a meta input above
// the canvas. Any text with {name} is substituted at render time.
const UserNameCtx = createContext('Yair');

const applyName = (
  props: Record<string, string> | undefined,
  name: string,
): Record<string, string> | undefined => {
  if (!props) return props;
  const safe = name.trim() || 'there';
  let changed = false;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    const nv = typeof v === 'string' && v.includes('{name}') ? v.split('{name}').join(safe) : v;
    if (nv !== v) changed = true;
    out[k] = nv;
  }
  return changed ? out : props;
};

// Beats live in their own files under ./beats (one per file, design in parallel).
// The step kit (BeatStep, BeatPlayer, Karaoke) is in ./beatKit. The registry below
// merges in everything from ./beats automatically. See beats/README.md.

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
        <Button variant="social-dark" size="auth-slim" fullWidth>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </Button>
        <Button variant="social-light" size="auth-slim" fullWidth>
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
          <Button variant="primary" size="auth-slim" fullWidth>
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
          <Button variant="primary" size="auth-slim" fullWidth>
            Log in
          </Button>
        </div>
      )}
      {mode === 'default' && (
        <Button variant="primary" size="auth-slim" fullWidth onClick={() => setMode('signup')}>
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
  'profile-beat': [
    { key: 'greeting', label: 'Coach: greeting', multiline: true },
    { key: 'askAge', label: 'Coach: ask age' },
    { key: 'askGender', label: 'Coach: ask gender' },
    { key: 'userReply', label: 'User reply', multiline: true },
    { key: 'age', label: 'Age (default)' },
    { key: 'gender', label: 'Gender (default)' },
  ],
  'user-bubble': [
    { key: 'text', label: 'User says', multiline: true },
    { key: 'userName', label: 'Name' },
  ],
  'onboarding-header': [
    { key: 'title', label: 'Title' },
    { key: 'subtitle', label: 'Subtitle' },
  ],
};

// Which prop on each beat carries the coach's spoken opening line (the bubble
// text). This is the beat's openerText in the engine model (voice.openerText).
// The sidecar edits this prop and the rendered bubble reads the same prop, so
// the speech bubble and the beat's coach line stay in sync as one value.
const COACH_LINE_PROP: Record<string, string> = {
  'coach-bubble': 'text',
  'profile-beat': 'greeting',
};

// Imported components that are full-screen modals/overlays. They cannot preview
// as a palette tile (they render fixed, escaping the tile box), so keep them out
// of the palette. The tile/flow previews are also transform-contained as a net.
const PALETTE_DROP = new Set(['confirm-dialog', 'voice-cap-modal']);

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
  ...EXTRA_REGISTRY.filter((e) => !PALETTE_DROP.has(e.type)),
  ...BEAT_DEFS,
];

const REGISTRY_MAP = Object.fromEntries(REGISTRY.map((r) => [r.type, r]));
const GROUPS = [
  'Intro',
  'Auth',
  'Chat',
  'Onboarding',
  'Check-in',
  'Home',
  'Orb',
  'UI',
  ...EXTRA_GROUPS,
];

interface DefaultBeat {
  type: string;
  beat?: string;
  sheetStage?: string;
  props?: Record<string, string>;
  background?: string;
}

// The default onboarding flow, pre-connected to the beats sheet so each beat
// opens with its real context. Several components can share one sheet stage
// (profile setup is name + age + gender), so they share a beat number.
const DEFAULT_FLOW: DefaultBeat[] = [
  { type: 'splash-intro', beat: '1' },
  { type: 'auth-signup', beat: '2' },
  {
    type: 'mic-permission',
    beat: '3',
    props: {
      ask: 'Can I turn on your mic so we can talk out loud?',
      note: 'Tap the orb to allow it.',
    },
  },
  {
    type: 'profile-beat',
    beat: '4',
    sheetStage: 'ONBOARD-01--FORM: Profile Setup',
    props: {
      greeting: 'Awesome {name}, two quick things so I can tailor this to you.',
      askAge: 'How old are you?',
      askGender: "And what's your gender?",
      userReply: "I'm 28, and I'm male.",
      age: '28',
      gender: 'Male',
    },
  },
  { type: 'path-selection', beat: '5', sheetStage: 'ONBOARD-FORK--FORM: Experience Fork' },
  { type: 'category-grid', beat: '6', sheetStage: 'ONBOARD-BEGINNER-01: Category Selection' },
  { type: 'goals-list', beat: '7', sheetStage: 'ONBOARD-BEGINNER-02: Subcategory Selection' },
  { type: 'habit-picker', beat: '8', sheetStage: 'ONBOARD-BEGINNER-03: Habit Selection' },
  { type: 'reflection-card', beat: '9', sheetStage: 'ONBOARD-BEGINNER-07: Journal Setup' },
  { type: 'plan-cards', beat: '10' },
];

const ONBOARDING_FLOW = DEFAULT_FLOW;

// Additional flows you can design in the builder. Same components, same beat
// model, just a different starter set. Seeded from the check-in components.
const MORNING_CHECKIN_FLOW: DefaultBeat[] = [
  {
    type: 'coach-bubble',
    beat: '1',
    props: { text: 'Good morning. How are you feeling as you start the day?' },
  },
  { type: 'mood-row', beat: '2' },
  {
    type: 'coach-bubble',
    beat: '3',
    props: { text: "What's one thing that would make today feel like a win?" },
  },
  {
    type: 'user-bubble',
    beat: '4',
    props: { text: 'Finish the deck and get a walk in.', userName: 'You' },
  },
  { type: 'habit-suggestion', beat: '5' },
];

const EVENING_CHECKIN_FLOW: DefaultBeat[] = [
  { type: 'coach-bubble', beat: '1', props: { text: 'Welcome back. How did today go?' } },
  { type: 'mood-row', beat: '2' },
  {
    type: 'coach-bubble',
    beat: '3',
    props: { text: 'What went well, and what felt hard?' },
  },
  {
    type: 'user-bubble',
    beat: '4',
    props: { text: 'Focused all morning, lost steam after lunch.', userName: 'You' },
  },
  { type: 'checkin-receipt', beat: '5' },
];

interface FlowDef {
  id: string;
  label: string;
  beats: DefaultBeat[];
}

const FLOWS: FlowDef[] = [
  { id: 'onboarding', label: 'Onboarding', beats: ONBOARDING_FLOW },
  { id: 'morning-checkin', label: 'Morning check-in', beats: MORNING_CHECKIN_FLOW },
  { id: 'evening-checkin', label: 'Evening check-in', beats: EVENING_CHECKIN_FLOW },
];
const FLOW_MAP: Record<string, FlowDef> = Object.fromEntries(FLOWS.map((f) => [f.id, f]));

const STORAGE_BASE = 'gg-flow-builder-v16';
const flowKey = (flowId: string) => `${STORAGE_BASE}:${flowId}`;
const ACTIVE_FLOW_KEY = `${STORAGE_BASE}:active`;

type StoredBeat = {
  type: string;
  props?: Record<string, string>;
  beat?: string;
  note?: string;
  sheetStage?: string;
  transition?: { kind: BeatTransitionKind; durationMs: number };
  background?: string;
};

// Every beat is coach-led or user-led; default to coach, user bubbles to user.
const hydrate = (stored: StoredBeat[]): Placed[] =>
  stored.map((b) => ({
    uid: newUid(b.type),
    type: b.type,
    props: b.props,
    beat: b.beat,
    note: b.note,
    sheetStage: b.sheetStage,
    transition: b.transition,
    background: b.background ?? (b.type === 'user-bubble' ? 'user' : 'coach'),
  }));

const serialize = (items: Placed[]): StoredBeat[] =>
  items.map(({ type, props, beat, note, sheetStage, transition, background }) => ({
    type,
    props,
    beat,
    note,
    sheetStage,
    transition,
    background,
  }));

const buildDefault = (flowId: string): Placed[] =>
  hydrate((FLOW_MAP[flowId]?.beats ?? ONBOARDING_FLOW) as StoredBeat[]);

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
  // The transition played when advancing FROM this beat to the next one
  // (the edge to the next beat). Presentation only, no AI data.
  transition?: { kind: BeatTransitionKind; durationMs: number };
  // The screen background for this beat, by who leads it (coach / user / a warm
  // chat) or plain for full-screen UI. Presentation only. See BACKGROUNDS.
  background?: string;
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
      <div className="pointer-events-none overflow-hidden [transform:translateZ(0)]">
        {createElement(item.Comp)}
      </div>
      <SendButtons onSend={(where) => onSend(item.type, where)} />
    </div>
  );
}

// The connector between two consecutive beats: a line plus a transition picker
// (kind + duration). Edits the transition on the edge to the next beat.
function BeatConnector({
  transition,
  onChange,
}: {
  transition?: { kind: BeatTransitionKind; durationMs: number };
  onChange: (t: { kind: BeatTransitionKind; durationMs: number }) => void;
}) {
  const kind = transition?.kind ?? 'dissolve';
  const durationMs = transition?.durationMs ?? 600;
  return (
    <div className="ml-[85px] flex flex-col items-center gap-1">
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 shadow-card">
        <Icon icon="ic:round-bolt" className="size-3.5 text-primary" />
        <select
          value={kind}
          onChange={(e) => onChange({ kind: e.target.value as BeatTransitionKind, durationMs })}
          className="bg-transparent text-[11px] font-semibold text-content focus:outline-none"
        >
          {BEAT_TRANSITION_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={100}
          max={3000}
          step={50}
          value={durationMs}
          onChange={(e) => onChange({ kind, durationMs: Number(e.target.value) || 600 })}
          className="w-14 rounded border border-border bg-page px-1 py-0.5 text-[11px] text-content"
        />
        <span className="text-[10px] text-content-tertiary">ms</span>
      </div>
      <div className="h-3 w-px bg-border" />
    </div>
  );
}

// The voice orb that sits on the bottom of every beat screen. Static here (both
// halves blue, the locked unified-dial look); the real DualButton drives it.
function BeatOrb({ size = 56 }: { size?: number }) {
  const glyph = Math.round(size * 0.3);
  return (
    <DualButton
      size={size}
      leftActive
      rightActive
      activeRings="idle"
      intensity={0.45}
      leftIcon={<Icon icon="solar:chat-round-line-bold" className="text-white" width={glyph} />}
      rightIcon={<Icon icon="ic:round-mic-off" className="text-white" width={glyph} />}
      ariaLabel="Voice orb"
    />
  );
}

// Presentation-only replica of the app's bottom nav (the real one is router +
// context bound and would crash standalone). The orb sits in the center notch.
// This is the menu bar on the bottom of every check-in screen.
function BuilderBottomNav() {
  const tab = (icon: string, label: string, active = false) => (
    <div
      className={`flex flex-col items-center justify-end ${active ? 'text-primary' : 'text-content-tertiary'}`}
    >
      <Icon icon={icon} width={22} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </div>
  );
  return (
    <div className="relative" style={{ height: 64 }}>
      <div
        className="absolute inset-0 flex"
        style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))' }}
      >
        <div className="h-full flex-1 bg-surface" />
        <svg
          className="block h-full shrink-0 text-surface"
          width="120"
          height="64"
          viewBox="0 0 140 72"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 0 L14 0 C17 0, 19 1, 20 4 C20 28, 42 50, 70 50 C98 50, 120 28, 120 4 C121 1, 123 0, 126 0 L140 0 L140 72 L0 72 Z"
            fill="currentColor"
          />
        </svg>
        <div className="h-full flex-1 bg-surface" />
      </div>
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <BeatOrb size={52} />
      </div>
      <div className="relative grid h-full grid-cols-5 items-end px-4 pb-2">
        {tab('ic:round-home', 'Home', true)}
        {tab('ic:round-leaderboard', 'Progress')}
        <div />
        {tab('mingcute:stopwatch-fill', 'Focus')}
        {tab('ic:round-person', 'Profile')}
      </div>
    </div>
  );
}

// The phone renders at the app's real device width so every component keeps its
// true proportions, then the whole frame is scaled down to fit the canvas.
const DEVICE_W = 390;
const DEVICE_H = 844;
const PHONE_SCALE = 0.77;
const PHONE_DISPLAY_W = Math.round(DEVICE_W * PHONE_SCALE);
const PHONE_DISPLAY_H = Math.round(DEVICE_H * PHONE_SCALE);

// Per-beat screen background, a soft gradient chosen by who leads the beat:
// coach (blue) or user (warm). Plain (white) for a flat full-screen UI.
const BACKGROUNDS: { id: string; label: string; color: string }[] = [
  { id: 'coach', label: 'Coach', color: COACH_BG },
  { id: 'user', label: 'User', color: USER_BG },
  { id: 'plain', label: 'Plain', color: '#ffffff' },
];
const BG_MAP: Record<string, string> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b.color]));
const bgColor = (id?: string) => BG_MAP[id ?? ''] ?? BG_MAP.coach;

// The inner content + bottom chrome of a phone screen, filling its positioned
// parent. Content is vertically centered (my-auto) so a short screen like auth
// does not float at the top, and still scrolls from the top when it overflows.
function PhoneScreenInner({
  children,
  checkin,
  bg,
}: {
  children: ReactNode;
  checkin: boolean;
  bg?: string;
}) {
  return (
    <div className="absolute inset-0 bg-surface">
      {/* Full-height gradient so the color reaches the very bottom edge; the orb
          floats on top of it instead of sitting on a white strip. */}
      <div className="absolute inset-0" style={{ background: bgColor(bg) }} />
      <div
        className="absolute inset-x-0 top-0 flex flex-col overflow-y-auto px-4 [transform:translateZ(0)]"
        style={{ bottom: checkin ? 64 : 84 }}
      >
        <div className="my-auto w-full py-6">{children}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        {checkin ? (
          <BuilderBottomNav />
        ) : (
          <div className="flex justify-center pb-5 pt-2">
            <BeatOrb size={58} />
          </div>
        )}
      </div>
    </div>
  );
}

// The bordered phone frame around one beat in the build canvas.
function PhoneScreenFrame({
  children,
  checkin,
  bg,
}: {
  children: ReactNode;
  checkin: boolean;
  bg?: string;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[34px] border-[3px] border-[#e2e8f0] bg-surface shadow-elevated"
      style={{ width: PHONE_DISPLAY_W, height: PHONE_DISPLAY_H }}
    >
      <div
        className="relative"
        style={{
          width: DEVICE_W,
          height: DEVICE_H,
          transform: `scale(${PHONE_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        <PhoneScreenInner checkin={checkin} bg={bg}>
          {children}
        </PhoneScreenInner>
      </div>
    </div>
  );
}

function SortableCard({
  item,
  onRemove,
  onUpdate,
  sheetBeats,
  checkin,
}: {
  item: Placed;
  onRemove: () => void;
  onUpdate: (patch: Partial<Placed>) => void;
  sheetBeats: { stage: string; suggested: string }[];
  checkin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });
  const entry = REGISTRY_MAP[item.type];
  const fields = TEXT_FIELDS[item.type];
  const coachLineKey = COACH_LINE_PROP[item.type];
  const uname = useContext(UserNameCtx);
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
      {/* The beat card: a phone-screen frame plus optional text editor */}
      <div className="relative w-[300px] shrink-0">
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

        <PhoneScreenFrame checkin={checkin} bg={item.background}>
          {entry ? createElement(entry.Comp, applyName(item.props, uname)) : null}
        </PhoneScreenFrame>
      </div>

      {/* Metadata sidecar: beat number, coach line, sheet link, context. The
          coach line and the context block are this beat's single source of
          truth (engine: voice.openerText + context.contextBlock). */}
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
        {coachLineKey && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Coach line (spoken)
            </span>
            <textarea
              value={item.props?.[coachLineKey] ?? ''}
              onChange={(e) => setField(coachLineKey, e.target.value)}
              placeholder="what the coach says out loud"
              rows={2}
              className="w-full resize-none rounded-md border border-primary/40 bg-page px-2 py-1.5 text-[12px] leading-[1.5] text-content"
            />
          </label>
        )}
        {fields
          ?.filter((f) => f.key !== coachLineKey)
          .map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
                {f.label}
              </span>
              {f.multiline ? (
                <textarea
                  value={item.props?.[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.label}
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[12px] leading-[1.5] text-content"
                />
              ) : (
                <input
                  value={item.props?.[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.label}
                  className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-[12px] text-content"
                />
              )}
            </label>
          ))}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Background (who leads)
          </span>
          <div className="flex items-center gap-1">
            {BACKGROUNDS.map((b) => {
              const active = (item.background ?? 'plain') === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  title={b.label}
                  onClick={() => onUpdate({ background: b.id })}
                  className={`flex h-7 flex-1 items-center justify-center rounded-md border text-[9px] font-bold ${
                    active
                      ? 'border-primary text-content ring-1 ring-primary'
                      : 'border-border text-content-tertiary'
                  }`}
                  style={{ background: b.color }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
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
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Beat context
          </span>
          <textarea
            value={item.note ?? ''}
            onChange={(e) => onUpdate({ note: e.target.value })}
            placeholder="what the coach is doing here"
            rows={5}
            className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[11px] leading-[1.5] text-content"
          />
        </label>
        <BeatAiBox type={item.type} />
      </div>
    </div>
  );
}

// Per-beat AI box: type a prompt, it runs the AI headless on this beat's file
// (Codex by default, free via the ChatGPT login), the file edits, HMR reloads
// the beat. Dev-only; the /__beat-ai endpoint exists only when serving locally.
function BeatAiBox({ type }: { type: string }) {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<'codex' | 'claude'>('claude');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [log, setLog] = useState('');
  if (!import.meta.env.DEV) return null;

  const send = async () => {
    const p = prompt.trim();
    if (!p || status === 'running') return;
    setStatus('running');
    setLog('');
    try {
      const res = await fetch('/__beat-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt: p, engine }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('done');
        setLog(data.summary || 'Updated. The beat reloads automatically.');
        setPrompt('');
      } else {
        setStatus('error');
        setLog(data.error || 'Failed.');
      }
    } catch (e) {
      setStatus('error');
      setLog(String(e));
    }
  };

  const statusText =
    status === 'running'
      ? `${engine} is editing this beat...`
      : status === 'done'
        ? 'Done, reloading'
        : status === 'error'
          ? 'Error'
          : engine === 'codex'
            ? 'Codex, free'
            : 'Claude';

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon icon="ic:round-auto-awesome" className="size-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
            Ask AI to edit this beat
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEngine((e) => (e === 'codex' ? 'claude' : 'codex'))}
          title="Switch engine"
          className="rounded border border-border bg-page px-1.5 py-0.5 text-[9px] font-semibold uppercase text-content-tertiary"
        >
          {engine}
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
        }}
        placeholder={'e.g. add a "great, thanks" coach line after the age picker'}
        rows={2}
        disabled={status === 'running'}
        className="w-full resize-none rounded-md border border-border bg-page px-2 py-1.5 text-[11px] leading-[1.5] text-content disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] ${
            status === 'error'
              ? 'text-danger'
              : status === 'done'
                ? 'text-emerald-600'
                : 'text-content-tertiary'
          }`}
        >
          {statusText}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={status === 'running' || !prompt.trim()}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {status === 'running' ? 'Working...' : 'Send'}
        </button>
      </div>
      {log && (
        <div className="max-h-20 overflow-auto whitespace-pre-wrap rounded bg-page/70 px-2 py-1 text-[10px] leading-snug text-content-tertiary">
          {log}
        </div>
      )}
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
  const uname = useContext(UserNameCtx);
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
      <div className="overflow-hidden [transform:translateZ(0)]">
        {entry ? createElement(entry.Comp, applyName(item.props, uname)) : null}
      </div>
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

function FlowPhone({ placed, flowId }: { placed: Placed[]; flowId: string }) {
  // Stepped player: shows one beat at a time and plays the edge transition when
  // advancing. Uses the same phone frame + chrome (orb / menu bar) as the build
  // canvas so the preview and the editor read as the same screen.
  const checkin = flowId.includes('checkin');
  const uname = useContext(UserNameCtx);
  const [step, setStep] = useState(0);
  const [advancing, setAdvancing] = useState(false);

  const renderComp = (item: Placed) => {
    const entry = REGISTRY_MAP[item.type];
    if (!entry) return null;
    return (
      <div className="overflow-hidden [transform:translateZ(0)]">
        {createElement(entry.Comp, applyName(item.props, uname))}
      </div>
    );
  };

  const beatBody = (item: Placed): ReactNode =>
    item.type === 'split' ? (
      <div className="flex flex-col gap-5">
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
      renderComp(item)
    );

  const screen = (item: Placed) => (
    <PhoneScreenInner checkin={checkin} bg={item.background}>
      {beatBody(item)}
    </PhoneScreenInner>
  );

  const beats = placed;
  const current = beats[step] ?? beats[0];
  const next = beats[step + 1];

  useEffect(() => {
    if (step > beats.length - 1) setStep(Math.max(0, beats.length - 1));
  }, [beats.length, step]);

  const advance = () => {
    if (!next || advancing) return;
    setAdvancing(true);
    const dur = current?.transition?.durationMs ?? 600;
    window.setTimeout(() => {
      setStep((s) => s + 1);
      setAdvancing(false);
    }, dur);
  };
  const goBack = () => {
    setAdvancing(false);
    setStep((s) => Math.max(0, s - 1));
  };
  const restart = () => {
    setAdvancing(false);
    setStep(0);
  };

  const kind = current?.transition?.kind ?? 'dissolve';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative shrink-0 overflow-hidden rounded-[34px] border-[3px] border-[#e2e8f0] bg-surface shadow-elevated"
        style={{ width: PHONE_DISPLAY_W, height: PHONE_DISPLAY_H }}
      >
        <div
          className="relative"
          style={{
            width: DEVICE_W,
            height: DEVICE_H,
            transform: `scale(${PHONE_SCALE})`,
            transformOrigin: 'top left',
          }}
        >
          {beats.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-content-tertiary">
              Nothing in the flow yet. Add beats in the middle.
            </div>
          ) : next ? (
            <BeatTransition
              key={step}
              first={screen(current)}
              second={screen(next)}
              showSecond={advancing}
              kind={kind}
              durationMs={current?.transition?.durationMs ?? 600}
            />
          ) : (
            screen(current)
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2" style={{ width: PHONE_DISPLAY_W }}>
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-content-subtle disabled:opacity-40"
        >
          <Icon icon="ic:round-arrow-back" className="size-4" /> Back
        </button>
        <span className="text-[11px] font-medium text-content-tertiary">
          Beat {Math.min(step + 1, beats.length || 1)} / {beats.length || 0}
          {next ? ` · ${kind}` : ''}
        </span>
        {next ? (
          <button
            type="button"
            onClick={advance}
            disabled={advancing}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Next <Icon icon="ic:round-arrow-forward" className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={restart}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-content-subtle"
          >
            <Icon icon="ic:round-replay" className="size-4" /> Restart
          </button>
        )}
      </div>
    </div>
  );
}

function PlayView({
  placed,
  flowId,
  onExit,
}: {
  placed: Placed[];
  flowId: string;
  onExit: () => void;
}) {
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
      <FlowPhone placed={placed} flowId={flowId} />
    </div>
  );
}

function PlayPanel({
  placed,
  flowId,
  onFullscreen,
}: {
  placed: Placed[];
  flowId: string;
  onFullscreen: () => void;
}) {
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
        <FlowPhone placed={placed} flowId={flowId} />
      </div>
    </div>
  );
}

export function FlowBuilder() {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [flowId, setFlowId] = useState<string>('onboarding');
  const [userName, setUserName] = useState('Yair');
  const hydratedRef = useRef(false);
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

  // On mount, restore the last active flow and its beats.
  useEffect(() => {
    let fid = 'onboarding';
    try {
      const a = localStorage.getItem(ACTIVE_FLOW_KEY);
      if (a && FLOW_MAP[a]) fid = a;
    } catch {
      /* ignore */
    }
    setFlowId(fid);
    try {
      const raw = localStorage.getItem(flowKey(fid));
      setPlaced(raw ? hydrate(JSON.parse(raw) as StoredBeat[]) : buildDefault(fid));
    } catch {
      setPlaced(buildDefault(fid));
    }
    try {
      const n = localStorage.getItem(`${STORAGE_BASE}:username`);
      if (n) setUserName(n);
    } catch {
      /* ignore */
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(`${STORAGE_BASE}:username`, userName);
    } catch {
      /* ignore */
    }
  }, [userName]);

  // Persist the active flow's beats. Skip until hydrated so the mount pass does
  // not wipe a saved flow before it loads.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (placed.length) localStorage.setItem(flowKey(flowId), JSON.stringify(serialize(placed)));
      else localStorage.removeItem(flowKey(flowId));
    } catch {
      /* ignore */
    }
  }, [placed, flowId]);

  // Switch flows: save the current one, load the target, remember the choice.
  const switchFlow = (newId: string) => {
    if (newId === flowId || !FLOW_MAP[newId]) return;
    try {
      if (placed.length) localStorage.setItem(flowKey(flowId), JSON.stringify(serialize(placed)));
      localStorage.setItem(ACTIVE_FLOW_KEY, newId);
    } catch {
      /* ignore */
    }
    let next: Placed[];
    try {
      const raw = localStorage.getItem(flowKey(newId));
      next = raw ? hydrate(JSON.parse(raw) as StoredBeat[]) : buildDefault(newId);
    } catch {
      next = buildDefault(newId);
    }
    setFlowId(newId);
    setPlaced(next);
  };

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
    setPlaced((p) => {
      const target = p.find((x) => x.uid === uid);
      // A beat's context (note) and sheet connection are shared by every
      // component in that beat, so editing one applies to all of its siblings.
      const sharedKeys: (keyof Placed)[] = (['note', 'sheetStage'] as const).filter(
        (k) => k in patch,
      );
      const shareAcrossBeat = target?.beat && sharedKeys.length > 0;
      return p.map((x) => {
        if (x.uid === uid) return { ...x, ...patch };
        if (shareAcrossBeat && x.beat === target!.beat) {
          const shared: Partial<Placed> = {};
          for (const k of sharedKeys) (shared as Record<string, unknown>)[k] = patch[k];
          return { ...x, ...shared };
        }
        return x;
      });
    });

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

  const reset = () => setPlaced(buildDefault(flowId));
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
    return (
      <UserNameCtx.Provider value={userName}>
        <PlayView placed={placed} flowId={flowId} onExit={() => setPlay(false)} />
      </UserNameCtx.Provider>
    );
  }

  return (
    <UserNameCtx.Provider value={userName}>
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
          <div className="flex w-[400px] max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <Icon icon="ic:round-person" className="size-4 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-content-tertiary">
              User's name
            </span>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Yair"
              className="min-w-0 flex-1 rounded-md border border-border bg-page px-2 py-1 text-[13px] text-content"
            />
            <span className="shrink-0 text-[10px] text-content-tertiary">fills {'{name}'}</span>
          </div>
          <div className="flex w-[400px] max-w-full flex-wrap items-center gap-1.5">
            {FLOWS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => switchFlow(f.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  f.id === flowId
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-content-subtle hover:text-content'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
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
                          checkin={flowId.includes('checkin')}
                        />
                      )}
                      {i < placed.length - 1 && (
                        <BeatConnector
                          transition={item.transition}
                          onChange={(t) => update(item.uid, { transition: t })}
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

        <PlayPanel placed={placed} flowId={flowId} onFullscreen={() => setPlay(true)} />
      </div>

      <DragOverlay>
        {activeLabel ? (
          <div className="rounded-lg border-2 border-primary bg-surface px-3 py-2 text-[13px] font-semibold text-primary shadow-elevated">
            {activeLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </UserNameCtx.Provider>
  );
}
