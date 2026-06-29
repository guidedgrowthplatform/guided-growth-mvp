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
import { HabitItem } from '@/components/home/HabitItem';
import { HabitListItem } from '@/components/home/HabitListItem';
import { HomeHeader } from '@/components/home/HomeHeader';
import { QuickActionCards } from '@/components/home/QuickActionCards';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { HabitScheduleCard } from '@/components/onboarding/HabitScheduleCard';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { SchedulePicker, type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DayPicker } from '@/components/ui/DayPicker';
import { DualButton } from '@/components/ui/DualButton';
import { BeatOrb, orbConfigForType, type OrbConfig } from './BeatOrb';
import { clipsForStage } from './beatAudio';
import { Toggle } from '@/components/ui/Toggle';
import { ChatBubble } from '@/components/voice/ChatBubble';

import { BEAT_DEFS } from './beats';
import { PlayingCtx, AnimationsCtx, useAnimations, Karaoke } from './beatKit';
import { FlowStateCtx, type FlowState, type HabitScheduleCfg } from './flowStateCtx';
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

/**
 * FlowBuilder, two buckets. Left: every real component. Right: the flow.
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

function HabitItemPreview() {
  const [status, setStatus] = useState<'done' | 'missed' | 'none'>('none');
  return (
    <HabitItem
      name="No screens after 10 PM"
      subtitle="10:00 PM"
      streak={6}
      isCompleted={status === 'done'}
      status={status}
      onToggleComplete={() => setStatus((s) => (s === 'done' ? 'none' : 'done'))}
      onMarkMissed={() => setStatus((s) => (s === 'missed' ? 'none' : 'missed'))}
    />
  );
}

function HabitScheduleCardPreview() {
  const [polarity, setPolarity] = useState<'build' | 'break'>('build');
  const [days, setDays] = useState<Set<number>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <div className="flex w-full items-center justify-between rounded-[20px] border border-border-light bg-surface px-[16px] py-[14px] shadow-sm">
        <span className="text-[14px] font-semibold text-content-tertiary">Habit deleted</span>
        <button
          type="button"
          onClick={() => setDeleted(false)}
          className="text-[14px] font-semibold text-primary"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <>
      <HabitScheduleCard
        habitName="Read 10 pages"
        polarity={polarity}
        selectedDays={days}
        onChangePolarity={setPolarity}
        onToggleDay={(d) =>
          setDays((prev) => {
            const next = new Set(prev);
            if (next.has(d)) next.delete(d);
            else next.add(d);
            return next;
          })
        }
        onEdit={() => {}}
        onDelete={() => setConfirmingDelete(true)}
      />
      {confirmingDelete && (
        <DeleteHabitModal
          onDelete={() => {
            setConfirmingDelete(false);
            setDeleted(true);
          }}
          onKeep={() => setConfirmingDelete(false)}
        />
      )}
    </>
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

function AgePicker() {
  const [age, setAge] = useState<number | ''>(28);
  return <AgeScrollPicker value={age} onChange={setAge} />;
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
  'qa-control': [
    { key: 'title', label: 'Title' },
    { key: 'subtitle', label: 'Subtitle', multiline: true },
    { key: 'users', label: 'Test users (comma separated)', multiline: true },
    { key: 'loginLabel', label: 'Log in: label' },
    { key: 'loginDesc', label: 'Log in: description', multiline: true },
    { key: 'restartLabel', label: 'Restart fresh: label' },
    { key: 'restartDesc', label: 'Restart fresh: description', multiline: true },
    { key: 'reonboardLabel', label: 'Re-run (keep data): label' },
    { key: 'reonboardDesc', label: 'Re-run (keep data): description', multiline: true },
    { key: 'resetLabel', label: 'Reset only: label' },
    { key: 'resetDesc', label: 'Reset only: description', multiline: true },
  ],
};

// Which prop on each beat carries the coach's spoken opening line (the bubble
// text). This is the beat's openerText in the engine model (voice.openerText).
// The sidecar edits this prop and the rendered bubble reads the same prop, so
// the speech bubble and the beat's coach line stay in sync as one value.
const COACH_LINE_PROP: Record<string, string> = {
  'coach-bubble': 'text',
  'mic-permission': 'coachLine',
  'profile-beat': 'greeting',
  'why-intro': 'coachLine',
  'path-selection': 'coachLine',
  'category-grid': 'coachLine',
  'goals-list': 'coachLine',
  'habit-picker': 'coachLine',
  'reflection-card': 'coachLine',
  'plan-cards': 'coachLine',
  'habit-schedule': 'coachLine',
  'morning-checkin-setup': 'coachLine',
  'into-app': 'coachLine',
  'state-check': 'coachLine',
  'home-tour': 'coachLine',
  'weekly-projection': 'coachLine',
  'advanced-capture': 'coachLine',
  'advanced-frequency': 'coachLine',
};

// Imported components that are full-screen modals/overlays. They cannot preview
// as a palette tile (they render fixed, escaping the tile box), so keep them out
// of the palette. The tile/flow previews are also transform-contained as a net.
const PALETTE_DROP = new Set(['confirm-dialog', 'voice-cap-modal']);

const REGISTRY: PaletteItem[] = [
  // splash-intro and auth-signup are now editable beat files in beats/ (they
  // override here via BEAT_DEFS). Kept out of this inline list to avoid palette
  // duplicates.
  { type: 'age-picker', group: 'Onboarding', label: 'Age picker', Comp: AgePicker },
  { type: 'coach-bubble', group: 'Chat', label: 'Coach message', Comp: CoachBubble },
  { type: 'user-bubble', group: 'Chat', label: 'User message', Comp: UserBubble },
  { type: 'typing', group: 'Chat', label: 'Typing dots', Comp: TypingDots },
  { type: 'onboarding-header', group: 'Onboarding', label: 'Screen header', Comp: OnboardingTitle },
  { type: 'profile-input', group: 'Onboarding', label: 'Name input', Comp: ProfileInput },
  { type: 'gender-chips', group: 'Onboarding', label: 'Gender chips', Comp: GenderChips },
  // path-selection, category-grid, goals-list, habit-picker are now editable
  // beat files in beats/ (they override here via BEAT_DEFS).
  { type: 'habit-summary', group: 'Onboarding', label: 'Habit summary', Comp: HabitSummary },
  { type: 'schedule-picker', group: 'Onboarding', label: 'Schedule picker', Comp: SchedulePick },
  // reflection-card and plan-cards are now editable beat files in beats/ (they
  // override here via BEAT_DEFS).
  { type: 'mood-row', group: 'Check-in', label: 'Mood row', Comp: MoodRow },
  { type: 'checkin-receipt', group: 'Check-in', label: 'Check-in receipt', Comp: CheckinReceipt },
  { type: 'habit-suggestion', group: 'Check-in', label: 'Habit suggestion', Comp: HabitSuggestion },
  { type: 'home-greeting', group: 'Home', label: 'Home header', Comp: HomeGreeting },
  { type: 'home-datestrip', group: 'Home', label: 'Date strip', Comp: HomeDateStrip },
  { type: 'home-quickactions', group: 'Home', label: 'Quick actions', Comp: HomeQuickActions },
  { type: 'home-habit', group: 'Home', label: 'Habit row', Comp: HomeHabit },
  { type: 'habit-item', group: 'Home', label: 'Habit row (no note)', Comp: HabitItemPreview },
  { type: 'home-progress', group: 'Home', label: 'Daily progress', Comp: HomeProgress },
  { type: 'pulse-orb', group: 'Orb', label: 'Pulse orb', Comp: PulseOrb },
  { type: 'voice-orb', group: 'Orb', label: 'Voice orb (dial)', Comp: VoiceOrb },
  { type: 'primary-button', group: 'UI', label: 'Primary button', Comp: PrimaryButton },
  { type: 'toggle-row', group: 'UI', label: 'Toggle', Comp: ToggleRow },
  { type: 'daypicker-row', group: 'UI', label: 'Day picker', Comp: DayPickerRow },
  {
    type: 'habit-schedule-card',
    group: 'Onboarding',
    label: 'Habit schedule (Build/Break)',
    Comp: HabitScheduleCardPreview,
  },
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
  'QA',
  ...EXTRA_GROUPS,
];

interface DefaultBeat {
  type: string;
  beat?: string;
  sheetStage?: string;
  props?: Record<string, string>;
  background?: string;
  variant?: FlowVariant;
  // Which runtime path this beat belongs to: the beginner card path (new), the
  // advanced read-a-list path (exp), or both (undefined). The player shows only
  // the beats matching the path the user picks, so the fork runs live.
  showOnPath?: 'new' | 'exp';
}

// The default onboarding flow, pre-connected to the beats sheet so each beat
// opens with its real context. Several components can share one sheet stage
// (profile setup is name + age + gender), so they share a beat number.
const DEFAULT_FLOW: DefaultBeat[] = [
  // The full onboarding, start to finish. background = who leads (coach blue when
  // the coach speaks, user yellow when you act). The orb state per beat lives in
  // orbConfigForType (BeatOrb.tsx). coachLine is the spoken line that carries you
  // to the next beat.
  // QA-only entry screen: pick a test user, then choose how to start (log in /
  // restart fresh / re-run keeping data / reset only). Tagged 'qa' so the
  // Production variant skips it and real users never see it. Copy lives in props
  // so the export carries it intact to the engine (each action maps to a real
  // auth/reset call on the app side: login, qa-reset+onboard, re-onboard, qa-reset).
  {
    type: 'qa-control',
    beat: '0',
    background: 'plain',
    variant: 'qa',
    props: {
      title: 'QA Control',
      subtitle: 'Pick a test user, then choose how to start.',
      users: 'Yair,Alejandro,Yonas,Mintesnot,Timothy',
      loginLabel: 'Log in',
      loginDesc: 'Sign in and go to where this user left off.',
      restartLabel: 'Restart onboarding (fresh)',
      restartDesc: 'Delete this user data, keep the account, run onboarding from the top.',
      reonboardLabel: 'Re-run onboarding (keep data)',
      reonboardDesc: 'Go through onboarding again with the data already saved.',
      resetLabel: 'Reset data only',
      resetDesc: 'Wipe this user data, keep the account. No onboarding.',
    },
  },
  { type: 'splash', beat: '1', background: 'coach' },
  { type: 'get-started', beat: '2', background: 'coach' },
  { type: 'splash-intro', beat: '3', background: 'coach' },
  { type: 'auth-signup', beat: '4', background: 'coach' },
  {
    type: 'mic-permission',
    beat: '5',
    background: 'coach',
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
      coachLine:
        "I'd love to actually talk with you. If you let me use your mic, you can just speak. You can always type instead.",
    },
  },
  {
    // Profile: age + gender only. No name field. Name was captured at sign-up;
    // the coach greets the user by name here (spoken via Cartesia).
    type: 'profile-beat',
    beat: '6',
    background: 'coach',
    sheetStage: 'ONBOARD-01--FORM: Profile Setup',
    props: {
      greeting: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
      askAge: 'How old are you?',
      askGender: 'And your gender?',
      userReply: "I'm 28, and I'm male.",
      age: '28',
      gender: 'Male',
    },
  },
  {
    // Why intro: onboarding-only beat, shown once. Frames why we check in:
    // this is your first habit, checking in is simple and good. Does NOT explain
    // check-in mechanics; kept separate so it does not confuse with the actual check-in.
    type: 'why-intro',
    beat: '7',
    background: 'coach',
    sheetStage: 'ONBOARD-WHY-INTRO: Why We Check In',
    props: {
      coachLine:
        "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
    },
  },
  {
    // 8a: The user DOES their first check-in right now (the state card).
    // The point is NOT "because it is morning", we start them with a habit NOW.
    type: 'state-check',
    beat: '8a',
    background: 'coach',
    sheetStage: 'ONBOARD-STATE-CHECK: First State Check',
    props: {
      coachLine:
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    },
  },
  {
    // 8b: Set the daily check-in time. Reminder ON by default.
    type: 'morning-checkin-setup',
    beat: '8b',
    background: 'coach',
    sheetStage: 'ONBOARD-MORNING-SETUP: Morning Check-in Time',
    props: { coachLine: "When do you want this each day? I'll nudge you then." },
  },
  {
    // 9: Evening reflection, configured only, NOT performed during onboarding.
    // Three styles: suggested template / your template / freeform. Reminder ON.
    type: 'reflection-card',
    beat: '9',
    background: 'coach',
    sheetStage: 'ONBOARD-BEGINNER-07: Evening Reflection Setup',
    props: {
      coachLine:
        'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
    },
  },
  {
    // 10: Path fork, "tracked habits before?"
    type: 'path-selection',
    beat: '10',
    background: 'coach',
    sheetStage: 'ONBOARD-FORK--FORM: Experience Fork',
    props: { coachLine: 'Have you tracked habits before, or is this new for you?' },
  },
  // 11: Habits, beginner path (showOnPath:'new'): category -> subcategory -> habits -> schedule
  {
    // Coach stays OPEN by voice here so users can talk it through if unsure.
    type: 'category-grid',
    beat: '11a',
    background: 'coach',
    showOnPath: 'new',
    sheetStage: 'ONBOARD-BEGINNER-01: Category Selection',
    props: {
      coachLine:
        'What part of your life do you most want to work on right now? Pick the one that pulls you.',
    },
  },
  {
    // goals-list is the subcategory beat. "Which feels true" is dropped; the
    // language is "subcategory". Pick 1-2 subcategories per category.
    type: 'goals-list',
    beat: '11b',
    background: 'coach',
    showOnPath: 'new',
    sheetStage: 'ONBOARD-BEGINNER-02: Subcategory Selection',
    props: { coachLine: "Within that, what's the piece you want to start with?" },
  },
  {
    // Less is more: one or two habits. The check-in is already a habit.
    type: 'habit-picker',
    beat: '11c',
    background: 'coach',
    showOnPath: 'new',
    sheetStage: 'ONBOARD-BEGINNER-03: Habit Selection',
    props: {
      coachLine:
        "Pick the habits that feel doable. Not impressive, just doable. One you'll actually keep beats five you won't. Make your own if nothing here fits.",
    },
  },
  {
    type: 'habit-schedule',
    beat: '11d',
    background: 'coach',
    showOnPath: 'new',
    sheetStage: 'ONBOARD-BEGINNER-04: Habit Schedule',
    props: {
      coachLine:
        "How often, and roughly when, for each one? Add a reminder only if you want a nudge.",
    },
  },
  // 11: Habits, advanced path (showOnPath:'exp'): live cards (Build/Break
  // auto-classified, no per-habit asking) -> approve -> frequency grows out.
  {
    // Advanced users read the habits they already track. Each one forms live as
    // the same schedule card, minus the day circles, with an auto-classified
    // Build/Break chip, a pencil, and a delete. The coach does not ask polarity
    // per habit; it names the build/break read at the close for one approval.
    type: 'advanced-capture',
    beat: '11e',
    background: 'coach',
    showOnPath: 'exp',
    sheetStage: 'ONBOARD-ADVANCED: Brain Dump',
    props: {
      coachLine:
        "Read me the habits you already track. Less is more to start, you can always build on it.",
      closeCoachLine:
        "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
    },
  },
  {
    // Advanced frequency: the same cards, now growing the day circles out of
    // each one once the user approved the set.
    type: 'advanced-frequency',
    beat: '11f',
    background: 'coach',
    showOnPath: 'exp',
    sheetStage: 'ONBOARD-ADVANCED-FREQUENCY: Habit Days',
    props: {
      coachLine: "Now the days. Tell me how often each one runs and I'll fill them in.",
      confirmCoachLine: 'Your habits are all set, your plan is ready.',
    },
  },
  // 12: The ONE full-plan confirm. Morning + evening times (both already set, shown as defaults)
  // + all habits. Approve -> weekly projection (beats 13a-13e), then the home tour
  // (its own flow). plan-cards is dropped; into-app is the single convergence point
  // for both beginner and advanced paths.
  {
    type: 'into-app',
    beat: '12',
    background: 'coach',
    sheetStage: 'ONBOARD-COMPLETE: Full Plan Confirm',
    props: {
      coachLine:
        "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
    },
  },
  // 13a-13e: Weekly projection. Five frames shown in sequence, each a different
  // outcome state of the habit week-grid. Comes right after the plan confirm and
  // before the home tour. The home tour is its own separate flow; these are the
  // last onboarding beats.
  {
    type: 'weekly-projection',
    beat: '13a',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-BLANK: Blank Week',
    props: {
      state: 'blank',
      coachLine: 'This is your week. Blank, starting today.',
    },
  },
  {
    type: 'weekly-projection',
    beat: '13b',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-FULL: Full Green Week',
    props: {
      state: 'full',
      coachLine: 'Best case, every day green. Every streak going strong. That would be amazing.',
    },
  },
  {
    type: 'weekly-projection',
    beat: '13c',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-P78: Mostly Done Week',
    props: {
      state: 'p78',
      coachLine:
        "More likely, you land around here. Mostly green, a few misses, your streaks holding. That's a real win.",
    },
  },
  {
    type: 'weekly-projection',
    beat: '13d',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-P36: Rough Week',
    props: {
      state: 'p36',
      coachLine:
        "Some weeks land here. One streak survives, the rest take a hit. Still fine, you're building. We reassess.",
    },
  },
  {
    type: 'weekly-projection',
    beat: '13e',
    background: 'coach',
    sheetStage: 'ONBOARD-WEEKLY-PROJECTION-GAPS: Gap Week',
    props: {
      state: 'gaps',
      coachLine:
        'The one thing we want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts, that keeps us going.',
    },
  },
];

const ONBOARDING_FLOW = DEFAULT_FLOW;

// Additional flows you can design in the builder. Same components, same beat
// model, just a different starter set. Seeded from the check-in components.
// Morning check-in (gg-spec morning-evening-checkin-flow.md): greeting -> state
// check (the four-row card) -> are you done (only if partial) -> wrap. Each beat's
// sheetStage maps to a Voice Scripts stage, so the MP3 clips auto-fill its metadata
// (the coach-bubble text shows one representative line; the audio rotates the set).
const MORNING_CHECKIN_FLOW: DefaultBeat[] = [
  {
    type: 'coach-bubble',
    beat: '1',
    sheetStage: 'morning_greeting',
    props: { text: 'Good morning. Ready to check in?' },
  },
  {
    type: 'state-check',
    beat: '2',
    background: 'coach',
    sheetStage: 'morning_state_prompt',
    props: {
      coachLine:
        'How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Tap what fits or just tell me.',
    },
  },
  {
    type: 'coach-bubble',
    beat: '3',
    sheetStage: 'are_you_done',
    props: { text: 'Looks like there are a few items left. Want to add anything, or should we move on?' },
  },
  {
    type: 'coach-bubble',
    beat: '4',
    sheetStage: 'morning_wrap',
    props: { text: "That's a good start. Go make it a good one." },
  },
];

// Evening check-in: greeting + habits -> habit review (done / not done / pending) ->
// are you done (only if partial) -> reflection (one beat: transition, then proud /
// forgive / grateful as steps) -> wrap. Each spoken beat carries its MP3 clips; the
// reflection beat lists all its stages so it gets every line's audio.
const EVENING_CHECKIN_FLOW: DefaultBeat[] = [
  {
    type: 'coach-bubble',
    beat: '1',
    sheetStage: 'evening_greeting_habits',
    props: { text: 'Hey, good evening. Here are your habits for today. How did the day go?' },
  },
  { type: 'habit-review', beat: '2', background: 'coach' },
  {
    type: 'coach-bubble',
    beat: '3',
    sheetStage: 'are_you_done',
    props: { text: 'Looks like there are a few items left. Want to add anything, or should we move on?' },
  },
  {
    type: 'reflection',
    beat: '4',
    sheetStage: 'reflection_transition,reflection_proud,reflection_forgive,reflection_grateful',
  },
  {
    type: 'coach-bubble',
    beat: '5',
    sheetStage: 'evening_wrap',
    props: { text: "That's it for tonight. Sleep well." },
  },
];

// The app tour (the fourth flow): the second half of onboarding. Onboarding ends
// on the first state check, the chat closes, and this flow runs over the real
// home page. It walks the home top to bottom, one real feature per beat, with
// the coach chat positioned so it never covers the part being shown. The single
// home-tour beat reads its `stage` prop; the order here drives the walk.
const HOME_TOUR_FLOW: DefaultBeat[] = [
  {
    type: 'home-tour',
    beat: '1',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'morning',
      coachLine:
        "Mornings start with a quick check-in, {name}. Tap it, or just say you're ready, and we'll see how you slept and where you're at.",
    },
  },
  {
    type: 'home-tour',
    beat: '2',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'evening',
      coachLine:
        'Evenings, you reflect on the day. Tap it or just start talking to me, how it went, what is on your mind.',
    },
  },
  {
    type: 'home-tour',
    beat: '3',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'habits',
      coachLine:
        'These are your habits. Say it or tap when you finish one, the X if you miss it. Either way works.',
    },
  },
  {
    type: 'home-tour',
    beat: '4',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'add-habit',
      coachLine:
        "Want to track something new? Press the plus up top, {name}, or just tell me, and we'll add it together.",
    },
  },
  {
    type: 'home-tour',
    beat: '5',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'reflections',
      coachLine:
        "It's empty now, but this is where your reflections will live. After your first evening one, they show up here.",
    },
  },
  {
    type: 'home-tour',
    beat: '6',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'feedback',
      coachLine:
        "You're one of our 50 founding users, {name}, so your feedback is one of the most meaningful things you can do for us. It shapes where this whole product goes. There's a button here for it, and you can also just tell me, anytime you've got something.",
    },
  },
  {
    type: 'home-tour',
    beat: '7',
    background: 'plain',
    props: {
      userName: '{name}',
      stage: 'chat',
      coachLine:
        "Great job getting here, {name}. This might be the longest you'll ever be in the app, but it was worth it to set up your foundation. The key now is consistency. It doesn't have to be long, just do it twice a day, and we'll do our best to help you improve and stay consistent. I'm right here anytime, just open the chat.",
    },
  },
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
  { id: 'home-tour', label: 'App tour', beats: HOME_TOUR_FLOW },
];
const FLOW_MAP: Record<string, FlowDef> = Object.fromEntries(FLOWS.map((f) => [f.id, f]));

// Production vs QA. Most beats are 'shared' (in both), so the two flows mirror
// each other automatically; a few are tagged 'production' or 'qa' only.
type FlowVariant = 'shared' | 'production' | 'qa';
type ActiveVariant = 'production' | 'qa';
const VARIANT_OPTIONS: { id: FlowVariant; label: string }[] = [
  { id: 'shared', label: 'Shared' },
  { id: 'production', label: 'Production' },
  { id: 'qa', label: 'QA' },
];
// A beat is shown in the active variant if it is shared or tagged for that variant.
const inVariant = (v: FlowVariant | undefined, active: ActiveVariant) =>
  (v ?? 'shared') === 'shared' || v === active;

const STORAGE_BASE = 'gg-flow-builder-v18';
const flowKey = (flowId: string) => `${STORAGE_BASE}:${flowId}`;
const ACTIVE_FLOW_KEY = `${STORAGE_BASE}:active`;
const VARIANT_KEY = `${STORAGE_BASE}:variant`;

// Legacy storage bases, newest first. When STORAGE_BASE is bumped for a schema
// change, add the previous base here so the next load carries old flows forward
// instead of silently dropping every authored flow.
const LEGACY_BASES = ['gg-flow-builder-v17', 'gg-flow-builder-v16', 'gg-flow-builder-v15'];

// One-time forward migration: if nothing is saved under the current base yet but
// a prior version's data is present, copy every prior key into the current base.
// A raw copy is safe because hydrate tolerates missing fields. No-op once migrated.
function migrateStorage() {
  try {
    // Only the per-flow saves matter. The meta keys (variant / active / username)
    // are written on mount before this runs, so ignore them when deciding whether
    // the current base already holds real data, otherwise migration never fires.
    const META = new Set(['variant', 'active', 'username']);
    const flowKeys = (base: string) =>
      Object.keys(localStorage).filter(
        (k) => k.startsWith(`${base}:`) && !META.has(k.slice(base.length + 1)),
      );
    if (flowKeys(STORAGE_BASE).length) return;
    const prior = LEGACY_BASES.find((b) => flowKeys(b).length);
    if (!prior) return;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(`${prior}:`)) continue;
      const val = localStorage.getItem(k);
      if (val != null) localStorage.setItem(`${STORAGE_BASE}${k.slice(prior.length)}`, val);
    }
  } catch {
    /* ignore */
  }
}

// One-time: drop the OLD cached check-in flows so the rebuilt morning/evening
// defaults load (redesigned 2026-06-25: the 4-row state card, habit review, the
// single reflection beat, and sheet-fed audio). Onboarding is untouched.
// Idempotent via a flag.
function refreshCheckinFlows() {
  try {
    const FLAG = `${STORAGE_BASE}:checkin-refresh-2026-06-25`;
    if (localStorage.getItem(FLAG)) return;
    localStorage.removeItem(flowKey('morning-checkin'));
    localStorage.removeItem(flowKey('evening-checkin'));
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ignore */
  }
}

// The app tour is being actively designed, so keep it from ever going stale:
// whenever its default (HOME_TOUR_FLOW) changes, drop the cached tour so the
// builder rebuilds from the new default. The signature is the flow's own
// content, so no manual version bump is needed; any edit to HOME_TOUR_FLOW
// triggers a refresh on the next load. Edits made in the builder persist until
// the default itself changes.
function refreshTourFlow() {
  try {
    const json = JSON.stringify(HOME_TOUR_FLOW);
    let h = 0;
    for (let i = 0; i < json.length; i += 1) h = (h * 31 + json.charCodeAt(i)) | 0;
    const sig = String(h);
    const KEY = `${STORAGE_BASE}:home-tour-sig`;
    if (localStorage.getItem(KEY) === sig) return;
    localStorage.removeItem(flowKey('home-tour'));
    localStorage.setItem(KEY, sig);
  } catch {
    /* ignore */
  }
}

type StoredBeat = {
  type: string;
  props?: Record<string, string>;
  beat?: string;
  note?: string;
  sheetStage?: string;
  transition?: { kind: BeatTransitionKind; durationMs: number };
  background?: string;
  variant?: FlowVariant;
  showOnPath?: 'new' | 'exp';
  // Split blocks keep their parallel lanes here. The runtime lane id is dropped
  // on save and regenerated on hydrate; only the label and lane items persist.
  lanes?: { label: string; items: StoredBeat[] }[];
  meta?: BeatMeta;
};

// Auto-fill a beat's MP3 clips from the Voice Scripts map (by its sheet stage) unless
// clips were already authored by hand. This is how the builder "takes which MP3s are
// where and puts them in each beat's metadata": match the beat's stage to the sheet's
// mp3_en column. Sets the voice engine to MP3 when clips are attached. A beat that
// speaks several stages (the reflection beat: transition + proud + forgive + grateful)
// lists them comma-separated and gets every stage's clips. Beats whose stage has no
// clips (the onboarding openers, which use live voice) are left untouched.
function withSheetAudio(meta: BeatMeta | undefined, sheetStage?: string): BeatMeta | undefined {
  if (meta?.mp3Assets?.length) return meta; // never clobber manual edits
  const stages = (sheetStage ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const mp3Assets = stages.flatMap((st) =>
    clipsForStage(st).map((c, i) => ({
      label: `${st} ${i + 1}`,
      file: c.file,
      transcript: c.text,
      opener: '',
    })),
  );
  if (!mp3Assets.length) return meta;
  return { ...(meta ?? {}), voiceEngine: meta?.voiceEngine ?? 'MP3', mp3Assets };
}

// The engine spec each onboarding beat type carries (node ids, persistence step,
// capture keys, voice routing, card caps). The runtime engine derives these from
// the beat type today; seeding them here pre-fills the Engine group and the export
// with the real values. Anything already set on the beat wins. Tool names are left
// blank on purpose (they need confirming against the live tool list).
const ENGINE_DEFAULTS: Record<string, NonNullable<BeatMeta['engine']>> = {
  'auth-signup': { nodeId: 'auth', voiceExpectsInput: false, voiceDirectLlmAllowed: false },
  'mic-permission': { nodeId: 'mic', voiceExpectsInput: false, voiceDirectLlmAllowed: false },
  'profile-beat': {
    nodeId: 'profile',
    persistStep: '1',
    captureFields: 'age, gender',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'path-selection': {
    nodeId: 'path-fork',
    persistStep: '2',
    pathField: true,
    captureFields: 'path',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'category-grid': {
    nodeId: 'category',
    backId: 'path-fork',
    persistStep: '3',
    captureFields: 'category',
    maxSelections: '1',
    optionSource: 'categories',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'goals-list': {
    nodeId: 'goals',
    backId: 'category',
    persistStep: '4',
    captureFields: 'goals',
    maxSelections: '2',
    optionSource: 'goalsByCategory',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'habit-picker': {
    nodeId: 'habit-select',
    backId: 'goals',
    persistStep: '5',
    captureFields: 'habitConfigs',
    maxSelections: '2',
    optionSource: 'habitsByGoal',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'advanced-capture': {
    nodeId: 'advanced-input',
    backId: 'path-fork',
    persistStep: '3',
    captureFields: 'brainDumpText',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'reflection-card': {
    nodeId: 'reflection-setup',
    backId: 'habit-select',
    persistStep: '6',
    captureFields: 'reflectionConfig',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
  'plan-cards': {
    // Back returns to the habit step. It used to point at 'reflection-setup',
    // a beat that comes AFTER plan-cards, so Back jumped the user forward.
    nodeId: 'plan-review',
    backId: 'habit-select',
    voiceExpectsInput: true,
    voiceDirectLlmAllowed: true,
  },
};

// Fill a beat's engine spec from the type defaults; anything already authored wins.
function withEngineDefaults(type: string, meta: BeatMeta | undefined): BeatMeta | undefined {
  const d = ENGINE_DEFAULTS[type];
  if (!d) return meta;
  return { ...(meta ?? {}), engine: { ...d, ...(meta?.engine ?? {}) } };
}

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
    background: b.background ?? 'coach',
    variant: b.variant ?? 'shared',
    showOnPath: b.showOnPath,
    lanes: b.lanes?.map((l) => ({ id: newUid('lane'), label: l.label, items: hydrate(l.items) })),
    meta: withEngineDefaults(b.type, withSheetAudio(b.meta, b.sheetStage)),
  }));

const serialize = (items: Placed[]): StoredBeat[] =>
  items.map(
    ({
      type,
      props,
      beat,
      note,
      sheetStage,
      transition,
      background,
      variant,
      showOnPath,
      lanes,
      meta,
    }) => ({
      type,
      props,
      beat,
      note,
      sheetStage,
      transition,
      background,
      variant,
      showOnPath,
      lanes: lanes?.map((l) => ({ label: l.label, items: serialize(l.items) })),
      meta,
    }),
  );

const buildDefault = (flowId: string): Placed[] =>
  hydrate((FLOW_MAP[flowId]?.beats ?? ONBOARDING_FLOW) as StoredBeat[]);

// Flows saved before the QA control beat existed won't contain it. Prepend it to
// the onboarding flow on load when missing, so the QA variant always has its
// launcher without forcing a Reset (which would drop any authored beats).
const ensureQaControl = (flowId: string, items: Placed[]): Placed[] => {
  if (flowId !== 'onboarding' || items.some((b) => b.type === 'qa-control')) return items;
  const seed = (ONBOARDING_FLOW as StoredBeat[]).find((b) => b.type === 'qa-control');
  return seed ? [...hydrate([seed]), ...items] : items;
};

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
  // Which variant of the flow this beat appears in: shared (both production and
  // QA), production only, or qa only. Default shared.
  variant?: FlowVariant;
  showOnPath?: 'new' | 'exp';
  lanes?: Lane[];
  // Per-beat spec metadata: voice engine, MP3 clips, AI path, animation, etc.
  // Authored in the sidecar Metadata section, carried into the export, and named
  // to match the Master Sheet voice schema so the builder and Sheet stay in sync.
  meta?: BeatMeta;
}

interface Mp3Clip {
  label: string;
  file: string;
  transcript: string;
  opener: string;
}

interface BeatMeta {
  voiceEngine?: string; // Vapi | Cartesia | MP3 | None     (Sheet: voice_engine)
  voiceMode?: string; // Verbatim | Generative              (Sheet: voice_mode)
  voiceId?: string;
  mp3Assets?: Mp3Clip[];
  spokenContent?: string; //                                (Sheet: voice_content)
  path?: string; // Path 1 (Vapi) | Path 2 (Async) | Path 3 (Direct-LLM)
  llmActive?: boolean;
  allowedTools?: string;
  feedbackConfig?: string; //                               (Sheet: feedback_config)
  animation?: string;
  orb?: { voiceOn?: boolean; micOn?: boolean; micAsking?: boolean; bloomed?: boolean };
  figmaNode?: string;
  status?: string; // draft | ready | locked
  voiceNotes?: string; //                                   (Sheet: voice_notes)
  // The runtime engine spec for this beat. The engine keys on these; today it
  // derives them from the beat type, surfaced here so each beat describes itself
  // and the export carries the full spec.
  engine?: {
    nodeId?: string; // stable graph id (profile, category, path-fork...)
    backId?: string; // node the back action returns to
    persistStep?: string; // Supabase onboarding_states step it writes ('' = none)
    pathField?: boolean; // fork beat: its value saves as the routing path
    captureFields?: string; // answer keys it captures (category, goals, age...)
    toolName?: string; // LLM tool the coach fires to persist this beat
    toolAdvancesStep?: boolean; // firing the tool advances current_step
    toolPersistsFields?: string; // fields the tool writes
    voiceExpectsInput?: boolean; // coach waits for the user before resolving
    voiceDirectLlmAllowed?: boolean; // false = Vapi-only (auth, mic)
    maxSelections?: string; // card cap (categories 1, goals 2...)
    optionSource?: string; // categories | goalsByCategory | habitsByGoal
  };
}

let UID = 0;
const newUid = (type: string) => `${type}-${++UID}`;

// A freshly dropped beat. Gives it the same default background hydrate assigns on
// load (coach, or user for a user bubble) so a new beat looks identical before and
// after a reload instead of flipping from plain to coach.
const freshBeat = (type: string): Placed => ({
  uid: newUid(type),
  type,
  background: 'coach',
});

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
      <div className="pointer-events-none gg-light overflow-hidden [transform:translateZ(0)]">
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

// BeatOrb now lives in ./BeatOrb and renders the real app orb (OrbControls), so
// the orb on a beat is exactly what ships. Imported at the top of this file.

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
  orb,
}: {
  children: ReactNode;
  checkin: boolean;
  bg?: string;
  orb?: OrbConfig;
}) {
  return (
    <div className="absolute inset-0 bg-surface">
      {/* Full-height gradient so the color reaches the very bottom edge; the orb
          floats on top of it instead of sitting on a white strip. */}
      <div className="absolute inset-0" style={{ background: bgColor(bg) }} />
      <div
        className="absolute inset-x-0 top-0 flex flex-col overflow-y-auto px-4 [transform:translateZ(0)]"
        style={{ bottom: checkin ? 64 : orb?.fullBleed ? 0 : 150 }}
      >
        {/* my-auto centers short content and top-aligns + scrolls tall content.
            The tap fix is the bottom reserve above: it must clear the full orb
            block (148px), not just the 92px button, or the bottom row sits under
            the orb and eats clicks. */}
        <div className="my-auto w-full py-6">{children}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        {checkin ? (
          <BuilderBottomNav />
        ) : (
          // The orb floats over the bottom of the content. Its strip is
          // click-through (pointer-events-none) so taps on a card behind it still
          // land; only the orb button itself stays interactive.
          <div className="pointer-events-none flex justify-center pb-6 pt-2">
            <div className="pointer-events-auto">
              <BeatOrb size={92} {...orb} />
            </div>
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
  orb,
}: {
  children: ReactNode;
  checkin: boolean;
  bg?: string;
  orb?: OrbConfig;
}) {
  return (
    <div
      className="gg-light relative shrink-0 overflow-hidden rounded-[34px] border-[3px] border-[#e2e8f0] bg-surface shadow-elevated"
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
        <PhoneScreenInner checkin={checkin} bg={bg} orb={orb}>
          {children}
        </PhoneScreenInner>
      </div>
    </div>
  );
}

const VOICE_ENGINES = ['Vapi', 'Cartesia', 'MP3', 'None'];
const VOICE_MODES = ['Verbatim', 'Generative'];
const BEAT_PATHS = ['Path 1 (Vapi)', 'Path 2 (Async)', 'Path 3 (Direct-LLM)'];
const BEAT_ANIMATIONS = ['None', 'Orb bloom', 'Dissolve', 'Fade', 'Slide'];
const BEAT_STATUSES = ['draft', 'ready', 'locked'];

const META_INPUT =
  'w-full rounded-md border border-border bg-page px-2 py-1.5 text-[12px] text-content';
const META_LABEL = 'text-[10px] font-semibold uppercase tracking-wide text-content-tertiary';

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={META_LABEL}>{label}</span>
      {children}
    </label>
  );
}

function MetaSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <MetaField label={label}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={META_INPUT}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </MetaField>
  );
}

// Shared one-at-a-time player for the Variations picker. Click play to hear a
// variation's MP3; the previous one stops.
let variationAudio: HTMLAudioElement | null = null;
function playVariation(url: string) {
  if (!url) return;
  if (variationAudio) variationAudio.pause();
  variationAudio = new Audio(url);
  void variationAudio.play().catch(() => {});
}

// A per-beat Variations picker, read LIVE from the Voice Scripts sheet by the beat's
// stage (never from saved metadata, so it never goes stale). Pull down to choose a
// variation, hit play to hear its MP3, and the words reveal one by one to simulate
// how it plays in the app.
function VariationsPicker({ stage }: { stage?: string }) {
  const clips = clipsForStage(stage);
  const [idx, setIdx] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [revealing, setRevealing] = useState(false);
  if (!clips.length) return null;
  const clip = clips[Math.min(idx, clips.length - 1)];
  const play = () => {
    playVariation(clip.file);
    setRevealing(true);
    setRevealKey((k) => k + 1);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
        Variations ({clips.length}) · pick, play, hear
      </span>
      <div className="flex items-center gap-2">
        <select
          value={idx}
          onChange={(e) => {
            setIdx(Number(e.target.value));
            setRevealing(false);
          }}
          className="min-w-0 flex-1 truncate rounded-md border border-border bg-page px-2 py-1.5 text-[12px] text-content"
        >
          {clips.map((c, i) => (
            <option key={i} value={i}>
              {i + 1}. {c.text}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={play}
          aria-label="Play variation"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white"
        >
          <Icon icon="ic:round-play-arrow" className="size-5" />
        </button>
      </div>
      <div className="min-h-[36px] rounded-md border border-border bg-page px-2 py-2 text-[12px] leading-[1.5] text-content">
        {revealing ? <Karaoke key={revealKey} text={clip.text} active /> : clip.text}
      </div>
    </div>
  );
}

// The per-beat metadata editor: the full voice / AI / screen / authoring spec,
// collapsed by default. Field names match the Master Sheet voice schema so the
// builder and the Sheet stay in sync, and everything here rides into the export.
function MetaSection({
  item,
  onUpdate,
}: {
  item: Placed;
  onUpdate: (patch: Partial<Placed>) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta: BeatMeta = item.meta ?? {};
  const setMeta = (patch: Partial<BeatMeta>) => onUpdate({ meta: { ...meta, ...patch } });
  const clips = meta.mp3Assets ?? [];
  const setClip = (i: number, patch: Partial<Mp3Clip>) =>
    setMeta({ mp3Assets: clips.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const addClip = () =>
    setMeta({ mp3Assets: [...clips, { label: '', file: '', transcript: '', opener: '' }] });
  const removeClip = (i: number) => setMeta({ mp3Assets: clips.filter((_, j) => j !== i) });
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const playClip = (url: string) => {
    if (!url) return;
    if (clipAudioRef.current) clipAudioRef.current.pause();
    const a = new Audio(url);
    clipAudioRef.current = a;
    void a.play().catch(() => {});
  };
  const orb = meta.orb ?? {};
  const setOrb = (patch: Partial<NonNullable<BeatMeta['orb']>>) => setMeta({ orb: { ...orb, ...patch } });
  const engine = meta.engine ?? {};
  const setEngine = (patch: Partial<NonNullable<BeatMeta['engine']>>) =>
    setMeta({ engine: { ...engine, ...patch } });
  const groupLabel = 'text-[9px] font-bold uppercase tracking-[0.08em] text-content-subtle';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-page p-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-content-subtle">
          Metadata
        </span>
        <Icon
          icon={open ? 'ic:round-expand-less' : 'ic:round-expand-more'}
          className="size-4 text-content-tertiary"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className={groupLabel}>Voice and audio</span>
            <MetaSelect
              label="Engine"
              value={meta.voiceEngine}
              options={VOICE_ENGINES}
              placeholder="engine..."
              onChange={(v) => setMeta({ voiceEngine: v })}
            />
            <MetaSelect
              label="Mode"
              value={meta.voiceMode}
              options={VOICE_MODES}
              placeholder="mode..."
              onChange={(v) => setMeta({ voiceMode: v })}
            />
            <MetaField label="Voice">
              <input
                value={meta.voiceId ?? ''}
                onChange={(e) => setMeta({ voiceId: e.target.value })}
                placeholder="Yair Pro Clone, Katie..."
                className={META_INPUT}
              />
            </MetaField>
            <MetaField label="Spoken content">
              <textarea
                value={meta.spokenContent ?? ''}
                onChange={(e) => setMeta({ spokenContent: e.target.value })}
                placeholder="verbatim line, or opener seed"
                rows={2}
                className={`${META_INPUT} resize-none leading-[1.5]`}
              />
            </MetaField>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className={META_LABEL}>MP3 clips{clips.length ? ` (${clips.length} variations)` : ''}</span>
                <button
                  type="button"
                  onClick={addClip}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                >
                  + clip
                </button>
              </div>
              {clips.length === 0 && (
                <span className="text-[11px] text-content-tertiary">No clips yet.</span>
              )}
              {clips.map((c, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-md border border-border p-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      value={c.label}
                      onChange={(e) => setClip(i, { label: e.target.value })}
                      placeholder="label"
                      className={`${META_INPUT} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => playClip(c.file)}
                      disabled={!c.file}
                      aria-label="Play clip"
                      className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-primary disabled:opacity-40"
                    >
                      <Icon icon="ic:round-play-arrow" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeClip(i)}
                      aria-label="Remove clip"
                      className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-danger"
                    >
                      <Icon icon="ic:round-close" className="size-3.5" />
                    </button>
                  </div>
                  <input
                    value={c.file}
                    onChange={(e) => setClip(i, { file: e.target.value })}
                    placeholder="file path or url"
                    className={META_INPUT}
                  />
                  <input
                    value={c.opener}
                    onChange={(e) => setClip(i, { opener: e.target.value })}
                    placeholder="which opener / when it plays"
                    className={META_INPUT}
                  />
                  <textarea
                    value={c.transcript}
                    onChange={(e) => setClip(i, { transcript: e.target.value })}
                    placeholder="transcript"
                    rows={2}
                    className={`${META_INPUT} resize-none leading-[1.5]`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={groupLabel}>AI and LLM</span>
            <MetaSelect
              label="Path"
              value={meta.path}
              options={BEAT_PATHS}
              placeholder="path..."
              onChange={(v) => setMeta({ path: v })}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!meta.llmActive}
                onChange={(e) => setMeta({ llmActive: e.target.checked })}
                className="size-3.5"
              />
              <span className={META_LABEL}>LLM active on this beat</span>
            </label>
            <MetaField label="Allowed tools">
              <input
                value={meta.allowedTools ?? ''}
                onChange={(e) => setMeta({ allowedTools: e.target.value })}
                placeholder="comma separated tool names"
                className={META_INPUT}
              />
            </MetaField>
            <MetaField label="Session config">
              <input
                value={meta.feedbackConfig ?? ''}
                onChange={(e) => setMeta({ feedbackConfig: e.target.value })}
                placeholder="limits, drift redirect"
                className={META_INPUT}
              />
            </MetaField>
          </div>

          <div className="flex flex-col gap-2">
            <span className={groupLabel}>Screen and animation</span>
            <MetaSelect
              label="Animation"
              value={meta.animation}
              options={BEAT_ANIMATIONS}
              placeholder="animation..."
              onChange={(v) => setMeta({ animation: v })}
            />
            <div className="flex flex-col gap-1">
              <span className={META_LABEL}>Orb state</span>
              <div className="grid grid-cols-2 gap-1">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!orb.voiceOn}
                    onChange={(e) => setOrb({ voiceOn: e.target.checked })}
                    className="size-3.5"
                  />
                  <span className="text-[11px] text-content-subtle">Voice on</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!orb.micOn}
                    onChange={(e) => setOrb({ micOn: e.target.checked })}
                    className="size-3.5"
                  />
                  <span className="text-[11px] text-content-subtle">Mic on</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!orb.micAsking}
                    onChange={(e) => setOrb({ micAsking: e.target.checked })}
                    className="size-3.5"
                  />
                  <span className="text-[11px] text-content-subtle">Asking</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!orb.bloomed}
                    onChange={(e) => setOrb({ bloomed: e.target.checked })}
                    className="size-3.5"
                  />
                  <span className="text-[11px] text-content-subtle">Bloomed</span>
                </label>
              </div>
            </div>
            <MetaField label="Figma / screen link">
              <input
                value={meta.figmaNode ?? ''}
                onChange={(e) => setMeta({ figmaNode: e.target.value })}
                placeholder="figma link or screen id"
                className={META_INPUT}
              />
            </MetaField>
          </div>

          <div className="flex flex-col gap-2">
            <span className={groupLabel}>Authoring</span>
            <MetaSelect
              label="Status"
              value={meta.status}
              options={BEAT_STATUSES}
              placeholder="status..."
              onChange={(v) => setMeta({ status: v })}
            />
            <MetaField label="Notes">
              <textarea
                value={meta.voiceNotes ?? ''}
                onChange={(e) => setMeta({ voiceNotes: e.target.value })}
                placeholder="authoring notes"
                rows={2}
                className={`${META_INPUT} resize-none leading-[1.5]`}
              />
            </MetaField>
          </div>

          <div className="flex flex-col gap-2">
            <span className={groupLabel}>Engine</span>
            <MetaField label="Node id">
              <input
                value={engine.nodeId ?? ''}
                onChange={(e) => setEngine({ nodeId: e.target.value })}
                placeholder="profile, category, path-fork..."
                className={META_INPUT}
              />
            </MetaField>
            <MetaField label="Back target (node id)">
              <input
                value={engine.backId ?? ''}
                onChange={(e) => setEngine({ backId: e.target.value })}
                placeholder="node the back button returns to"
                className={META_INPUT}
              />
            </MetaField>
            <MetaField label="Persist step">
              <input
                value={engine.persistStep ?? ''}
                onChange={(e) => setEngine({ persistStep: e.target.value })}
                placeholder="Supabase step, blank = none"
                className={META_INPUT}
              />
            </MetaField>
            <MetaField label="Captures (answer keys)">
              <input
                value={engine.captureFields ?? ''}
                onChange={(e) => setEngine({ captureFields: e.target.value })}
                placeholder="category, goals, age..."
                className={META_INPUT}
              />
            </MetaField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!engine.pathField}
                onChange={(e) => setEngine({ pathField: e.target.checked })}
                className="size-3.5"
              />
              <span className={META_LABEL}>Fork beat (value saves as path)</span>
            </label>
            <MetaField label="Tool name">
              <input
                value={engine.toolName ?? ''}
                onChange={(e) => setEngine({ toolName: e.target.value })}
                placeholder="submit_category, add_habit..."
                className={META_INPUT}
              />
            </MetaField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!engine.toolAdvancesStep}
                onChange={(e) => setEngine({ toolAdvancesStep: e.target.checked })}
                className="size-3.5"
              />
              <span className={META_LABEL}>Tool advances the step</span>
            </label>
            <MetaField label="Tool persists fields">
              <input
                value={engine.toolPersistsFields ?? ''}
                onChange={(e) => setEngine({ toolPersistsFields: e.target.value })}
                placeholder="fields the tool writes"
                className={META_INPUT}
              />
            </MetaField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!engine.voiceExpectsInput}
                onChange={(e) => setEngine({ voiceExpectsInput: e.target.checked })}
                className="size-3.5"
              />
              <span className={META_LABEL}>Waits for user input</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!engine.voiceDirectLlmAllowed}
                onChange={(e) => setEngine({ voiceDirectLlmAllowed: e.target.checked })}
                className="size-3.5"
              />
              <span className={META_LABEL}>Direct-LLM allowed (off = Vapi only)</span>
            </label>
            <MetaField label="Max selections">
              <input
                value={engine.maxSelections ?? ''}
                onChange={(e) => setEngine({ maxSelections: e.target.value })}
                placeholder="1, 2..."
                className={META_INPUT}
              />
            </MetaField>
            <MetaSelect
              label="Option source"
              value={engine.optionSource}
              options={['categories', 'goalsByCategory', 'habitsByGoal']}
              placeholder="none"
              onChange={(v) => setEngine({ optionSource: v })}
            />
          </div>
        </div>
      )}
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
  // Per-tile animation freeze: pause just this beat (so you can click into it)
  // while the rest of the flow keeps moving. Folds in with the global switch.
  const tileAnims = useAnimations();
  const [tilePaused, setTilePaused] = useState(false);
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
          <button
            type="button"
            onClick={() => setTilePaused((v) => !v)}
            aria-label={tilePaused ? 'Play this beat' : 'Pause this beat'}
            title={tilePaused ? 'Play this beat' : 'Pause this beat'}
            className={`flex size-7 items-center justify-center rounded-full border border-border bg-surface shadow-card ${
              tilePaused ? 'text-primary' : 'text-content-tertiary'
            }`}
          >
            <Icon icon={tilePaused ? 'ic:round-play-arrow' : 'ic:round-pause'} className="size-4" />
          </button>
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

        <PhoneScreenFrame checkin={checkin} bg={item.background} orb={orbConfigForType(item.type)}>
          <AnimationsCtx.Provider value={tileAnims && !tilePaused}>
            {entry ? createElement(entry.Comp, applyName(item.props, uname)) : null}
          </AnimationsCtx.Provider>
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
                      ? 'border-primary text-slate-800 ring-1 ring-primary'
                      : 'border-black/10 text-slate-500'
                  }`}
                  style={{ background: b.color }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Shown in
          </span>
          <div className="flex items-center gap-1">
            {VARIANT_OPTIONS.map((v) => {
              const active = (item.variant ?? 'shared') === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  title={`Show this beat in ${v.label}`}
                  onClick={() => onUpdate({ variant: v.id })}
                  className={`flex h-7 flex-1 items-center justify-center rounded-md border text-[9px] font-bold ${
                    active
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border text-content-tertiary'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Show on path
          </span>
          <div className="flex items-center gap-1">
            {[
              { id: undefined, label: 'Any' },
              { id: 'new' as const, label: 'Beginner' },
              { id: 'exp' as const, label: 'Advanced' },
            ].map((p) => {
              const active = item.showOnPath === p.id;
              return (
                <button
                  key={p.label}
                  type="button"
                  title={p.id ? `Only on the ${p.label} path` : 'On both paths'}
                  onClick={() => onUpdate({ showOnPath: p.id })}
                  className={`flex h-7 flex-1 items-center justify-center rounded-md border text-[9px] font-bold ${
                    active
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border text-content-tertiary'
                  }`}
                >
                  {p.label}
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
        <VariationsPicker stage={item.sheetStage} />
        <MetaSection item={item} onUpdate={onUpdate} />
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
  const animationsOn = useAnimations();

  // Shared selection state for this run, read and written by the onboarding
  // beats so a pick in one beat drives the next (category -> goals -> habits ->
  // plan). Resets on restart.
  const [path, setPath] = useState<'new' | 'exp' | null>(null);
  const [category, setCategoryState] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  // Captured schedule + check-in times, lifted from the schedule / morning /
  // evening beats so the plan recap and the home tour reflect the real plan.
  const [morningTime, setMorningTime] = useState<string | null>(null);
  const [eveningTime, setEveningTime] = useState<string | null>(null);
  const [habitConfigs, setHabitConfigsState] = useState<Record<string, HabitScheduleCfg>>({});
  const [tourHabitStatus, setTourHabitStatusState] = useState<Record<string, 'done' | 'missed' | 'none'>>({});
  const [tourSelectedDate, setTourSelectedDateState] = useState<string | null>(null);
  const toggleIn = (v: string, max: number, set: (fn: (p: string[]) => string[]) => void) =>
    set((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length < max ? [...p, v] : p));
  const flowState: FlowState = {
    path,
    category,
    goals,
    habits,
    setPath,
    // A new category clears the downstream goal and habit choices.
    setCategory: (v) => {
      setCategoryState(v);
      setGoals([]);
      setHabits([]);
    },
    toggleGoal: (v, max = 2) => toggleIn(v, max, setGoals),
    toggleHabit: (v, max = 2) => toggleIn(v, max, setHabits),
    setHabits: (v) => setHabits(v),
    morningTime,
    eveningTime,
    habitConfigs,
    setMorningTime: (v) => setMorningTime(v),
    setEveningTime: (v) => setEveningTime(v),
    setHabitConfig: (habit, cfg) => setHabitConfigsState((p) => ({ ...p, [habit]: cfg })),
    tourHabitStatus,
    tourSelectedDate,
    setTourHabitStatus: (next) => setTourHabitStatusState(next),
    setTourSelectedDate: (v) => setTourSelectedDateState(v),
  };

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
    <PhoneScreenInner checkin={checkin} bg={item.background} orb={orbConfigForType(item.type)}>
      {beatBody(item)}
    </PhoneScreenInner>
  );

  // Only the beats for the path the user picked (the beginner card path vs the
  // advanced read-a-list path). Untagged beats always show. Defaults to the
  // beginner path until the fork is chosen, so the flow reads complete up front.
  const beats = placed.filter((b) => !b.showOnPath || b.showOnPath === (path ?? 'new'));
  const current = beats[step] ?? beats[0];
  const next = beats[step + 1];

  useEffect(() => {
    if (step > beats.length - 1) setStep(Math.max(0, beats.length - 1));
  }, [beats.length, step]);

  // Play the active beat's MP3 clip when you land on it (Play mode). Beats with no
  // clips (user-action beats like the habit review) stay silent. The runtime rotates
  // variations; the preview plays the first as a representative of the beat's voice.
  const activeClip = current?.meta?.mp3Assets?.[0]?.file;
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    if (!activeClip) return;
    const a = new Audio(activeClip);
    beatAudioRef.current = a;
    void a.play().catch(() => {});
    return () => {
      a.pause();
    };
  }, [activeClip]);

  const advance = () => {
    if (!next || advancing) return;
    setAdvancing(true);
    const dur = animationsOn ? (current?.transition?.durationMs ?? 600) : 0;
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
    setPath(null);
    setCategoryState(null);
    setGoals([]);
    setHabits([]);
    setMorningTime(null);
    setEveningTime(null);
    setHabitConfigsState({});
    setTourHabitStatusState({});
    setTourSelectedDateState(null);
  };

  const kind = current?.transition?.kind ?? 'dissolve';

  return (
    <PlayingCtx.Provider value={true}>
    <FlowStateCtx.Provider value={flowState}>
    <div className="flex flex-col items-center gap-3">
      <div
        className="gg-light relative shrink-0 overflow-hidden rounded-[34px] border-[3px] border-[#e2e8f0] bg-surface shadow-elevated"
        style={{ width: PHONE_DISPLAY_W, height: PHONE_DISPLAY_H }}
      >
        <div
          className="relative"
          style={{
            width: DEVICE_W,
            height: DEVICE_H,
            transform: `scale(${PHONE_SCALE})`,
            transformOrigin: 'top left',
            // Splash and Get Started advance on tap (tap splash to continue, press
            // Get Started to move into the greeting). The dissolve grows the docked
            // orb open into the bloomed greeting orb, the seamless connection.
            cursor:
              (current?.type === 'splash' || current?.type === 'get-started') &&
              next &&
              !advancing
                ? 'pointer'
                : undefined,
          }}
          onClick={
            (current?.type === 'splash' || current?.type === 'get-started') &&
            next &&
            !advancing
              ? advance
              : undefined
          }
        >
          {beats.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-content-tertiary">
              Nothing in the flow yet. Add beats in the middle.
            </div>
          ) : next ? (
            <BeatTransition
              key={step}
              first={screen(current)}
              second={
                // Remount the next beat the moment it becomes visible so any beat
                // animation starts fresh on screen, instead of having run silently
                // while it was the hidden waiting slot.
                <div key={advancing ? 'enter' : 'wait'} className="absolute inset-0">
                  {screen(next)}
                </div>
              }
              showSecond={advancing}
              kind={kind}
              durationMs={animationsOn ? (current?.transition?.durationMs ?? 600) : 0}
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
          {beats.length === 0 ? 'No beats' : `Beat ${Math.min(step + 1, beats.length)} / ${beats.length}`}
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
    </FlowStateCtx.Provider>
    </PlayingCtx.Provider>
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
      style={{ fontFamily: 'Urbanist, -apple-system, sans-serif', background: 'var(--color-canvas)' }}
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
  // Production vs QA view. Beats tagged shared show in both; production/qa-only
  // beats show in just that view, so the two flows mirror with a few differences.
  const [variant, setVariant] = useState<ActiveVariant>(() => {
    if (typeof localStorage === 'undefined') return 'production';
    return localStorage.getItem(VARIANT_KEY) === 'qa' ? 'qa' : 'production';
  });
  useEffect(() => {
    try {
      localStorage.setItem(VARIANT_KEY, variant);
    } catch {
      /* ignore */
    }
  }, [variant]);
  const hydratedRef = useRef(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeFromPalette, setActiveFromPalette] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [beats, setBeats] = useState<{ stage: string; suggested: string }[] | null>(null);
  const [beatsErr, setBeatsErr] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  // One global animation switch: pauses the looping canvas tiles AND the player.
  const [animationsOn, setAnimationsOn] = useState(true);
  // Dark mode for the builder chrome (canvas, panels, controls) via the .dark
  // token set. The phone tiles keep their own app backgrounds.
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('gg-flow-builder-theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('gg-flow-builder-theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const paletteDrop = useDroppable({ id: 'palette-zone' });
  const removing = paletteDrop.isOver && !activeFromPalette && activeLabel !== null;

  // On mount, restore the last active flow and its beats.
  useEffect(() => {
    migrateStorage();
    refreshCheckinFlows();
    refreshTourFlow();
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
      setPlaced(raw ? ensureQaControl(fid, hydrate(JSON.parse(raw) as StoredBeat[])) : buildDefault(fid));
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
      next = raw ? ensureQaControl(newId, hydrate(JSON.parse(raw) as StoredBeat[])) : buildDefault(newId);
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
      return [...p.slice(0, i), freshBeat(type), ...p.slice(i)];
    });

  const insertWhere = (type: string, where: 'top' | 'middle' | 'bottom') =>
    setPlaced((p) => {
      const i = where === 'top' ? 0 : where === 'bottom' ? p.length : Math.floor(p.length / 2);
      return [...p.slice(0, i), freshBeat(type), ...p.slice(i)];
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
      items: [...l.items, freshBeat(type)],
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

  const reset = () => {
    if (!window.confirm('Reset this flow to the default? The beats you authored in this flow will be replaced.'))
      return;
    setPlaced(buildDefault(flowId));
  };
  const clear = () => {
    if (!window.confirm('Clear every beat from this flow? This cannot be undone.')) return;
    setPlaced([]);
  };


  const serializeBeat = (p: Placed, i: number) => ({
    beat: p.beat || String(i + 1),
    name: REGISTRY_MAP[p.type]?.label ?? p.type,
    componentType: p.type,
    variant: p.variant ?? 'shared',
    showOnPath: p.showOnPath ?? null,
    background: p.background ?? 'coach',
    sheetStage: p.sheetStage ?? '',
    transition: p.transition ?? null,
    context: p.note ?? '',
    props: p.props ?? {},
    meta: p.meta ?? {},
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
    // The DropLine renders against the visible (variant-filtered) list, so the
    // indicator index must be a visible index, not a full-array index, or it
    // misaligns whenever hidden beats precede the hovered target.
    const overId = e.over.id;
    const vi = overId === 'end-zone' ? visible.length : visible.findIndex((x) => x.uid === overId);
    setDropIndex(vi < 0 ? visible.length : vi);
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

  // The beats shown in the active variant (shared + production-only or qa-only).
  // Editing and reorder run on the full `placed` by uid, so this is display only.
  const visible = placed.filter((p) => inVariant(p.variant, variant));

  if (play) {
    return (
      <UserNameCtx.Provider value={userName}>
        <AnimationsCtx.Provider value={animationsOn}>
          <PlayView placed={visible} flowId={flowId} onExit={() => setPlay(false)} />
        </AnimationsCtx.Provider>
      </UserNameCtx.Provider>
    );
  }

  return (
    <UserNameCtx.Provider value={userName}>
    <AnimationsCtx.Provider value={animationsOn}>
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
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="fixed bottom-20 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-content shadow-elevated"
      >
        <Icon icon={dark ? 'ic:round-light-mode' : 'ic:round-dark-mode'} className="size-5 text-primary" />
      </button>
      <button
        type="button"
        onClick={() => setAnimationsOn((a) => !a)}
        title={animationsOn ? 'Pause all animations' : 'Play all animations'}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-content shadow-elevated"
      >
        <Icon
          icon={animationsOn ? 'ic:round-pause' : 'ic:round-play-arrow'}
          className="size-5 text-primary"
        />
        {animationsOn ? 'Pause animations' : 'Play animations'}
      </button>
      <div
        className="flex min-h-screen gap-5 p-5"
        style={{ fontFamily: 'Urbanist, -apple-system, sans-serif', background: 'var(--color-canvas)' }}
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
            <div className="flex items-center gap-3">
              <div className="text-[15px] font-bold text-content">Flow</div>
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
                {(['production', 'qa'] as ActiveVariant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    title={v === 'qa' ? 'QA flow' : 'Production flow'}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      variant === v ? 'bg-primary text-white' : 'text-content-subtle hover:text-content'
                    }`}
                  >
                    {v === 'qa' ? 'QA' : 'Production'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-content-tertiary">{visible.length} components</span>
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
              {visible.length === 0 && dropIndex === null && (
                <div className="py-16 text-center text-[14px] text-content-tertiary">
                  Drag a component here, or hover one on the left and pick top / middle / bottom.
                </div>
              )}
              <SortableContext
                items={visible.map((p) => p.uid)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-5">
                  {visible.map((item, i) => (
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
                      {i < visible.length - 1 && (
                        <BeatConnector
                          transition={item.transition}
                          onChange={(t) => update(item.uid, { transition: t })}
                        />
                      )}
                    </div>
                  ))}
                  {dropIndex === visible.length && <DropLine />}
                  <EndZone />
                </div>
              </SortableContext>
            </div>
          </div>
        </div>

        <PlayPanel placed={visible} flowId={flowId} onFullscreen={() => setPlay(true)} />
      </div>

      <DragOverlay>
        {activeLabel ? (
          <div className="rounded-lg border-2 border-primary bg-surface px-3 py-2 text-[13px] font-semibold text-primary shadow-elevated">
            {activeLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </AnimationsCtx.Provider>
    </UserNameCtx.Provider>
  );
}
