import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useStepTiming } from './useStepTiming';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

export function Step1Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStep } = useOnboarding();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [referralOtherText, setReferralOtherText] = useState('');

  useAgentNavigation(1, '/onboarding/step-2');
  const trackStepComplete = useStepTiming(3, 'profile_setup', null);

  const hasHydratedRef = useRef(false);

  useEffect(() => {
    hasHydratedRef.current = true;

    if (!onboardingState?.data) return;

    if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
    if (onboardingState.data.age) setAge(onboardingState.data.age as number);
    // Support legacy ageRange data
    if (onboardingState.data.ageRange && !onboardingState.data.age) setAge('');
    if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
    const storedReferral = onboardingState.data.referralSource as string | undefined;
    if (storedReferral) {
      if (storedReferral.startsWith('Other: ')) {
        setReferralSource('Other');
        setReferralOtherText(storedReferral.slice('Other: '.length));
      } else if (REFERRAL_OPTIONS.includes(storedReferral)) {
        setReferralSource(storedReferral);
      } else {
        setReferralSource('Other');
        setReferralOtherText(storedReferral);
      }
    }
    if (onboardingState.data.referralOtherText)
      setReferralOtherText(onboardingState.data.referralOtherText as string);
  }, [onboardingState?.data]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action === 'fill_field') {
      const params = result.params as { fieldName?: string; value?: string | number };
      // GPT-4o-mini occasionally returns `value` as a number despite the
      // prompt asking for a string (e.g. age=26). Coerce defensively.
      const raw = params.value;
      if (raw === undefined || raw === null) return;
      const asString = typeof raw === 'number' ? String(raw) : raw;
      if (typeof asString !== 'string') return;
      if (params.fieldName === 'nickname') setNickname(asString);
      else if (params.fieldName === 'age') {
        const n = typeof raw === 'number' ? raw : parseInt(asString, 10);
        if (!isNaN(n) && n >= 13 && n <= 120) setAge(n);
      } else if (params.fieldName === 'referralOtherText') setReferralOtherText(asString);
      return;
    }
    if (result.action === 'select_option') {
      const params = result.params as { fieldName?: string; value?: string };
      if (typeof params.value !== 'string') return;
      if (params.fieldName === 'gender' && GENDER_OPTIONS.includes(params.value)) {
        setGender(params.value);
      } else if (params.fieldName === 'referralSource' && REFERRAL_OPTIONS.includes(params.value)) {
        setReferralSource(params.value);
      }
    }
  }, []);

  const handleNext = useCallback(() => {
    if (!nickname.trim() || !age || !gender || !referralSource) return;
    const effectiveReferral =
      referralSource === 'Other' && referralOtherText.trim()
        ? `Other: ${referralOtherText.trim()}`
        : referralSource;
    saveStep(1, {
      nickname,
      age,
      gender,
      referralSource: effectiveReferral,
      referralOtherText,
    });
    trackStepComplete();
    navigate('/onboarding/step-2');
  }, [
    nickname,
    age,
    gender,
    referralSource,
    referralOtherText,
    navigate,
    saveStep,
    trackStepComplete,
  ]);

  const formSnapshot = useOnboardingFormSnapshot({
    nickname: nickname.trim() || undefined,
    age: age === '' ? undefined : age,
    gender: gender ?? undefined,
    referralSource: referralSource ?? undefined,
    referralOtherText: referralOtherText.trim() || undefined,
  });

  return (
    <OnboardingLayout
      currentStep={1}
      screenId="ONBOARD-01--FORM"
      formSnapshot={formSnapshot}
      ctaLabel="Continue"
      onBack={() => navigate('/onboarding/mic-permission')}
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age || !gender || !referralSource}
      showVoiceButton
      showTooltip
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Let's get to know you."
        subtitle="Tell us a bit about yourself to personalize your journey."
      />
      <OnboardingSection label="What should I call you?">
        <OnboardingInput
          icon="ic:round-person-outline"
          placeholder="Enter your nickname"
          value={nickname}
          onChange={setNickname}
        />
      </OnboardingSection>
      <OnboardingSection label="How old are you?">
        <AgeScrollPicker value={age} onChange={setAge} />
      </OnboardingSection>
      <OnboardingSection label="How do you identify?">
        <ChipSelect
          options={GENDER_OPTIONS}
          value={gender}
          onChange={setGender}
          columns={3}
          ariaLabel="How do you identify?"
        />
      </OnboardingSection>
      <OnboardingSection label="How did you hear about us?">
        <ChipSelect
          options={REFERRAL_OPTIONS}
          value={referralSource}
          onChange={setReferralSource}
          columns={3}
          ariaLabel="How did you hear about us?"
        />
        {referralSource === 'Other' && (
          <div className="mt-3">
            <OnboardingInput
              icon="ic:round-edit"
              placeholder="Please specify..."
              value={referralOtherText}
              onChange={setReferralOtherText}
            />
          </div>
        )}
      </OnboardingSection>
    </OnboardingLayout>
  );
}
