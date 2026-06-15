import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';
import { pathToSpec } from './pathToSpec';
import { useCtaLoading } from './useCtaLoading';
import { useStepTiming } from './useStepTiming';

export function Step2Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [plan, setPlan] = useState<'simple' | 'braindump' | null>(null);
  const trackStepComplete = useStepTiming(4, 'onboarding_path', pathToSpec(plan));
  // Once the user explicitly picks, their choice owns the radio — a later coach
  // write must not snap it out from under them.
  const userTouchedRef = useRef(false);

  useEffect(() => {
    if (userTouchedRef.current) return;
    if (onboardingState?.path) {
      setPlan(onboardingState.path as 'simple' | 'braindump');
    }
  }, [onboardingState?.path]);

  // Tap or voice pick: own the radio + prime the cache so the coach opener
  // reflects it. The authoritative save happens on Continue.
  const applyPathChoice = useCallback(
    (value: 'simple' | 'braindump') => {
      userTouchedRef.current = true;
      setPlan(value);
      qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
        prev ? { ...prev, path: value } : prev,
      );
    },
    [qc],
  );

  // null defers navigation until path is set so we route to the right fork.
  useAgentNavigation(
    2,
    plan === 'braindump'
      ? '/onboarding/advanced-input'
      : plan === 'simple'
        ? '/onboarding/step-3'
        : null,
  );

  const snapshot = useOnboardingFormSnapshot({ path: plan ?? undefined });

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action !== 'set_path') return;
      const params = result.params as { value?: string };
      if (params.value === 'simple' || params.value === 'braindump') {
        applyPathChoice(params.value);
      }
    },
    [applyPathChoice],
  );

  const handleNext = useCallback(async () => {
    if (!plan) return;
    await saveStepAsync(2, {}, { path: plan as 'simple' | 'braindump' });
    track('select_onboarding_path', {
      path: pathToSpec(plan),
    });
    trackStepComplete();
    if (plan === 'braindump') {
      navigate('/onboarding/advanced-input');
    } else {
      navigate('/onboarding/step-3');
    }
  }, [plan, navigate, saveStepAsync, trackStepComplete]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleNext);

  return (
    <OnboardingLayout
      screenId="ONBOARD-FORK--FORM"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaVariant="inline"
      ctaDisabled={!plan}
      ctaLoading={ctaLoading}
      showVoiceButton
      onNext={handleNextCta}
      onBack={() => navigate('/onboarding/step-1')}
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Let's build your plan."
        subtitle="How much experience do you have with habit tracking?"
      />
      <div className="flex flex-col gap-[20px]">
        <SelectionCard
          title="I'm new to habit tracking"
          description="I'll help you step by step"
          selected={plan === 'simple'}
          onSelect={() => applyPathChoice('simple')}
        />
        <SelectionCard
          title="I already have experience with habit tracking"
          description="Tell me your habits and I'll organize them"
          selected={plan === 'braindump'}
          onSelect={() => applyPathChoice('braindump')}
        />
      </div>
    </OnboardingLayout>
  );
}
