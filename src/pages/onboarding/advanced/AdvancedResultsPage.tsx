import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { HabitSummaryCard } from '@/components/onboarding/HabitSummaryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';

interface HabitItem {
  name: string;
  days: Set<number>;
  selected: boolean;
}

interface UpdatedHabit {
  index: number;
  name: string;
  days: number[];
}

interface ResultsLocationState {
  updatedHabit?: UpdatedHabit;
  deletedIndex?: number;
  text?: string;
  habits?: Array<{ name: string; days?: number[] }>;
  parseSource?: 'llm' | 'regex_fallback';
}

// NEVER invent habits. On lost router state (reload/deep-link) rehydrate the
// real persisted LLM parse — never regex-reparse the brain dump, which fabricated
// habits the user never entered (Mint, 2026-04-09).
interface PersistedParse {
  habits?: Array<{ name: string; days?: number[] }> | null;
  source?: 'llm' | 'regex_fallback' | null;
}

function buildInitialHabits(
  state: ResultsLocationState | null,
  persisted: PersistedParse,
): HabitItem[] {
  // Router state wins (happy path); habits present (even empty) = parsed upstream.
  const source = state?.habits ?? persisted.habits ?? null;
  if (!source) return [];
  return source.map((h) => ({
    name: h.name,
    days: new Set(h.days ?? WEEKDAYS),
    selected: true,
  }));
}

function applyLocationState(base: HabitItem[], state: ResultsLocationState | null): HabitItem[] {
  if (!state) return base;
  let result = base;
  if (state.updatedHabit) {
    const { index, name, days } = state.updatedHabit;
    result = result.map((h, i) => (i === index ? { ...h, name, days: new Set(days) } : h));
  }
  if (state.deletedIndex !== undefined) {
    result = result.filter((_, i) => i !== state.deletedIndex);
  }
  return result;
}

export function AdvancedResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const locationState = location.state as ResultsLocationState | null;
  const clearedRef = useRef(false);

  useAgentNavigation(4, '/onboarding/advanced-step-6');
  const trackStepComplete = useStepTiming(6, 'ai_organized_plan_review', 'advanced');

  const fallbackBrainDump = onboardingState?.data?.brainDumpText ?? '';
  const persistedHabits = onboardingState?.data?.brainDumpHabits ?? null;
  const persistedSource = onboardingState?.data?.brainDumpParseSource ?? null;

  const baseHabits = useMemo(
    () => buildInitialHabits(locationState, { habits: persistedHabits, source: persistedSource }),
    [locationState, persistedHabits, persistedSource],
  );
  const habits = useMemo(
    () => applyLocationState(baseHabits, locationState),
    [baseHabits, locationState],
  );

  useEffect(() => {
    if (locationState && !clearedRef.current) {
      clearedRef.current = true;
      window.history.replaceState({}, '');
    }
  }, [locationState]);

  // Fire view_ai_organized_plan once habits are loaded
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (hasTrackedView.current || habits.length === 0) return;
    hasTrackedView.current = true;
    track('view_ai_organized_plan', {
      habits_generated_count: habits.length,
      parse_source: locationState?.parseSource ?? persistedSource ?? 'unknown',
    });
  }, [habits.length, locationState?.parseSource, persistedSource]);

  // Snapshot mirrors the shape persisted in onboarding_states.data — each
  // habit name maps to {days[], time, reminder}, defaulting time and reminder
  // since AI-generated habits don't carry per-habit time yet.
  const snapshotHabitConfigs = useMemo(() => {
    if (habits.length === 0) return undefined;
    return Object.fromEntries(
      habits.map((h) => [h.name, { days: Array.from(h.days), time: '21:45', reminder: true }]),
    );
  }, [habits]);
  const snapshot = useOnboardingFormSnapshot({
    habitConfigs: snapshotHabitConfigs,
    brainDumpText: fallbackBrainDump.trim() || undefined,
  });

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action === 'remove_habit') {
        const p = result.params as { name?: string };
        if (typeof p.name !== 'string') return;
        const name = p.name.trim().toLowerCase();
        const idx = habits.findIndex((h) => h.name.toLowerCase() === name);
        if (idx === -1) return;
        navigate('/onboarding/advanced-results', {
          replace: true,
          state: { ...locationState, deletedIndex: idx },
        });
        return;
      }
      if (result.action === 'update_habit') {
        const p = result.params as { name?: string; patch?: { days?: number[]; time?: string } };
        if (typeof p.name !== 'string' || !p.patch) return;
        const name = p.name.trim().toLowerCase();
        const idx = habits.findIndex((h) => h.name.toLowerCase() === name);
        if (idx === -1) return;
        navigate('/onboarding/edit-habit', {
          state: {
            habitIndex: idx,
            habitName: habits[idx].name,
            days: Array.isArray(p.patch.days) ? p.patch.days : Array.from(habits[idx].days),
            time: typeof p.patch.time === 'string' ? p.patch.time : '21:45',
          },
        });
      }
    },
    [habits, locationState, navigate],
  );

  const handleConfirm = useCallback(async () => {
    const habitConfigsArray = habits.map((h) => ({
      name: h.name,
      days: [...h.days],
    }));
    const goals = habits.map((h) => h.name);
    const habitConfigsRecord: Record<string, { days: number[]; time: string; reminder: boolean }> =
      {};
    habitConfigsArray.forEach((h) => {
      habitConfigsRecord[h.name] = { days: h.days, time: '21:45', reminder: true };
    });
    await saveStepAsync(4, { goals, habitConfigs: habitConfigsRecord });
    trackStepComplete();
    navigate('/onboarding/advanced-step-6', { state: { habitConfigs: habitConfigsArray } });
  }, [habits, navigate, saveStepAsync, trackStepComplete]);

  const { loading: ctaLoading, run: handleConfirmCta } = useCtaLoading(handleConfirm);

  if (habits.length === 0) {
    return (
      <OnboardingLayout
        screenId="ONBOARD-ADVANCED-02"
        formSnapshot={snapshot}
        ctaLabel="Looks Good!"
        onBack={() => navigate('/onboarding/advanced-input')}
        onNext={() => navigate('/onboarding/advanced-input')}
        showVoiceButton
        onVoiceAction={handleVoiceAction}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Icon icon="ic:outline-info" width={40} height={40} className="text-primary" />
          <h2 className="text-xl font-bold text-content">Tell me a bit more</h2>
          <p className="max-w-[280px] text-content-secondary">
            I didn&apos;t quite catch anything specific to turn into habits. Could you share what
            you want to work on — like &quot;sleep earlier&quot; or &quot;exercise three times a
            week&quot;?
          </p>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      screenId="ONBOARD-ADVANCED-02"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      onBack={() => navigate('/onboarding/advanced-input')}
      onNext={handleConfirmCta}
      ctaLoading={ctaLoading}
      onVoiceAction={handleVoiceAction}
      showVoiceButton
      hideOpenChat
    >
      <OnboardingHeader
        title="We organized this for you"
        subtitle="Here is the cleanest place to start based on what you shared."
      />
      <div className="flex flex-col gap-[16px]">
        {habits.map((habit, i) => (
          <HabitSummaryCard
            key={i}
            habitName={habit.name}
            selectedDays={habit.days}
            onEdit={() =>
              navigate('/onboarding/edit-habit', {
                state: {
                  habitIndex: i,
                  habitName: habit.name,
                  days: Array.from(habit.days),
                  time: '21:45',
                },
              })
            }
            showEditIcon
          />
        ))}
        <div className="rounded-[16px] bg-surface-secondary px-[20px] py-[18px]">
          <p className="text-[15px] font-medium leading-[22px] text-content-tertiary">
            Tap Edit to change the schedule for any habit.
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
