import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoalTextarea } from '@/components/onboarding/GoalTextarea';
import { GuidanceBadge } from '@/components/onboarding/GuidanceBadge';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';

export function AdvancedInputPage() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);

  useOnboardingAgent('onboard_advanced_input');
  useAgentNavigation(3, '/onboarding/advanced-results');

  useEffect(() => {
    const incoming = onboardingState?.data?.brainDumpText;
    if (typeof incoming === 'string' && incoming !== text) {
      setText(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingState?.data?.brainDumpText]);

  const handleNext = useCallback(async () => {
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
