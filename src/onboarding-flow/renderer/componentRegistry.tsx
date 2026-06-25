/**
 * Component registry — maps a beat's `componentType` to the real app component,
 * wired with real CONTENT (from the flow + accumulated answers) and real
 * callbacks (into the orchestrator). This is the data-driven half of the
 * renderer: the same components the old Step pages use, but fed props instead of
 * hardcoded samples, and saving through the orchestrator instead of per-page.
 *
 * Each adapter renders the ACTIVE beat's interactive card. Past beats are shown
 * as a short user-answer summary (see summarizeBeat) by BeatView.
 */
import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import {
  formatCadence,
  inferSchedule,
  SCHEDULE_DAYS,
  toggleSetItem,
  WEEKDAYS,
} from '@/components/onboarding/constants';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DualButton } from '@/components/ui/DualButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  type OnboardingVoiceResult,
  useOnboardingVoiceActions,
} from '@/contexts/useOnboardingVoiceSession';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import {
  FLOW_CATEGORIES,
  GENDER_OPTIONS,
  goalsByCategory,
  habitsByGoal,
  MAX_HABITS_ONBOARDING,
} from '../flowData';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';

export interface BeatAdapterProps {
  node: FlowNode;
  answers: FlowAnswers;
  onCapture: (capture: BeatCapture) => void;
}

type HabitConfigSerialized = { days: number[]; time: string; reminder: boolean; schedule: string };

const DEFAULT_HABIT_CONFIG: Omit<HabitConfigSerialized, never> = {
  days: [...WEEKDAYS],
  time: '09:00',
  reminder: true,
  schedule: 'Weekday',
};

function Cta({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      className="mt-4"
    >
      {label}
    </Button>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-col gap-4">{children}</div>;
}

/* --------------------------------------------------------------------- auth */

// Auth beat 0. In the real app this hosts Google/Apple/email sign-in and captures
// the name. In the preview it advances on tap so the flow runs without real auth.
function AuthAdapter({ onCapture }: BeatAdapterProps) {
  return (
    <CardShell>
      <Button variant="primary" size="lg" fullWidth onClick={() => onCapture({ data: {} })}>
        Continue with Google
      </Button>
      <Button variant="secondary" size="lg" fullWidth onClick={() => onCapture({ data: {} })}>
        Continue with Apple
      </Button>
      <Button variant="ghost" size="lg" fullWidth onClick={() => onCapture({ data: {} })}>
        Use email instead
      </Button>
    </CardShell>
  );
}

/* ----------------------------------------------------------- mic permission */

// Mic-permission beat (designer beat 5). A coach-led permission gate, not a save
// step: it requests the mic and records the result through the real preferences
// path (useUserPreferences.updatePreferences -> Supabase, local-only when signed
// out), then captures {} to advance. The copy is the designer's (props on the
// flow node); the dual-button dial reuses the real MicPermissionPage visual.
function MicPermissionAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as {
    heading?: string;
    sub?: string;
    allowLabel?: string;
    skipLabel?: string;
  };
  const { preferences, updatePreferences } = useUserPreferences();
  const [requesting, setRequesting] = useState<'allow' | 'skip' | null>(null);
  const voiceEnabled = preferences.voiceMode === 'voice';
  const micGranted = preferences.micPermission === true;
  const submittedRef = useRef(false);

  const advance = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onCapture({ data: {} });
  };

  const handleAllow = async () => {
    if (requesting) return;
    setRequesting('allow');
    let granted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      granted = false;
    }
    track('grant_mic_permission', { granted, dismissed: false });
    await updatePreferences({ micPermission: granted, micEnabled: granted });
    advance();
  };

  const handleSkip = async () => {
    if (requesting) return;
    setRequesting('skip');
    track('grant_mic_permission', { granted: false, dismissed: true });
    await updatePreferences({ micPermission: false, micEnabled: false });
    advance();
  };

  return (
    <CardShell>
      <div className="flex items-center justify-center py-2">
        <DualButton
          size={150}
          width={160}
          leftActive={voiceEnabled}
          rightActive={false}
          leftIcon={voiceEnabled ? <IconChatVoice size={52} /> : <IconChatText size={52} />}
          rightIcon={micGranted ? <IconMic size={44} /> : <IconMicMuted size={44} />}
          leftAriaLabel="Coach voice indicator"
          rightAriaLabel="Microphone indicator"
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={requesting !== null}
          onClick={handleAllow}
        >
          {requesting === 'allow' ? (
            <LoadingSpinner color="text-white" />
          ) : (
            (props.allowLabel ?? 'Allow microphone')
          )}
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={requesting !== null}
          className="py-2 text-[15px] font-semibold text-content-secondary disabled:opacity-50"
        >
          {requesting === 'skip' ? <LoadingSpinner size="sm" /> : (props.skipLabel ?? 'Not now')}
        </button>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ profile */

// Profile beat 1: age + gender only. The name comes from auth (beat 0).
function ProfileAdapter({ answers, onCapture }: BeatAdapterProps) {
  const [age, setAge] = useState<number | ''>((answers.age as number) ?? '');
  const [gender, setGender] = useState<string | null>((answers.gender as string) ?? null);
  // Set when the coach (Direct-LLM) fills a field by voice. Drives the
  // auto-submit below so a spoken answer saves + advances without a tap. Never
  // set by a tap or by hydration, so tap stays Continue-driven.
  const voiceFilledRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action === 'fill_field') {
      const p = result.params as { fieldName?: string; value?: string | number };
      if (p.fieldName !== 'age') return;
      const raw = p.value;
      const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
      if (!isNaN(n) && n >= 13 && n <= 120) {
        setAge(n);
        voiceFilledRef.current = true;
      }
      return;
    }
    if (result.action === 'select_option') {
      const p = result.params as { fieldName?: string; value?: string };
      if (
        p.fieldName === 'gender' &&
        typeof p.value === 'string' &&
        GENDER_OPTIONS.includes(p.value)
      ) {
        setGender(p.value);
        voiceFilledRef.current = true;
      }
    }
  });

  const valid = !!(age && gender);
  const submittedRef = useRef(false);
  const submit = () => {
    if (!valid || submittedRef.current) return;
    submittedRef.current = true;
    onCapture({ data: { age: age as number, gender } });
  };

  // Auto-submit fallback for the Direct-LLM path: once BOTH age and gender have
  // been filled by voice, save + advance without waiting for a tap (the coach
  // already collected both). Multi-field beat, so never fire on the first field.
  // (The Vapi path advances via the orchestrator's server-step watcher instead.)
  useEffect(() => {
    if (voiceFilledRef.current && valid) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age, gender, valid]);

  return (
    <CardShell>
      <AgeScrollPicker value={age} onChange={setAge} />
      <ChipSelect
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
        columns={3}
        ariaLabel="How do you identify?"
      />
      {/* Affordance hint from the flow builder's profile beat: the user can use
          the voice orb OR tap the inputs. Reinforces the in-page orb. */}
      <div className="self-center text-[12px] font-medium text-content-tertiary">
        You can speak or tap
      </div>
      <Cta label="Continue" disabled={!valid} onClick={submit} />
    </CardShell>
  );
}

/* -------------------------------------------------------------- path / fork */

interface PathOption {
  value: string;
  label: string;
  description?: string;
}

function PathSelectionAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { options?: PathOption[]; bindsTo?: string };
  const options = props.options ?? [];
  const bindsToPath = props.bindsTo === 'path';
  const [selected, setSelected] = useState<string | null>(null);
  const voiceFilledRef = useRef(false);
  const submittedRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (!bindsToPath || result.action !== 'set_path') return;
    const p = result.params as { value?: string };
    if (p.value === 'simple' || p.value === 'braindump') {
      setSelected(p.value);
      voiceFilledRef.current = true;
    }
  });

  const submit = () => {
    if (!selected || submittedRef.current) return;
    submittedRef.current = true;
    if (bindsToPath) onCapture({ data: {}, path: selected as 'simple' | 'braindump' });
    else onCapture({ data: {} });
  };

  // Auto-submit fallback (Direct-LLM): a spoken path choice saves + advances
  // without a tap. Single-value beat, valid the moment it is set.
  useEffect(() => {
    if (voiceFilledRef.current && selected) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <CardShell>
      {options.map((o) => (
        <SelectionCard
          key={o.value}
          title={o.label}
          description={o.description ?? ''}
          selected={selected === o.value}
          onSelect={() => setSelected(o.value)}
        />
      ))}
      <Cta label="Continue" disabled={!selected} onClick={submit} />
    </CardShell>
  );
}

/* ----------------------------------------------------------- primary button */

function PrimaryButtonAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { label?: string; secondaryLabel?: string };
  return (
    <CardShell>
      <Cta label={props.label ?? 'Continue'} onClick={() => onCapture({ data: {} })} />
      {props.secondaryLabel && (
        <button
          type="button"
          className="text-sm font-medium text-content-secondary"
          onClick={() => onCapture({ data: {} })}
        >
          {props.secondaryLabel}
        </button>
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------------- category */

function CategoryAdapter({ onCapture }: BeatAdapterProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const voiceFilledRef = useRef(false);
  const submittedRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action !== 'select_option') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (p.fieldName !== 'category' || typeof p.value !== 'string') return;
    const match = FLOW_CATEGORIES.find((c) => c.label.toLowerCase() === p.value!.toLowerCase());
    if (match) {
      setSelected(match.label);
      voiceFilledRef.current = true;
    }
  });

  const submit = () => {
    if (!selected || submittedRef.current) return;
    submittedRef.current = true;
    onCapture({ data: { category: selected } });
  };

  // Auto-submit fallback (Direct-LLM): a spoken category saves + advances without
  // a tap. Single-value beat, valid the moment it is set.
  useEffect(() => {
    if (voiceFilledRef.current && selected) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <CardShell>
      <div className="grid grid-cols-2 gap-[16px]">
        {FLOW_CATEGORIES.map((c) => (
          <CategoryCard
            key={c.label}
            image={c.image}
            label={c.label}
            selected={selected === c.label}
            onSelect={() => setSelected(c.label)}
          />
        ))}
      </div>
      <Cta label="Continue" disabled={!selected} onClick={submit} />
    </CardShell>
  );
}

/* ----------------------------------------------------------------- goals */

function GoalsAdapter({ answers, onCapture }: BeatAdapterProps) {
  const category = (answers.category as string) ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action !== 'select_multiple') return;
    const p = result.params as { fieldName?: string; values?: unknown };
    if (p.fieldName !== 'goals' || !Array.isArray(p.values)) return;
    const allowed = new Set(goals);
    const filtered = p.values
      .filter((v): v is string => typeof v === 'string')
      .filter((v) => allowed.has(v))
      .slice(0, 2);
    if (filtered.length > 0) setSelected(new Set(filtered));
  });

  const toggle = (goal: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) next.delete(goal);
      else if (next.size < 2) next.add(goal);
      return next;
    });

  return (
    <CardShell>
      <div className="flex flex-col gap-[16px]">
        {goals.map((g) => (
          <GoalCard
            key={g}
            label={g}
            selected={selected.has(g)}
            disabled={!selected.has(g) && selected.size >= 2}
            onToggle={() => toggle(g)}
          />
        ))}
      </div>
      <Cta
        label="Continue"
        disabled={selected.size === 0}
        onClick={() => onCapture({ data: { goals: Array.from(selected) } })}
      />
    </CardShell>
  );
}

/* ----------------------------------------------------------------- habits */

function HabitsAdapter({ answers, onCapture }: BeatAdapterProps) {
  const goals = (answers.goals as string[])?.length
    ? (answers.goals as string[])
    : ['Fall asleep earlier'];
  const [expandedGoal, setExpandedGoal] = useState<string>(goals[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (habit: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(habit)) next.delete(habit);
      else if (next.size < MAX_HABITS_ONBOARDING) next.add(habit);
      return next;
    });

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action === 'remove_habit') {
      const p = result.params as { name?: string };
      if (typeof p.name === 'string' && selected.has(p.name.trim())) toggle(p.name.trim());
      return;
    }
    if (result.action === 'select_option' || result.action === 'add_habit') {
      const p = result.params as { name?: string; value?: string };
      const name = (p.name ?? p.value)?.trim();
      if (name && !selected.has(name) && selected.size < MAX_HABITS_ONBOARDING) toggle(name);
    }
  });

  const submit = () => {
    if (selected.size === 0) return;
    const habitConfigs: Record<string, HabitConfigSerialized> = {};
    for (const habit of selected) habitConfigs[habit] = { ...DEFAULT_HABIT_CONFIG };
    onCapture({ data: { habitConfigs } });
  };

  return (
    <CardShell>
      <div className="flex flex-col gap-[16px]">
        {goals.map((goal) => (
          <HabitPickerPanel
            key={goal}
            goal={goal}
            habits={habitsByGoal[goal] ?? []}
            expanded={expandedGoal === goal}
            onToggleExpanded={() => setExpandedGoal((prev) => (prev === goal ? '' : goal))}
            selectedHabits={selected}
            maxReached={selected.size >= MAX_HABITS_ONBOARDING}
            onToggleHabit={toggle}
          />
        ))}
      </div>
      <Cta label="Continue" disabled={selected.size === 0} onClick={submit} />
    </CardShell>
  );
}

/* ------------------------------------------------------------- reflection */

function ReflectionAdapter({ onCapture }: BeatAdapterProps) {
  const [time, setTime] = useState('21:45');
  const [days, setDays] = useState<Set<number>>(new Set(WEEKDAYS));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');

  const changeSchedule = (value: ScheduleOption) => {
    setSchedule(value);
    setDays(new Set(SCHEDULE_DAYS[value]));
  };
  const toggleDay = (day: number) =>
    setDays((prev) => {
      const next = toggleSetItem(prev, day);
      setSchedule(inferSchedule(next) ?? 'Weekday');
      return next;
    });

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action !== 'set_reflection_config') return;
    const p = result.params as {
      time?: string;
      days?: number[];
      reminder?: boolean;
      schedule?: string;
    };
    if (typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time)) setTime(p.time);
    if (Array.isArray(p.days)) {
      const ds = p.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (ds.length > 0) {
        setDays(new Set(ds));
        const matched = inferSchedule(new Set(ds));
        if (matched) setSchedule(matched);
      }
    }
    if (typeof p.reminder === 'boolean') setReminder(p.reminder);
    if (p.schedule === 'Weekday' || p.schedule === 'Weekend' || p.schedule === 'Every day')
      changeSchedule(p.schedule);
  });

  return (
    <CardShell>
      <DailyReflectionCard
        time={time}
        onTimeChange={setTime}
        days={days}
        onToggleDay={toggleDay}
        reminder={reminder}
        onToggleReminder={setReminder}
        schedule={schedule}
        onScheduleChange={changeSchedule}
      />
      <Cta
        label="Continue"
        onClick={() =>
          onCapture({ data: { reflectionConfig: { time, days: [...days], reminder, schedule } } })
        }
      />
    </CardShell>
  );
}

/* ------------------------------------------------------------- plan review */

function PlanAdapter({ node, answers, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { showJournalCard?: boolean };
  const habitConfigs = (answers.habitConfigs ?? {}) as Record<
    string,
    { days: number[] | Set<number>; time: string; reminder: boolean }
  >;
  const reflection = answers.reflectionConfig;

  return (
    <CardShell>
      {Object.entries(habitConfigs).map(([name, cfg]) => {
        const daySet = cfg.days instanceof Set ? cfg.days : new Set(cfg.days);
        return (
          <PlanSummaryCard
            key={name}
            icon="mdi:checkbox-marked-circle-outline"
            typeLabel="Habit"
            title={name}
            cadence={formatCadence(daySet)}
            rule={cfg.reminder ? `Reminder at ${cfg.time}` : `At ${cfg.time}`}
          />
        );
      })}
      {answers.brainDumpText && (
        <PlanSummaryCard
          icon="mdi:lightbulb-on-outline"
          typeLabel="Habit"
          title="From your brain dump"
          cadence="To organize"
          rule={String(answers.brainDumpText).slice(0, 80)}
        />
      )}
      {props.showJournalCard && reflection && (
        <PlanSummaryCard
          icon="mdi:book-edit-outline"
          typeLabel="Journal"
          title="Daily Reflection"
          cadence={formatCadence(new Set(reflection.days))}
          rule={reflection.reminder ? `Reminder at ${reflection.time}` : `At ${reflection.time}`}
        />
      )}
      <Cta label="Start my plan" onClick={() => onCapture({ data: {} })} />
    </CardShell>
  );
}

/* ----------------------------------------------------- brain dump / coach */

function BrainDumpAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { brainDump?: boolean; placeholder?: string };
  const [text, setText] = useState('');
  if (!props.brainDump) return null;
  return (
    <CardShell>
      <textarea
        className="min-h-[140px] w-full rounded-[16px] border border-border bg-surface p-4 text-base text-content"
        placeholder={props.placeholder ?? 'Tell me everything on your mind...'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Cta
        label="Continue"
        disabled={!text.trim()}
        onClick={() => onCapture({ data: { brainDumpText: text.trim() } })}
      />
    </CardShell>
  );
}

/* ------------------------------------------------------------- the registry */

type AdapterComponent = (props: BeatAdapterProps) => React.ReactNode;

export const ADAPTER_REGISTRY: Record<string, AdapterComponent> = {
  auth: AuthAdapter,
  'mic-permission': MicPermissionAdapter,
  'profile-input': ProfileAdapter,
  'path-selection': PathSelectionAdapter,
  'primary-button': PrimaryButtonAdapter,
  'category-grid': CategoryAdapter,
  'goals-list': GoalsAdapter,
  'habit-picker': HabitsAdapter,
  'reflection-card': ReflectionAdapter,
  'plan-cards': PlanAdapter,
  'coach-bubble': BrainDumpAdapter,
};

export function getAdapter(componentType: string): AdapterComponent | undefined {
  return ADAPTER_REGISTRY[componentType];
}

/* --------------------------------------------- past-beat answer summaries */

/** Short user-facing summary of what was captured at a beat (the user bubble). */
export function summarizeBeat(node: FlowNode, answers: FlowAnswers): string | null {
  switch (node.componentType) {
    case 'auth':
      return 'Signed in.';
    case 'mic-permission':
      // Mic result is saved to preferences, not flow answers; keep a neutral line.
      return 'Microphone set.';
    case 'profile-input':
      return answers.age || answers.gender
        ? [answers.age ? `${answers.age}` : null, answers.gender as string | undefined]
            .filter(Boolean)
            .join(', ') + '.'
        : null;
    case 'path-selection':
      if (node.type === 'branch')
        return answers.path === 'braindump' ? 'I have experience.' : "I'm new to this.";
      return null;
    case 'category-grid':
      return answers.category ? `Let's work on ${String(answers.category).toLowerCase()}.` : null;
    case 'goals-list':
      return answers.goals?.length ? answers.goals.join(' and ') + '.' : null;
    case 'habit-picker':
      return answers.habitConfigs
        ? `${Object.keys(answers.habitConfigs).length} habit(s) to start.`
        : null;
    case 'reflection-card':
      return answers.reflectionConfig ? `Reflect at ${answers.reflectionConfig.time}.` : null;
    case 'coach-bubble':
      return answers.brainDumpText ? String(answers.brainDumpText) : null;
    default:
      return null;
  }
}
