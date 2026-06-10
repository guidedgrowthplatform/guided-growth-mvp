import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { track } from '@/analytics/posthog';
import { HabitCustomizeSheet, type HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  useOnboardingVoice,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';
import { deriveHabitVoiceUpdate } from './deriveHabitVoiceUpdate';

// Bottom-sheet overlay screen_ids per master sheet. -04 fires when the user
// is configuring their 1st picked habit, -05 when they advance to the 2nd.
// Both share the same UI (HabitCustomizeSheet); the LLM gets a different
// context block per-iteration.
const SHEET_SCREEN_IDS = ['ONBOARD-BEGINNER-04', 'ONBOARD-BEGINNER-05'] as const;

export function Step5Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const onboardingVoice = useOnboardingVoice();
  const { logEvent } = useSessionLog();
  const state = location.state as {
    goals?: string[];
    category?: string;
    habitConfigs?: Record<
      string,
      { days: number[] | Set<number>; time: string; reminder: boolean; schedule?: string }
    >;
    phase?: 'confirming';
    reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string };
  } | null;
  // Voice auto-nav arrives with no location.state; the manual Continue
  // button passes it. Persisted onboarding state is the reliable source
  // for goals + category (both written by their submit_* tools), so prefer
  // it and treat location.state as a fast-path hint.
  const persistedGoals = onboardingState?.data?.goals as string[] | undefined;
  const persistedCategory = onboardingState?.data?.category as string | undefined;
  const goals = useMemo(
    () =>
      persistedGoals?.length
        ? persistedGoals
        : state?.goals?.length
          ? state.goals
          : ['Fall asleep earlier'],
    [persistedGoals, state],
  );
  const resolvedCategory = persistedCategory ?? state?.category;

  useAgentNavigation(5, '/onboarding/step-6');
  const trackStepComplete = useStepTiming(7, 'configure_habit', 'beginner');

  // Reconstitute Sets from arrays after router state serialization
  const incomingConfigs: Record<string, HabitConfig> | undefined = state?.habitConfigs
    ? Object.fromEntries(
        Object.entries(state.habitConfigs).map(([k, v]) => [
          k,
          {
            ...v,
            days: v.days instanceof Set ? v.days : new Set(v.days),
            schedule: (v.schedule ?? 'Weekday') as HabitConfig['schedule'],
          },
        ]),
      )
    : undefined;

  const [customHabits, setCustomHabits] = useState<Record<string, string[]>>({});
  const [expandedGoal, setExpandedGoal] = useState<string>(goals[0]);
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(() =>
    incomingConfigs ? new Set(Object.keys(incomingConfigs)) : new Set(),
  );
  const [habitConfigs, setHabitConfigs] = useState<Record<string, HabitConfig>>(
    () => incomingConfigs ?? {},
  );
  const [customizingHabit, setCustomizingHabit] = useState<string | null>(null);
  const [habitQueue, setHabitQueue] = useState<string[]>([]);
  const [phase, setPhase] = useState<'selecting' | 'confirming'>(
    state?.phase === 'confirming' && incomingConfigs ? 'confirming' : 'selecting',
  );

  useEffect(() => {
    if (onboardingState?.data?.habitConfigs) {
      const savedConfigs = onboardingState.data.habitConfigs as Record<
        string,
        { days: number[] | Set<number>; time: string; reminder: boolean }
      >;
      const reconstituted: Record<string, HabitConfig> = Object.fromEntries(
        Object.entries(savedConfigs).map(([k, v]) => [
          k,
          {
            ...v,
            days: v.days instanceof Set ? v.days : new Set(v.days),
            schedule: ((v as { schedule?: string }).schedule ??
              'Weekday') as HabitConfig['schedule'],
          },
        ]),
      );
      setHabitConfigs(reconstituted);
      setSelectedHabits(new Set(Object.keys(reconstituted)));
      setPhase('confirming');
    }
  }, [onboardingState?.data?.habitConfigs]);

  // /step-5 hosts three distinct LLM surfaces under one route:
  //   - selecting phase, no sheet  -> BEGINNER-03 (handled by route-driven push)
  //   - sheet open (1st habit)     -> BEGINNER-04
  //   - sheet open (2nd habit)     -> BEGINNER-05
  //   - confirming phase, no sheet -> BEGINNER-06 (Review Habits)
  // Pass `null` to revert to the route-derived screen.
  useEffect(() => {
    if (!onboardingVoice) return;
    if (customizingHabit !== null) {
      const idx = habitQueue.indexOf(customizingHabit);
      const screenId = SHEET_SCREEN_IDS[idx] ?? SHEET_SCREEN_IDS[0];
      onboardingVoice.pushSubScreen(screenId);
      return;
    }
    if (phase === 'confirming') {
      onboardingVoice.pushSubScreen('ONBOARD-BEGINNER-06');
      return;
    }
    onboardingVoice.pushSubScreen(null);
  }, [customizingHabit, habitQueue, phase, onboardingVoice]);

  function toggleHabit(habit: string) {
    if (selectedHabits.has(habit)) {
      const next = new Set(selectedHabits);
      next.delete(habit);
      setSelectedHabits(next);
      setHabitConfigs((c) => {
        const updated = { ...c };
        delete updated[habit];
        return updated;
      });
      return;
    }
    if (selectedHabits.size >= MAX_HABITS_ONBOARDING) return;
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);
  }

  // input_method: 'voice' when called from handleVoiceAction (Vapi tool
  // event), 'manual' when called from HabitPickerPanel's tap CTA. Spec
  // packet (ONBOARD-BEGINNER-03) promises a `create_habit` PostHog
  // event + `habit_added` session_log event for both surfaces; before
  // this fix neither was firing for custom adds.
  function addCustomHabit(
    goal: string,
    habit: string,
    input_method: 'voice' | 'manual' = 'manual',
  ) {
    if (selectedHabits.size >= MAX_HABITS_ONBOARDING) return;
    if (selectedHabits.has(habit)) return;
    setCustomHabits((prev) => ({
      ...prev,
      [goal]: [...(prev[goal] ?? []), habit],
    }));
    const next = new Set(selectedHabits);
    next.add(habit);
    setSelectedHabits(next);

    // PostHog: spec-canonical event name from app-posthog-events. `source:
    // 'onboarding'` per the doc's enum. input_method overrides the
    // analytics provider's auto-attach so we don't race the
    // InputMethodContext decay window during a voice turn.
    track('create_habit', {
      habit_name: habit,
      source: 'onboarding',
      input_method,
      is_suggested: false,
    });
    // session_log: past-tense per app-session-events convention. No
    // habit_id yet — the row isn't persisted until step-7 save. LLM
    // state-delta consumers only need the name + the screen here.
    logEvent('habit_added', { name: habit, source: 'onboarding_custom' }, 'ONBOARD-BEGINNER-03');
  }

  // Serialize habitConfigs' Set<number> days into number[] for the snapshot,
  // matching the persisted onboarding_states.data shape.
  const snapshotHabitConfigs = useMemo(() => {
    const entries = Object.entries(habitConfigs);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries.map(([k, v]) => [k, { ...v, days: Array.from(v.days) }]));
  }, [habitConfigs]);

  const snapshot = useOnboardingFormSnapshot({
    habitConfigs: snapshotHabitConfigs,
    goals,
    category: resolvedCategory,
  });

  const handleContinue = useCallback(() => {
    const queue = [...selectedHabits];
    setHabitQueue(queue);
    setCustomizingHabit(queue[0]);
  }, [selectedHabits]);

  // Voice handler. Behavior depends on the current screen sub-phase:
  // - selecting / customize sheet: select_option / add_habit toggles a habit
  //   into the picker; remove_habit toggles it back out.
  // - confirming: update_habit patches an existing config; remove_habit
  //   drops it. Configure-via-voice during the bottom sheet itself is a
  //   follow-up; for now sheet edits still happen by tap.
  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action === 'select_option' || result.action === 'add_habit') {
        // Route through the pure helper so the predefined-vs-custom
        // decision is testable in isolation. Custom names land in the
        // currently-expanded goal section so the picker actually
        // renders the new chip (regression #161: previously only
        // selectedHabits got the entry; the picker had nothing to
        // show and the user saw nothing happen).
        const update = deriveHabitVoiceUpdate(
          {
            goals,
            habitsByGoal,
            selectedHabits,
            customHabits,
            expandedGoal,
          },
          result,
        );
        if (update.kind === 'toggle') {
          // Auto-expand the goal that owns this row so the state
          // change is visible even when the user voiced a habit
          // under a collapsed/other section (Edge 1 from review).
          if (update.goal !== expandedGoal) setExpandedGoal(update.goal);
          toggleHabit(update.name);
        } else if (update.kind === 'addCustom') {
          addCustomHabit(update.goal, update.name, 'voice');
        }
        return;
      }
      if (result.action === 'remove_habit') {
        const p = result.params as { name?: string };
        if (typeof p.name !== 'string') return;
        const name = p.name.trim();
        if (!name) return;
        if (selectedHabits.has(name)) toggleHabit(name);
        return;
      }
      if (result.action === 'update_habit') {
        const p = result.params as { name?: string; patch?: Partial<HabitConfig> };
        if (typeof p.name !== 'string' || !p.patch) return;
        const name = p.name.trim();
        setHabitConfigs((prev) => {
          if (!prev[name]) return prev;
          const patched: HabitConfig = { ...prev[name], ...p.patch };
          // If the patch supplied days as an array, rebuild the Set.
          if (Array.isArray(p.patch?.days)) {
            patched.days = new Set(p.patch.days as number[]);
          }
          return { ...prev, [name]: patched };
        });
      }
    },
    // toggleHabit / addCustomHabit close over state via setState
    // callbacks; we only need to re-derive when the inputs the
    // helper reads change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHabits, customHabits, expandedGoal, goals],
  );

  function handleSheetClose() {
    setCustomizingHabit(null);
    setHabitQueue([]);
  }

  function handleSheetNext(config: HabitConfig) {
    if (!customizingHabit) return;

    const currentIdx = habitQueue.indexOf(customizingHabit);
    const nextIdx = currentIdx + 1;

    setHabitConfigs((prev) => ({ ...prev, [customizingHabit]: config }));

    if (nextIdx < habitQueue.length) {
      setCustomizingHabit(habitQueue[nextIdx]);
    } else {
      setCustomizingHabit(null);
      setHabitQueue([]);
      setPhase('confirming');
    }
  }

  function handleEditHabit(habit: string) {
    setHabitQueue([habit]);
    setCustomizingHabit(habit);
  }

  const isLastHabit = customizingHabit
    ? habitQueue.indexOf(customizingHabit) === habitQueue.length - 1
    : true;

  const handleOnNext = useCallback(async () => {
    if (phase === 'confirming') {
      const serializedConfigs = Object.fromEntries(
        Object.entries(habitConfigs).map(([k, v]) => [k, { ...v, days: [...v.days] }]),
      );
      await saveStepAsync(5, { habitConfigs: serializedConfigs });
      trackStepComplete();
      navigate('/onboarding/step-6', {
        state: {
          habitConfigs: serializedConfigs,
          goals,
          category: resolvedCategory,
          reflectionConfig: state?.reflectionConfig,
        },
      });
    } else {
      handleContinue();
    }
  }, [
    phase,
    habitConfigs,
    goals,
    resolvedCategory,
    state,
    navigate,
    handleContinue,
    saveStepAsync,
    trackStepComplete,
  ]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleOnNext);

  return (
    <>
      <OnboardingLayout
        screenId="ONBOARD-BEGINNER-03"
        formSnapshot={snapshot}
        ctaLabel="Continue"
        ctaVariant="inline"
        onNext={handleNextCta}
        onBack={
          phase === 'confirming'
            ? () => setPhase('selecting')
            : () => navigate('/onboarding/step-4')
        }
        ctaDisabled={phase === 'selecting' && selectedHabits.size === 0}
        ctaLoading={ctaLoading}
        showVoiceButton
        aiListeningPrompt='"Select up to 2 daily habits to build your foundation."'
        onVoiceAction={handleVoiceAction}
      >
        <OnboardingHeader
          title="Here's a good place to start"
          subtitle="Select up to 2 daily habits to build your foundation."
        />

        {phase === 'selecting' ? (
          <div className="flex flex-col gap-[16px]">
            {goals.map((goal) => (
              <HabitPickerPanel
                key={goal}
                goal={goal}
                habits={[...(habitsByGoal[goal] ?? []), ...(customHabits[goal] ?? [])]}
                expanded={expandedGoal === goal}
                onToggleExpanded={() => setExpandedGoal((prev) => (prev === goal ? '' : goal))}
                selectedHabits={selectedHabits}
                maxReached={selectedHabits.size >= MAX_HABITS_ONBOARDING}
                onToggleHabit={toggleHabit}
                onAddCustomHabit={(habit) => addCustomHabit(goal, habit, 'manual')}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[16px]">
            {Object.entries(habitConfigs).map(([habit, config]) => (
              <HabitSummaryCard
                key={habit}
                habitName={habit}
                selectedDays={config.days}
                onEdit={() => handleEditHabit(habit)}
              />
            ))}
            <OnboardingTooltip
              title="Quick tip"
              message="You can use the edit function to change the results of the habits you want to have!"
            />
          </div>
        )}
      </OnboardingLayout>

      {customizingHabit && (
        <BottomSheet onClose={handleSheetClose}>
          <HabitCustomizeSheet
            key={customizingHabit}
            habitName={customizingHabit}
            onClose={handleSheetClose}
            onNext={handleSheetNext}
            isLastHabit={isLastHabit}
          />
        </BottomSheet>
      )}
    </>
  );
}
