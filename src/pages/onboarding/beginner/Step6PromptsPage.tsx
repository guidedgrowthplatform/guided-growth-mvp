import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { ReflectionModeEditor } from '@/components/onboarding/ReflectionModeEditor';
import {
  useOnboardingVoice,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import type { ReflectionMode } from '@gg/shared/types';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';

interface LocationState {
  habitConfigs?: Record<string, { days: number[] | Set<number>; time: string; reminder: boolean }>;
  goals?: string[];
  category?: string;
  reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule: string };
}

function deserializePrompts(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export function Step6PromptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const onboardingVoice = useOnboardingVoice();
  const state = location.state as LocationState | null;

  useAgentNavigation(6, '/onboarding/step-7');
  const trackStepComplete = useStepTiming(9, 'reflection_mode', 'beginner');

  useEffect(() => {
    if (!onboardingVoice) return;
    onboardingVoice.pushSubScreen('ONBOARD-BEGINNER-08');
    return () => onboardingVoice.pushSubScreen(null);
  }, [onboardingVoice]);

  const persisted = onboardingState?.data as Record<string, unknown> | undefined;
  const resolvedHabitConfigs =
    (persisted?.habitConfigs as LocationState['habitConfigs']) ?? state?.habitConfigs;
  const resolvedGoals = (persisted?.goals as string[] | undefined) ?? state?.goals;
  const resolvedCategory = (persisted?.category as string | undefined) ?? state?.category;
  const resolvedReflectionConfig =
    (persisted?.reflectionConfig as LocationState['reflectionConfig']) ?? state?.reflectionConfig;

  const [mode, setMode] = useState<ReflectionMode>(
    onboardingState?.data?.reflectionMode === 'freeform' ? 'freeform' : 'prompts',
  );
  const [prompts, setPrompts] = useState<string[]>(
    deserializePrompts(onboardingState?.data?.customPrompts),
  );

  useEffect(() => {
    const incoming = deserializePrompts(onboardingState?.data?.customPrompts);
    if (incoming.length > 0) {
      setPrompts((prev) => (prev.length === 0 ? incoming : prev));
      setMode('prompts');
    }
  }, [onboardingState?.data?.customPrompts]);

  const filledPrompts = prompts.filter((p) => p.trim().length > 0);
  const canSubmit = mode === 'freeform' || filledPrompts.length >= 1;

  const snapshot = useOnboardingFormSnapshot({
    customPrompts: filledPrompts.length > 0 ? filledPrompts : undefined,
  });

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action === 'set_reflection_config') {
      const p = result.params as { mode?: string };
      if (p.mode === 'freeform' || p.mode === 'prompts') setMode(p.mode);
      return;
    }
    if (result.action !== 'fill_field') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (typeof p.fieldName !== 'string' || typeof p.value !== 'string') return;
    const m = p.fieldName.match(/^customPrompts\[(\d+)\]$/);
    if (!m) return;
    const idx = parseInt(m[1], 10);
    setPrompts((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push('');
      next[idx] = p.value!;
      return next;
    });
    setMode('prompts');
  }, []);

  const handleOnNext = useCallback(async () => {
    await saveStepAsync(6, {
      reflectionMode: mode,
      customPrompts: mode === 'prompts' ? filledPrompts : undefined,
    });
    trackStepComplete();
    navigate('/onboarding/step-7', {
      state: {
        habitConfigs: resolvedHabitConfigs,
        goals: resolvedGoals,
        category: resolvedCategory,
        reflectionConfig: resolvedReflectionConfig,
      },
    });
  }, [
    saveStepAsync,
    mode,
    filledPrompts,
    trackStepComplete,
    navigate,
    resolvedHabitConfigs,
    resolvedGoals,
    resolvedCategory,
    resolvedReflectionConfig,
  ]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleOnNext);

  return (
    <OnboardingLayout
      screenId="ONBOARD-BEGINNER-08"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaDisabled={!canSubmit}
      ctaLoading={ctaLoading}
      showVoiceButton
      onVoiceAction={handleVoiceAction}
      onNext={handleNextCta}
      onBack={() =>
        navigate('/onboarding/step-6', {
          state: {
            habitConfigs: resolvedHabitConfigs,
            goals: resolvedGoals,
            category: resolvedCategory,
            reflectionConfig: resolvedReflectionConfig,
          },
        })
      }
    >
      <OnboardingHeader
        title="How do you want to reflect?"
        subtitle="Choose guided questions, create your own, or just talk freely."
      />

      <ReflectionModeEditor
        mode={mode}
        onModeChange={setMode}
        prompts={prompts}
        onPromptsChange={setPrompts}
      />
    </OnboardingLayout>
  );
}
