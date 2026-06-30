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
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { HabitListItem } from '@/components/home/HabitListItem';
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
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import { ReflectionModeEditor } from '@/components/onboarding/ReflectionModeEditor';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DualButton } from '@/components/ui/DualButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import {
  type OnboardingVoiceResult,
  useOnboardingVoice,
  useOnboardingVoiceActions,
} from '@/contexts/useOnboardingVoiceSession';
import { useAuth } from '@/hooks/useAuth';
import { useHabitsForDate } from '@/hooks/useHabitsForDate';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { formatDate } from '@/utils/dates';
import type { CheckInDimension, HabitDayStatus, ReflectionMode } from '@gg/shared/types';
import {
  FLOW_CATEGORIES,
  GENDER_OPTIONS,
  goalsByCategory,
  habitsByGoal,
  MAX_HABITS_ONBOARDING,
} from '../flowData';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { useFlowSurface } from './flowSurface';

export interface BeatAdapterProps {
  node: FlowNode;
  answers: FlowAnswers;
  onCapture: (capture: BeatCapture) => void;
  // Past beat: render the card frozen in its captured state — the selection seeds
  // from `answers`, inputs are inert, and the CTA is gone. The active beat (the
  // default) is fully interactive. This is what keeps every completed beat on
  // screen as a persisted chat receipt instead of collapsing to a text summary.
  readOnly?: boolean;
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
  const { onColoredSurface } = useFlowSurface();
  return (
    <Button
      variant={onColoredSurface ? 'secondary' : 'primary'}
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

function CardShell({ children, frozen }: { children: React.ReactNode; frozen?: boolean }) {
  return (
    <div
      className={`mt-3 flex flex-col gap-4${frozen ? 'pointer-events-none select-none opacity-95' : ''}`}
      aria-disabled={frozen || undefined}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------- auth */

// Auth beat 0. Ported from the flow-builder's authSignup designer beat
// (ggmvp-flow-builder/.../beats/authSignup.tsx) and wired to the REAL Supabase
// auth from the standalone sign-in/up pages (authStore: signInWithGoogle /
// signUp / signIn). The designer beat was a static mock; this is the live card.
//
// Advance rules (call onCapture to move past the beat):
//   - Already signed in (user present)  -> auto-advance ("Signed in.").
//   - Email LOGIN succeeds              -> session set, user becomes truthy ->
//     auto-advance via the same effect.
//   - Email SIGNUP                      -> requires email verification (the store
//     rejects auto-confirmed sessions), so we show a "check your email" notice;
//     the user is NOT advanced here, they verify then sign in.
//   - Google OAuth                      -> redirects away and returns to
//     /onboarding/flow authenticated; the auto-advance branch then fires.
function AppleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
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
  );
}

function AuthAdapter({ onCapture, readOnly }: BeatAdapterProps) {
  const { user, signInWithGoogle, signUp, signIn } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'default' | 'signup' | 'login'>('default');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  // Auto-advance the moment a real session exists: a logged-in user landing on
  // the beat (or returning from the Google OAuth round-trip, or an email login
  // that just set the session) skips the form. Guarded so it fires once.
  const advancedRef = useRef(false);
  const advance = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onCapture({ data: {} });
  };
  useEffect(() => {
    if (!readOnly && user) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGoogle = async () => {
    if (busy) return;
    setError(null);
    setBusy('google');
    // Real OAuth. signInWithGoogle redirects to {webOrigin}/auth/callback; the
    // callback then routes a needs-onboarding user back to /onboarding/flow,
    // where this beat auto-advances (user is now present). The Supabase project's
    // allowed redirect URLs must include the dev origin for this to round-trip
    // locally (flagged for Yair).
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError);
      setBusy(null);
    }
    // On success the page navigates away; no need to clear busy.
  };

  const handleApple = () => {
    // Matches the standalone pages: Apple sign-in is not wired yet.
    toast.addToast('info', 'Apple sign-in coming soon');
  };

  const handleEmail = async () => {
    if (busy) return;
    setError(null);
    setBusy('email');
    if (mode === 'login') {
      const { error: signInError } = await signIn(email.trim(), pw);
      if (signInError) {
        setError(signInError);
        setBusy(null);
        return;
      }
      // Success: the store set the session + user; the auto-advance effect fires.
      return;
    }
    // signup
    const result = await signUp(email.trim(), pw);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.confirmationPending) {
      // Email verification required: the store signed the user back out, so we
      // cannot advance. Show the check-your-email notice and let them switch to
      // login after verifying.
      setConfirmationPending(true);
    }
  };

  // Past auth beat: a frozen confirmation, not the live signup form.
  if (readOnly) {
    return (
      <CardShell frozen>
        <div className="flex items-center gap-2 text-[15px] font-semibold text-content">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[12px] text-white">
            ✓
          </span>
          You're signed in.
        </div>
      </CardShell>
    );
  }

  if (confirmationPending) {
    return (
      <CardShell>
        <div className="text-[22px] font-bold text-content">Check your email</div>
        <div className="text-[14px] leading-[1.5] text-content-secondary">
          We sent a verification link to <strong>{email.trim()}</strong>. Click the link to verify
          your account, then log in to continue.
        </div>
        <Button
          variant="primary"
          size="auth"
          fullWidth
          onClick={() => {
            setConfirmationPending(false);
            setMode('login');
            setPw('');
            setError(null);
          }}
        >
          I verified, log in
        </Button>
      </CardShell>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="text-[26px] font-bold text-primary">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </div>
      <div className="space-y-3">
        <Button
          variant="social-dark"
          size="auth"
          fullWidth
          disabled={busy !== null}
          onClick={handleApple}
        >
          <AppleGlyph />
          Continue with Apple
        </Button>
        <Button
          variant="social-light"
          size="auth"
          fullWidth
          disabled={busy !== null}
          onClick={handleGoogle}
        >
          {busy === 'google' ? <LoadingSpinner /> : <GoogleGlyph />}
          {busy === 'google' ? 'Connecting...' : 'Continue with Google'}
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
            disabled={busy !== null}
          />
          <OnboardingInput
            icon="mdi:account-outline"
            placeholder="Last name"
            value={last}
            onChange={setLast}
            disabled={busy !== null}
          />
          <OnboardingInput
            icon="mdi:email-outline"
            placeholder="Email"
            type="email"
            value={email}
            onChange={setEmail}
            disabled={busy !== null}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            type="password"
            value={pw}
            onChange={setPw}
            disabled={busy !== null}
            onEnter={handleEmail}
          />
          <Button
            variant="primary"
            size="auth"
            fullWidth
            disabled={busy !== null || !email.trim() || !pw}
            onClick={handleEmail}
          >
            {busy === 'email' ? <LoadingSpinner color="text-white" /> : 'Create account'}
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
            type="email"
            value={email}
            onChange={setEmail}
            disabled={busy !== null}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            type="password"
            value={pw}
            onChange={setPw}
            disabled={busy !== null}
            onEnter={handleEmail}
          />
          <Button
            variant="primary"
            size="auth"
            fullWidth
            disabled={busy !== null || !email.trim() || !pw}
            onClick={handleEmail}
          >
            {busy === 'email' ? <LoadingSpinner color="text-white" /> : 'Log in'}
          </Button>
        </div>
      )}
      {mode === 'default' && (
        <Button
          variant="primary"
          size="auth"
          fullWidth
          disabled={busy !== null}
          onClick={() => setMode('signup')}
        >
          Sign up with email
        </Button>
      )}
      {error && <div className="text-center text-[13px] font-medium text-red-600">{error}</div>}
      <div className="text-center text-[13px] text-content-secondary">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
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
              onClick={() => {
                setMode('login');
                setError(null);
              }}
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

/* ----------------------------------------------------------- mic permission */

// Mic-permission beat (designer beat 5). A coach-led permission gate, not a save
// step: it requests the mic and records the result through the real preferences
// path (useUserPreferences.updatePreferences -> Supabase, local-only when signed
// out), then captures {} to advance. The copy is the designer's (props on the
// flow node); the dual-button dial reuses the real MicPermissionPage visual.
function MicPermissionAdapter({ node, onCapture, readOnly }: BeatAdapterProps) {
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
    <CardShell frozen={readOnly}>
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
      {!readOnly && (
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
      )}
    </CardShell>
  );
}

/* ------------------------------------------------------------------ profile */

// Profile beat 1: age + gender only. The name comes from auth (beat 0).
function ProfileAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const [age, setAge] = useState<number | ''>((answers.age as number) ?? '');
  const [gender, setGender] = useState<string | null>((answers.gender as string) ?? null);
  // Set when the coach (Direct-LLM) fills a field by voice. Drives the
  // auto-submit below so a spoken answer saves + advances without a tap. Never
  // set by a tap or by hydration, so tap stays Continue-driven.
  const voiceFilledRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (readOnly) return;
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
    if (readOnly || !valid || submittedRef.current) return;
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
    <CardShell frozen={readOnly}>
      <AgeScrollPicker value={age} onChange={setAge} />
      <ChipSelect
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
        columns={3}
        ariaLabel="How do you identify?"
      />
      {!readOnly && (
        <>
          {/* Affordance hint from the flow builder's profile beat: the user can
              use the voice orb OR tap the inputs. Reinforces the in-page orb. */}
          <div className="self-center text-[12px] font-medium text-content-tertiary">
            You can speak or tap
          </div>
          <Cta label="Continue" disabled={!valid} onClick={submit} />
        </>
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------------- path / fork */

interface PathOption {
  value: string;
  label: string;
  description?: string;
}

function PathSelectionAdapter({ node, answers, onCapture, readOnly }: BeatAdapterProps) {
  const props = node.componentProps as { options?: PathOption[]; bindsTo?: string };
  const options = props.options ?? [];
  const bindsToPath = props.bindsTo === 'path';
  const [selected, setSelected] = useState<string | null>(() => (answers.path as string) ?? null);
  const voiceFilledRef = useRef(false);
  const submittedRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (readOnly || !bindsToPath || result.action !== 'set_path') return;
    const p = result.params as { value?: string };
    if (p.value === 'simple' || p.value === 'braindump') {
      setSelected(p.value);
      voiceFilledRef.current = true;
    }
  });

  const submit = () => {
    if (readOnly || !selected || submittedRef.current) return;
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
    <CardShell frozen={readOnly}>
      {options.map((o) => (
        <SelectionCard
          key={o.value}
          title={o.label}
          description={o.description ?? ''}
          selected={selected === o.value}
          onSelect={() => setSelected(o.value)}
        />
      ))}
      {!readOnly && <Cta label="Continue" disabled={!selected} onClick={submit} />}
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

function CategoryAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const [selected, setSelected] = useState<string | null>(
    () => (answers.category as string) ?? null,
  );
  const voiceFilledRef = useRef(false);
  const submittedRef = useRef(false);

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (readOnly || result.action !== 'select_option') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (p.fieldName !== 'category' || typeof p.value !== 'string') return;
    const match = FLOW_CATEGORIES.find((c) => c.label.toLowerCase() === p.value!.toLowerCase());
    if (match) {
      setSelected(match.label);
      voiceFilledRef.current = true;
    }
  });

  const submit = () => {
    if (readOnly || !selected || submittedRef.current) return;
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
    <CardShell frozen={readOnly}>
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
      {!readOnly && <Cta label="Continue" disabled={!selected} onClick={submit} />}
    </CardShell>
  );
}

/* ----------------------------------------------------------------- goals */

function GoalsAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const category = (answers.category as string) ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((answers.goals as string[]) ?? []),
  );

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (readOnly || result.action !== 'select_multiple') return;
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
    <CardShell frozen={readOnly}>
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
      {!readOnly && (
        <Cta
          label="Continue"
          disabled={selected.size === 0}
          onClick={() => onCapture({ data: { goals: Array.from(selected) } })}
        />
      )}
    </CardShell>
  );
}

/* ----------------------------------------------------------------- habits */

function HabitsAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const goals = (answers.goals as string[])?.length
    ? (answers.goals as string[])
    : ['Fall asleep earlier'];
  const [expandedGoal, setExpandedGoal] = useState<string>(goals[0]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Object.keys(answers.habitConfigs ?? {})),
  );

  const toggle = (habit: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(habit)) next.delete(habit);
      else if (next.size < MAX_HABITS_ONBOARDING) next.add(habit);
      return next;
    });

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (readOnly) return;
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
    if (readOnly || selected.size === 0) return;
    const habitConfigs: Record<string, HabitConfigSerialized> = {};
    for (const habit of selected) habitConfigs[habit] = { ...DEFAULT_HABIT_CONFIG };
    onCapture({ data: { habitConfigs } });
  };

  return (
    <CardShell frozen={readOnly}>
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
      {!readOnly && <Cta label="Continue" disabled={selected.size === 0} onClick={submit} />}
    </CardShell>
  );
}

/* --------------------------------------------------------- schedule card */

// A reusable time + days + reminder schedule editor, wrapping the real
// DailyReflectionCard chrome. Used by both the habit-schedule and the
// morning-checkin-setup beats. Returns the chosen schedule to the caller, which
// decides which answer key it lands under.
interface ScheduleState {
  time: string;
  days: number[];
  reminder: boolean;
  schedule: ScheduleOption;
}

function ScheduleCard({
  initialTime,
  initialDays,
  initialReminder = true,
  initialSchedule = 'Weekday',
  voiceAction,
  ctaLabel,
  readOnly,
  onSubmit,
  title,
  subtitle,
}: {
  initialTime: string;
  initialDays?: number[];
  initialReminder?: boolean;
  initialSchedule?: ScheduleOption;
  // The voice action this beat listens for (e.g. set_reflection_config). When the
  // coach (Direct-LLM) fills the schedule by voice, it lands here.
  voiceAction: string;
  ctaLabel: string;
  readOnly?: boolean;
  onSubmit: (value: ScheduleState) => void;
  title?: string;
  subtitle?: string;
}) {
  const [time, setTime] = useState(initialTime);
  const [days, setDays] = useState<Set<number>>(
    () => new Set(initialDays && initialDays.length > 0 ? initialDays : WEEKDAYS),
  );
  const [reminder, setReminder] = useState(initialReminder);
  const [schedule, setSchedule] = useState<ScheduleOption>(initialSchedule);

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
    if (readOnly || result.action !== voiceAction) return;
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
    <CardShell frozen={readOnly}>
      <DailyReflectionCard
        variant="schedule"
        title={title}
        subtitle={subtitle}
        time={time}
        onTimeChange={setTime}
        days={days}
        onToggleDay={toggleDay}
        reminder={reminder}
        onToggleReminder={setReminder}
        schedule={schedule}
        onScheduleChange={changeSchedule}
      />
      {!readOnly && (
        <Cta
          label={ctaLabel}
          onClick={() => onSubmit({ time, days: [...days], reminder, schedule })}
        />
      )}
    </CardShell>
  );
}

/* ------------------------------------------------------- habit schedule */

// Habit schedule beat: pick when the chosen habits happen. The captured schedule
// is applied to every selected habit's config (one shared schedule for the start
// plan; per-habit tweaks happen later on plan-review).
function HabitScheduleAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const existing = (answers.habitConfigs ?? {}) as Record<string, HabitConfigSerialized>;
  const names = Object.keys(existing);
  const first = names.length > 0 ? existing[names[0]] : undefined;
  const submit = (s: ScheduleState) => {
    const base = { days: s.days, time: s.time, reminder: s.reminder, schedule: s.schedule };
    const habitConfigs: Record<string, HabitConfigSerialized> =
      names.length > 0
        ? Object.fromEntries(names.map((n) => [n, { ...existing[n], ...base }]))
        : { ...existing };
    onCapture({ data: { habitConfigs } });
  };
  return (
    // title/subtitle copy provisional — pending Yair.
    <ScheduleCard
      initialTime={first?.time ?? '09:00'}
      initialDays={first?.days}
      initialReminder={first?.reminder}
      initialSchedule={(first?.schedule as ScheduleOption) ?? 'Weekday'}
      voiceAction="set_habit_schedule"
      ctaLabel="Continue"
      title="Habit Schedule"
      subtitle="When you'll do these"
      readOnly={readOnly}
      onSubmit={submit}
    />
  );
}

/* --------------------------------------------------- morning check-in setup */

// Morning check-in setup beat: pick when the morning nudge fires. Lands under the
// morningCheckin answer key (submit_morning_checkin server-side).
function MorningCheckinAdapter({ answers, onCapture, readOnly }: BeatAdapterProps) {
  const existing = answers.morningCheckin as
    | { time: string; days: number[]; reminder: boolean; schedule: string }
    | undefined;
  const submit = (s: ScheduleState) =>
    onCapture({
      data: {
        morningCheckin: { time: s.time, days: s.days, reminder: s.reminder, schedule: s.schedule },
      },
    });
  return (
    // title/subtitle copy provisional — pending Yair.
    <ScheduleCard
      initialTime={existing?.time ?? '08:00'}
      initialDays={existing?.days}
      initialReminder={existing?.reminder}
      initialSchedule={(existing?.schedule as ScheduleOption) ?? 'Weekday'}
      voiceAction="set_morning_checkin"
      ctaLabel="Continue"
      title="Morning Check-in"
      subtitle="Your daily start nudge"
      readOnly={readOnly}
      onSubmit={submit}
    />
  );
}

/* ------------------------------------------------------------- reflection */

// Evening reflection beat: schedule (time + days + reminder) PLUS the style
// (guided prompts, custom prompts, or freeform) via the real ReflectionModeEditor.
// The mode + custom prompts ride into the submit_reflection_config payload (the
// tool already accepts a `mode` param and the handler already reads it).
function ReflectionAdapter({ node, answers, onCapture, readOnly }: BeatAdapterProps) {
  const props = node.componentProps as { showModePicker?: boolean };
  const saved = answers.reflectionConfig as
    | { time: string; days: number[]; reminder: boolean; schedule: string }
    | undefined;
  const [time, setTime] = useState(saved?.time ?? '21:45');
  const [days, setDays] = useState<Set<number>>(
    () => new Set(saved?.days && saved.days.length > 0 ? saved.days : WEEKDAYS),
  );
  const [reminder, setReminder] = useState(saved?.reminder ?? true);
  const [schedule, setSchedule] = useState<ScheduleOption>(
    (saved?.schedule as ScheduleOption) ?? 'Weekday',
  );
  const [mode, setMode] = useState<ReflectionMode>(
    (answers.reflectionMode as ReflectionMode) ?? 'prompts',
  );
  const [prompts, setPrompts] = useState<string[]>(() => (answers.customPrompts as string[]) ?? []);

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
    if (readOnly || result.action !== 'set_reflection_config') return;
    const p = result.params as {
      time?: string;
      days?: number[];
      reminder?: boolean;
      schedule?: string;
      mode?: string;
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
    if (p.mode === 'prompts' || p.mode === 'freeform') setMode(p.mode);
  });

  const submit = () => {
    // Custom prompts only carry when the user chose prompts mode and authored some.
    const customPrompts = mode === 'prompts' ? prompts.filter((p) => p.trim()) : [];
    onCapture({
      data: {
        reflectionConfig: { time, days: [...days], reminder, schedule },
        reflectionMode: mode,
        ...(customPrompts.length > 0 ? { customPrompts } : {}),
      },
    });
  };

  return (
    <CardShell frozen={readOnly}>
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
      {props.showModePicker && (
        <ReflectionModeEditor
          mode={mode}
          onModeChange={setMode}
          prompts={prompts}
          onPromptsChange={setPrompts}
        />
      )}
      {!readOnly && <Cta label="Continue" onClick={submit} />}
    </CardShell>
  );
}

/* ------------------------------------------------------------- into the app */

// Terminal completion beat. A real node now (replaces the hardcoded "You're all
// set" line in FlowRenderer): the coach line plays as the beat opener and the
// user taps in. Captures {} to complete the flow.
function IntoAppAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { ctaLabel?: string };
  return (
    <CardShell>
      <Cta label={props.ctaLabel ?? "Let's go"} onClick={() => onCapture({ data: {} })} />
    </CardShell>
  );
}

/* ------------------------------------------------------------- plan review */

function PlanAdapter({ node, answers, onCapture, readOnly }: BeatAdapterProps) {
  const props = node.componentProps as { showJournalCard?: boolean };
  const habitConfigs = (answers.habitConfigs ?? {}) as Record<
    string,
    { days: number[] | Set<number>; time: string; reminder: boolean }
  >;
  const reflection = answers.reflectionConfig;

  return (
    <CardShell frozen={readOnly}>
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
      {!readOnly && <Cta label="Start my plan" onClick={() => onCapture({ data: {} })} />}
    </CardShell>
  );
}

/* ----------------------------------------------------- brain dump / coach */

function BrainDumpAdapter({ node, answers, onCapture, readOnly }: BeatAdapterProps) {
  const props = node.componentProps as { brainDump?: boolean; placeholder?: string };
  const [text, setText] = useState(() => (answers.brainDumpText as string) ?? '');
  // Active coach-bubble fallback only renders for a brainDump beat; a frozen past
  // beat always renders (it shows the captured dump).
  if (!props.brainDump && !readOnly) return null;
  return (
    <CardShell frozen={readOnly}>
      <textarea
        className="min-h-[140px] w-full rounded-[16px] border border-border bg-surface p-4 text-base text-content"
        placeholder={props.placeholder ?? 'Tell me everything on your mind...'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
      />
      {!readOnly && (
        <Cta
          label="Continue"
          disabled={!text.trim()}
          onClick={() => onCapture({ data: { brainDumpText: text.trim() } })}
        />
      )}
    </CardShell>
  );
}

// Generic coach-bubble: a say-only beat with no interactive card of its own (the
// coach line is the content, rendered by BeatView). When the beat carries a
// brainDump prop it falls back to the brain-dump textarea (the advanced lane uses
// the advanced-capture type now, so brainDump coach-bubbles are legacy only). For
// a say-only beat that still needs to advance (e.g. the check-in greeting / wrap /
// are-you-done nudges), a small Continue keeps the chat moving without a tap on a
// non-existent card.
function CoachBubbleAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as {
    brainDump?: boolean;
    placeholder?: string;
    ctaLabel?: string;
  };
  if (props.brainDump) return <BrainDumpAdapter node={node} answers={{}} onCapture={onCapture} />;
  // A say-only beat that waits for input (expectsInput) shows a Continue; a pure
  // statement beat (wrap line) advances itself on mount.
  const waits = node.voice.expectsInput;
  if (!waits) {
    return <AutoAdvance onDone={() => onCapture({ data: {} })} />;
  }
  return (
    <CardShell>
      <Cta label={props.ctaLabel ?? 'Continue'} onClick={() => onCapture({ data: {} })} />
    </CardShell>
  );
}

// Statement beats carry the conversation forward without user input. When the
// opener is being spoken, wait for it to finish so the line isn't cut off;
// otherwise advance after a short grace (tap / voice-off / no provider).
const AUTO_ADVANCE_GRACE_MS = 600;
function AutoAdvance({ onDone }: { onDone: () => void }) {
  const isSpeaking = useOnboardingVoice()?.isAssistantSpeaking ?? false;
  const firedRef = useRef(false);
  const spokeRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    if (isSpeaking) {
      spokeRef.current = true;
      return;
    }
    if (spokeRef.current) {
      firedRef.current = true;
      onDone();
      return;
    }
    const t = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onDone();
    }, AUTO_ADVANCE_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [isSpeaking, onDone]);
  return null;
}

/* ---------------------------------------------------------- state check */

// Morning state-check: the four-row sleep / mood / energy / stress card. The user
// taps a 1-5 value per dimension; captured as a checkin object. Wraps the same
// checkInDimensions + EmojiOptionButton primitives the home CheckInCard uses.
function StateCheckAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { dimensions?: CheckInDimension[] };
  const want = props.dimensions;
  const dims = want ? checkInDimensions.filter((d) => want.includes(d.key)) : checkInDimensions;
  const [values, setValues] = useState<Partial<Record<CheckInDimension, number>>>({});

  useOnboardingVoiceActions((result: OnboardingVoiceResult) => {
    if (result.action !== 'record_checkin') return;
    const p = result.params as Partial<Record<CheckInDimension, number>>;
    setValues((prev) => {
      const next = { ...prev };
      for (const dim of dims) {
        const v = p[dim.key];
        if (typeof v === 'number' && v >= 1 && v <= 5) next[dim.key] = v;
      }
      return next;
    });
  });

  const anyFilled = Object.keys(values).length > 0;
  const submit = () => onCapture({ data: { checkin: values } });

  return (
    <CardShell>
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        {dims.map((dim) => (
          <div key={dim.key} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-content-subtle">{dim.label}</span>
            <div className="flex w-full justify-between">
              {dim.options.map((o) => (
                <EmojiOptionButton
                  key={o.value}
                  icon={o.icon}
                  label={o.label}
                  color={o.color}
                  isSelected={values[dim.key] === o.value}
                  onClick={() => setValues((prev) => ({ ...prev, [dim.key]: o.value }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Cta label="Continue" disabled={!anyFilled} onClick={submit} />
    </CardShell>
  );
}

/* --------------------------------------------------------- habit review */

// Real habits for today; persistence on Continue via complete_habit, taps are local overrides.
const cycleHabitStatus = (s: HabitDayStatus): HabitDayStatus =>
  s === 'pending' ? 'done' : s === 'done' ? 'missed' : 'pending';

function HabitReviewAdapter({ onCapture }: BeatAdapterProps) {
  const today = formatDate(new Date());
  const { habits, loading } = useHabitsForDate(today, 'ECHECK-HABITS');
  // Local overrides over the persisted status; absent → the real day status.
  const [overrides, setOverrides] = useState<Record<string, HabitDayStatus>>({});
  const statusOf = (id: string, initial: HabitDayStatus) => overrides[id] ?? initial;

  const submit = () => {
    const habitStatuses = Object.fromEntries(
      habits.map((h) => [h.habit.id, statusOf(h.habit.id, h.status)]),
    );
    onCapture({ data: { habitStatuses } as Record<string, unknown> });
  };

  return (
    <CardShell>
      <div className="flex w-full flex-col gap-2">
        {habits.map((h) => {
          const st = statusOf(h.habit.id, h.status);
          return (
            <HabitListItem
              key={h.habit.id}
              name={h.habit.name}
              subtitle=""
              streak={h.streak}
              status={st}
              onSetStatus={(next) => setOverrides((prev) => ({ ...prev, [h.habit.id]: next }))}
              onClick={() =>
                setOverrides((prev) => ({ ...prev, [h.habit.id]: cycleHabitStatus(st) }))
              }
            />
          );
        })}
      </div>
      <Cta label="Continue" disabled={loading} onClick={submit} />
    </CardShell>
  );
}

/* ----------------------------------------------------- evening reflection */

// Evening reflection: a multi-question say-only beat (proud / forgive / grateful).
// The user answers each in their own words; the answers are captured as one
// reflection text (joined), persisted via the log_reflection handler server side.
interface ReflectionQuestion {
  key: string;
  prompt: string;
}

function ReflectionSayAdapter({ node, onCapture }: BeatAdapterProps) {
  const props = node.componentProps as { questions?: ReflectionQuestion[] };
  const questions = props.questions ?? [];
  const [answersByKey, setAnswersByKey] = useState<Record<string, string>>({});

  const setAnswer = (key: string, value: string) =>
    setAnswersByKey((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const reflectionText = questions
      .map((q) => {
        const a = (answersByKey[q.key] ?? '').trim();
        return a ? `${q.prompt} ${a}` : '';
      })
      .filter(Boolean)
      .join('\n');
    onCapture({ data: { reflectionText } as Record<string, unknown> });
  };

  return (
    <CardShell>
      <div className="flex flex-col gap-4">
        {questions.map((q) => (
          <div key={q.key} className="flex flex-col gap-1.5">
            <span className="text-[15px] font-medium text-content">{q.prompt}</span>
            <textarea
              className="min-h-[64px] w-full rounded-[16px] border border-border bg-surface p-3 text-base text-content"
              value={answersByKey[q.key] ?? ''}
              onChange={(e) => setAnswer(q.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <Cta label="Continue" onClick={submit} />
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
  'habit-schedule': HabitScheduleAdapter,
  'morning-checkin-setup': MorningCheckinAdapter,
  'reflection-card': ReflectionAdapter,
  'plan-cards': PlanAdapter,
  'into-app': IntoAppAdapter,
  // The advanced (braindump) lane renders the brain-dump card. coach-bubble is now
  // generic: say-only by default (the check-in greeting / nudge / wrap beats),
  // falling back to the brain-dump card only when a brainDump prop is set.
  'advanced-capture': BrainDumpAdapter,
  'coach-bubble': CoachBubbleAdapter,
  // Check-in flow adapters (morning + evening check-in documents).
  'state-check': StateCheckAdapter,
  'habit-review': HabitReviewAdapter,
  reflection: ReflectionSayAdapter,
};

export function getAdapter(componentType: string): AdapterComponent | undefined {
  return ADAPTER_REGISTRY[componentType];
}

// Past beats of these types re-render their real card frozen in the captured
// state (seeded from `answers`, inputs inert, CTA gone) so every completed beat
// stays on screen as a persisted chat receipt — the whole journey scrolls back as
// real screens (auth confirmation, the mic dial, the brain dump, every data card),
// not one-line summaries. Excluded: the terminal into-app (its content is just the
// coach line) and the say-only / check-in beats (no captured card to freeze).
export const FROZEN_CARD_TYPES: ReadonlySet<string> = new Set([
  'auth',
  'mic-permission',
  'profile-input',
  'path-selection',
  'category-grid',
  'goals-list',
  'habit-picker',
  'habit-schedule',
  'morning-checkin-setup',
  'reflection-card',
  'plan-cards',
  'advanced-capture',
]);

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
    case 'habit-schedule': {
      // The shared schedule applied across habits: read the first habit's time.
      const cfgs = answers.habitConfigs ?? {};
      const first = Object.values(cfgs)[0];
      return first ? `Scheduled for ${first.time}.` : null;
    }
    case 'morning-checkin-setup':
      return answers.morningCheckin ? `Morning check-in at ${answers.morningCheckin.time}.` : null;
    case 'reflection-card':
      return answers.reflectionConfig ? `Reflect at ${answers.reflectionConfig.time}.` : null;
    case 'into-app':
      // Terminal beat; no captured answer to echo back.
      return null;
    case 'state-check': {
      const checkin = answers.checkin;
      if (!checkin) return null;
      const parts = checkInDimensions
        .map((d) => {
          const v = checkin[d.key];
          const opt = typeof v === 'number' ? d.options.find((o) => o.value === v) : undefined;
          return opt ? `${d.label}: ${opt.label}` : null;
        })
        .filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'habit-review': {
      const statuses = (answers as Record<string, unknown>).habitStatuses as
        | Record<string, string>
        | undefined;
      if (!statuses) return null;
      const done = Object.values(statuses).filter((s) => s === 'done').length;
      return `${done} done today.`;
    }
    case 'reflection': {
      const text = (answers as Record<string, unknown>).reflectionText as string | undefined;
      return text && text.trim() ? 'Reflected.' : null;
    }
    case 'advanced-capture':
    case 'coach-bubble':
      return answers.brainDumpText ? String(answers.brainDumpText) : null;
    default:
      return null;
  }
}
