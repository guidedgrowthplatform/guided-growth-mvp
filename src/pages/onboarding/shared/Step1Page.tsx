import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

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

  useOnboardingAgent('onboard_01');

  useAgentNavigation(1, '/onboarding/step-2');

  const hasHydratedRef = useRef(false);

  useEffect(() => {
    hasHydratedRef.current = true;

    if (!onboardingState?.data) return;

    if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
    if (onboardingState.data.age) setAge(onboardingState.data.age as number);
    // Support legacy ageRange data
    if (onboardingState.data.ageRange && !onboardingState.data.age) setAge('');
    if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
    if (onboardingState.data.referralSource)
      setReferralSource(onboardingState.data.referralSource as string);
    if (onboardingState.data.referralOtherText)
      setReferralOtherText(onboardingState.data.referralOtherText as string);
  }, [onboardingState?.data]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action !== 'fill_field') return;
    const params = result.params as { fieldName?: string; value?: string };
    if (typeof params.value !== 'string') return;
    if (params.fieldName === 'nickname') setNickname(params.value);
  }, []);

  const handleNext = useCallback(() => {
    const effectiveReferral =
      referralSource === 'Other' && referralOtherText.trim()
        ? `Other: ${referralOtherText.trim()}`
        : referralSource;
    saveStep(1, {
      nickname,
      age: age === '' ? undefined : age,
      gender,
      referralSource: effectiveReferral,
      referralOtherText,
    });
    navigate('/onboarding/step-2');
  }, [nickname, age, gender, referralSource, referralOtherText, navigate, saveStep]);

  return (
    <OnboardingLayout
      currentStep={1}
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
          voiceField="nickname"
        />
      </OnboardingSection>
      <OnboardingSection label="How old are you?">
        <div className="relative w-full rounded-[16px] bg-surface px-[22px] py-[14px] shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
          <input
            type="number"
            min={13}
            max={120}
            value={age}
            placeholder="Enter your age"
            onChange={(e) => {
              if (e.target.value === '') {
                setAge('');
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) setAge(val);
            }}
            className="w-full bg-transparent text-[18px] text-content outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Your age"
          />
        </div>
      </OnboardingSection>
      <OnboardingSection label="How do you identify?">
        <ChipSelect options={GENDER_OPTIONS} value={gender} onChange={setGender} columns={3} />
      </OnboardingSection>
      <OnboardingSection label="How did you hear about us?">
        <ChipSelect
          options={REFERRAL_OPTIONS}
          value={referralSource}
          onChange={setReferralSource}
          columns={3}
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
