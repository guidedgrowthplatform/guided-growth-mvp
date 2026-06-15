import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { GoalTextarea } from '@/components/onboarding/GoalTextarea';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useParseHabits } from '@/hooks/useParseHabits';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useOnboardingAdvance } from '../shared/useOnboardingAdvance';
import { useStepTiming } from '../shared/useStepTiming';

export function AdvancedInputPage() {
  const navigate = useNavigate();
  const goNext = useOnboardingAdvance();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);

  const { parse } = useParseHabits();
  useAgentNavigation(3, '/onboarding/advanced-results');
  const trackStepComplete = useStepTiming(5, 'advanced_input', 'advanced');

  useEffect(() => {
    const incoming = onboardingState?.data?.brainDumpText;
    if (typeof incoming === 'string' && incoming !== text) {
      setText(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingState?.data?.brainDumpText]);

  const snapshot = useOnboardingFormSnapshot({
    brainDumpText: text.trim() || undefined,
  });

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action !== 'fill_field') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (p.fieldName !== 'brainDumpText' || typeof p.value !== 'string') return;
    // Append, don't overwrite — brain dump is additive.
    setText((prev) => (prev.trim() ? `${prev}\n${p.value}` : (p.value ?? '')));
  }, []);

  const handleNext = useCallback(async () => {
    if (!text.trim()) return;
    await saveStepAsync(3, { brainDumpText: text });
    track('submit_voice_goals', {
      transcript_length_chars: text.length,
    });
    trackStepComplete();
    const { habits, source } = await parse(text);
    const persistHabits = habits.map((h) => ({ name: h.name, days: h.days, time: h.time }));
    // Persist parse result so advanced-results rehydrates real LLM habits on lost router state.
    await saveStepAsync(3, {
      brainDumpText: text,
      brainDumpHabits: persistHabits,
      brainDumpParseSource: source,
    });
    void goNext(4, '/onboarding/advanced-results', {
      state: {
        text,
        habits: persistHabits,
        parseSource: source,
      },
    });
  }, [text, goNext, saveStepAsync, trackStepComplete, parse]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleNext);

  return (
    <OnboardingLayout
      screenId="ONBOARD-ADVANCED"
      step={3}
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaVariant="inline"
      onBack={() => navigate('/onboarding/step-2')}
      onNext={handleNextCta}
      ctaDisabled={!text.trim()}
      ctaLoading={ctaLoading}
      showVoiceButton
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Tell me what you want to achieve"
        subtitle="You can say or type as much as you want. We'll organize it for you."
      />
      <div className="flex flex-col items-center gap-[24px] py-[16px]">
        <GoalTextarea value={text} onChange={setText} textareaRef={textareaRef} />
      </div>
    </OnboardingLayout>
  );
}
