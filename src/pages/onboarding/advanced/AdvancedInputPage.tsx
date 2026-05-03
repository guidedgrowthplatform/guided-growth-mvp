import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { GoalTextarea } from '@/components/onboarding/GoalTextarea';
import { GuidanceBadge } from '@/components/onboarding/GuidanceBadge';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { markOnboardingStepStart, trackOnboardingStepComplete } from '@/lib/onboardingAnalytics';

export function AdvancedInputPage() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);

  useOnboardingAgent('onboard_advanced_input');
  useAgentNavigation(3, '/onboarding/advanced-results');
  useEffect(() => {
    markOnboardingStepStart('voice_goals');
  }, []);

  useEffect(() => {
    const incoming = onboardingState?.data?.brainDumpText;
    if (typeof incoming === 'string' && incoming !== text) {
      setText(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingState?.data?.brainDumpText]);

  const handleNext = useCallback(async () => {
    track('submit_voice_goals', {
      transcript_length_chars: text.trim().length,
      duration_seconds: textareaRef.current
        ? Math.round(
            (Date.now() -
              Number.parseInt(
                window.sessionStorage.getItem('gg_onboarding_step_started_at:voice_goals') ?? '',
                10,
              )) /
              1000,
          ) || undefined
        : undefined,
    });
    trackOnboardingStepComplete({
      stepKey: 'voice_goals',
      stepNumber: 3,
      stepName: 'voice_goals',
      onboardingPath: 'advanced',
    });
    await saveStepAsync(3, { brainDumpText: text });
    navigate('/onboarding/advanced-results', { state: { text } });
  }, [text, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={3}
      totalSteps={6}
      ctaLabel="Continue"
      onBack={() => navigate('/onboarding/step-2')}
      onNext={handleNext}
      ctaDisabled={!text.trim()}
      showVoiceButton
    >
      <OnboardingHeader
        title="Tell me what you want to achieve"
        subtitle="You can say or type as much as you want. We'll organize it for you."
      />
      <div className="flex flex-col items-center gap-[24px] py-[16px]">
        <GuidanceBadge text='TRY: "I WOULD LIKE TO READ FOR 15 MINS EVERY NIGHT AT 8 PM"' />
        <GoalTextarea value={text} onChange={setText} textareaRef={textareaRef} />
      </div>
    </OnboardingLayout>
  );
}
