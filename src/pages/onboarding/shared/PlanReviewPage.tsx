import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { formatCadence } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PlanSummaryCard } from '@/components/onboarding/PlanSummaryCard';
import {
  useOnboardingVoice,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { Sentry } from '@/lib/sentry';
import { pathToSpec } from './pathToSpec';
import {
  deriveStateFromOnboarding,
  type PlanReviewHabitConfig,
  type PlanReviewState,
} from './planReviewDerive';

const CATEGORY_ICONS: Record<string, string> = {
  Sleep: 'ic:outline-nightlight-round',
  Move: 'ic:outline-directions-run',
  Eat: 'ic:outline-restaurant',
  Energy: 'ic:outline-bolt',
  Stress: 'ic:outline-self-improvement',
  Focus: 'ic:outline-center-focus-strong',
  Habits: 'ic:outline-check-circle',
  Organization: 'ic:outline-assignment',
};

export function PlanReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as PlanReviewState | null;
  const { state: onboardingState, complete, isCompleting, completeError } = useOnboarding();
  const onboardingVoice = useOnboardingVoice();

  // Voice update_habit edits on this screen, applied over the base state.
  // Backend persists them too, but a frozen routerState would otherwise shadow
  // the change and complete() would write the stale config.
  const [habitPatches, setHabitPatches] = useState<Record<string, Partial<PlanReviewHabitConfig>>>(
    {},
  );

  // Router state carries source='advanced' that agent-driven derivation can't reconstruct.
  const state = useMemo<PlanReviewState | null>(() => {
    const base = routerState ?? deriveStateFromOnboarding(onboardingState?.data);
    if (!base?.habitConfigs || Object.keys(habitPatches).length === 0) return base;
    const habitConfigs = { ...base.habitConfigs };
    for (const [name, patch] of Object.entries(habitPatches)) {
      const key = Object.keys(habitConfigs).find((k) => k.toLowerCase() === name.toLowerCase());
      if (key) habitConfigs[key] = { ...habitConfigs[key], ...patch };
    }
    return { ...base, habitConfigs };
  }, [routerState, onboardingState?.data, habitPatches]);

  // Voice nav lands here with no router state → state.source undefined; fall back to persisted path.
  const source: 'advanced' | 'beginner' =
    state?.source ?? (onboardingState?.path === 'braindump' ? 'advanced' : 'beginner');

  // Advanced plan-review screen context (Vapi + Direct-LLM); beginner route resolves on its own.
  useEffect(() => {
    if (!onboardingVoice || source !== 'advanced') return;
    onboardingVoice.pushSubScreen('ONBOARD-ADVANCED-05');
    return () => onboardingVoice.pushSubScreen(null);
  }, [onboardingVoice, source]);

  // Track view_starting_plan on mount
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (hasTrackedView.current || !state?.habitConfigs) return;
    hasTrackedView.current = true;
    track('view_starting_plan', {
      total_habits: Object.keys(state.habitConfigs).length,
      has_journal: Boolean(state.reflectionConfig),
      onboarding_path: pathToSpec(source === 'advanced' ? 'braindump' : 'simple'),
    });
  }, [state, source]);

  // Read the start timestamp written by MicPermissionPage to localStorage.
  // The previous onboardingStartRef was initialized here (last screen), so
  // total_time_seconds only captured time on the review page, not the full flow.
  const onboardingStartedAt = useRef<number>(
    Number(localStorage.getItem('gg_onboarding_started_at') || 0),
  );

  const handleStartPlan = useCallback(() => {
    if (!state?.habitConfigs) return;
    track('complete_onboarding', {
      onboarding_path: pathToSpec(source === 'advanced' ? 'braindump' : 'simple'),
      total_habits: Object.keys(state.habitConfigs).length,
      has_journal: Boolean(state.reflectionConfig),
      // current_step is the authoritative count of onboarding steps the user
      // has reached/completed by the time they confirm the plan (final step).
      steps_completed: onboardingState?.current_step ?? null,
      total_time_seconds:
        onboardingStartedAt.current > 0
          ? Math.round((Date.now() - onboardingStartedAt.current) / 1000)
          : null,
    });
    // Clean up the persisted timestamp now that the flow is complete.
    localStorage.removeItem('gg_onboarding_started_at');
    // End the Vapi session so voice doesn't bleed into /home post-onboarding.
    // endCall is sync void — try/catch only catches sync throws from the
    // preferences dispatch (extremely unlikely). We still wrap so a future
    // refactor of endCall doesn't silently break finalization.
    try {
      onboardingVoice?.endCall();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { flow: 'onboarding', step: '7-plan-review' },
        extra: { phase: 'endCall' },
      });
    }
    complete({
      habitConfigs: state.habitConfigs,
      goals: state.goals,
      category: state.category,
      reflectionConfig: state.reflectionConfig,
    });
  }, [state, complete, source, onboardingVoice, onboardingState?.current_step]);

  // Voice "let's go" mirrors the tap flow once the agent bumps current_step past 7.
  const autoCompletedRef = useRef(false);
  // Wait ~700ms after Vapi stops speaking before tearing the call down. The
  // BEGINNER-06 context tells the model to speak a send-off ("You're in,
  // [Name]…") right before firing confirm_plan; without this wait,
  // endCall() in handleStartPlan would stop() the WebRTC mid-word. Resets
  // whenever the model starts speaking again, so a brief silence between
  // tool fire and the send-off doesn't trigger premature teardown.
  const POST_SPEECH_QUIET_MS = 700;
  const isAssistantSpeaking = onboardingVoice?.isAssistantSpeaking ?? false;
  useEffect(() => {
    if (autoCompletedRef.current) return;
    if (isCompleting) return;
    if (!state?.habitConfigs || !state?.reflectionConfig) return;
    if (!onboardingState) return;
    if (onboardingState.current_step <= 7) return;
    // Don't tear down while the assistant is mid-utterance. Schedule the
    // fire on next quiet window.
    if (isAssistantSpeaking) return;
    const timer = setTimeout(() => {
      if (autoCompletedRef.current) return;
      autoCompletedRef.current = true;
      handleStartPlan();
    }, POST_SPEECH_QUIET_MS);
    return () => clearTimeout(timer);
  }, [onboardingState, state, isCompleting, handleStartPlan, isAssistantSpeaking]);
  // NOTE on the failed-complete() retry path:
  // After complete() fails, autoCompletedRef intentionally STAYS true. That
  // blocks the auto-complete effect above from re-firing on a redundant
  // Realtime push of current_step=8 (which would otherwise retry-storm against
  // a persistently-500ing backend). Voice retry is unblocked manually inside
  // handleVoiceAction: receiving confirm_plan while a completeError is present
  // clears the latch for that single attempt. Tap retry bypasses the gate
  // entirely (calls handleStartPlan directly).

  // Voice "let's go" / "start" / "looks good" — direct confirm path that
  // doesn't depend on the current_step bump above. Both paths share
  // autoCompletedRef so we don't double-fire.
  // Read-only screen — no in-flight overrides, just the persisted snapshot
  // (which by this point should include every prior screen's fields).
  const snapshot = useOnboardingFormSnapshot();

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action === 'update_habit') {
        const p = result.params as { name?: string; patch?: Partial<PlanReviewHabitConfig> };
        if (typeof p.name === 'string' && p.patch) {
          const name = p.name;
          const patch = p.patch;
          setHabitPatches((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
        }
        return;
      }
      if (result.action !== 'confirm_plan') return;
      // One-shot voice retry on prior failure: clear the single-fire latch the
      // auto-complete effect set so the rest of the gate proceeds. Does NOT
      // re-enable the auto-complete effect (Realtime hiccup → retry storm);
      // each voice "let's go" after an error is its own explicit attempt.
      if (completeError && autoCompletedRef.current) {
        autoCompletedRef.current = false;
      }
      if (autoCompletedRef.current || isCompleting) return;
      if (!state?.habitConfigs || !state?.reflectionConfig) return;
      autoCompletedRef.current = true;
      handleStartPlan();
    },
    [state, isCompleting, handleStartPlan, completeError],
  );

  if (!state?.habitConfigs || !state?.reflectionConfig) {
    // Redirect to the earliest plausibly-incomplete step instead of /onboarding —
    // bare /onboarding triggers OnboardingEntry, which re-routes based on
    // current_step (still 7), creating a ping-pong loop. step-5 and step-4 have
    // their own render guards that cascade back if their own data is missing.
    const fallbackPath = !state?.habitConfigs ? '/onboarding/step-5' : '/onboarding/step-6';
    Sentry.captureMessage(`PlanReviewPage: missing state — redirecting to ${fallbackPath}`, {
      level: 'error',
      tags: { flow: 'onboarding', step: '7-planreview' },
      extra: {
        hasRouterState: !!routerState,
        hasOnboardingData: !!onboardingState?.data,
        hasHabitConfigs: !!state?.habitConfigs,
        hasReflectionConfig: !!state?.reflectionConfig,
      },
    });
    return <Navigate to={fallbackPath} replace />;
  }

  const { habitConfigs, goals, category, reflectionConfig } = state;
  const categoryIcon = category
    ? (CATEGORY_ICONS[category] ?? 'ic:outline-check-circle')
    : 'ic:outline-check-circle';
  const reflectionDays = new Set(reflectionConfig.days);
  const reflectionMode =
    onboardingState?.data?.reflectionMode === 'freeform' ? 'freeform' : 'prompts';
  const customPrompts = Array.isArray(onboardingState?.data?.customPrompts)
    ? (onboardingState.data.customPrompts as string[]).filter(
        (p) => typeof p === 'string' && p.trim(),
      )
    : [];
  const reflectionTitle =
    reflectionMode === 'freeform'
      ? 'Freeform reflection'
      : customPrompts.length > 0
        ? 'Custom reflection'
        : 'Daily reflection';

  return (
    <OnboardingLayout
      screenId={source === 'advanced' ? 'ONBOARD-ADVANCED-05' : 'ONBOARD-BEGINNER-06'}
      formSnapshot={snapshot}
      ctaLabel="Start plan"
      onNext={handleStartPlan}
      ctaLoading={isCompleting}
      showVoiceButton
      onVoiceAction={handleVoiceAction}
      onBack={() =>
        navigate(source === 'advanced' ? '/onboarding/advanced-step-6' : '/onboarding/step-6', {
          state:
            source === 'advanced'
              ? {
                  habitConfigs: Object.entries(habitConfigs).map(([name, c]) => ({
                    name,
                    days: c.days,
                  })),
                }
              : { habitConfigs, goals, category, reflectionConfig },
        })
      }
    >
      <OnboardingHeader
        title="Your starting plan"
        subtitle="Here's what we've put together based on your goals. You can always adjust later."
      />

      <div className="flex flex-col gap-[12px]">
        {Object.entries(habitConfigs).map(([habit, config]) => (
          <PlanSummaryCard
            key={habit}
            icon={categoryIcon}
            typeLabel="Habit"
            title={habit}
            cadence={formatCadence(new Set(config.days))}
            rule={config.time ? `Reminder at ${config.time}` : 'No reminder set'}
            onEdit={() =>
              navigate(
                source === 'advanced' ? '/onboarding/advanced-results' : '/onboarding/step-5',
                {
                  state:
                    source === 'advanced'
                      ? {}
                      : { habitConfigs, goals, category, reflectionConfig, phase: 'confirming' },
                },
              )
            }
          />
        ))}

        <PlanSummaryCard
          icon="ic:outline-menu-book"
          typeLabel="Journal"
          title={reflectionTitle}
          cadence={formatCadence(reflectionDays)}
          rule={reflectionConfig.time ? `Reminder at ${reflectionConfig.time}` : 'No reminder set'}
        />
      </div>
    </OnboardingLayout>
  );
}
