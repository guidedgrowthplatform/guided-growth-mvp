import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
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

  useEffect(() => {
    if (onboardingState?.data) {
      if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
      if (onboardingState.data.age) setAge(onboardingState.data.age as number);
      // Support legacy ageRange data
      if (onboardingState.data.ageRange && !onboardingState.data.age) setAge('');
      if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
      if (onboardingState.data.referralSource)
        setReferralSource(onboardingState.data.referralSource as string);
      if (onboardingState.data.referralOtherText)
        setReferralOtherText(onboardingState.data.referralOtherText as string);
    }
  }, [onboardingState?.data]);

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

  // Track whether voice just filled fields — triggers auto-advance check
  const voiceFilledRef = useRef(false);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params) {
      const {
        nickname: voiceNickname,
        age: voiceAge,
        ageRange: voiceAgeRange,
        gender: voiceGender,
        referralSource: voiceReferral,
      } = result.params;

      if (typeof voiceNickname === 'string') {
        setNickname(voiceNickname);
      }
      if (typeof voiceAge === 'number') {
        setAge(voiceAge);
      } else if (typeof voiceAge === 'string') {
        const parsed = parseInt(voiceAge, 10);
        if (!isNaN(parsed)) setAge(parsed);
      } else if (typeof voiceAgeRange === 'string') {
        // Legacy voice support — leave age for user to fill
        setAge('');
      }
      if (typeof voiceGender === 'string') {
        setGender(voiceGender);
      }
      if (typeof voiceReferral === 'string') {
        setReferralSource(voiceReferral);
      }

      // Mark that voice just filled fields — auto-advance effect will check
      voiceFilledRef.current = true;
    }
  }, []);

  // Auto-advance when voice fills all required fields
  useEffect(() => {
    if (!voiceFilledRef.current) return;
    voiceFilledRef.current = false;

    if (nickname.trim() && age && gender && referralSource) {
      // All fields filled by voice — auto-advance after a short delay
      const timer = setTimeout(() => {
        handleNext();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [nickname, age, gender, referralSource, handleNext]);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age || !gender || !referralSource}
      showVoiceButton
      onTranscript={(text) => setNickname(text)}
      voiceOptions={[...GENDER_OPTIONS, ...REFERRAL_OPTIONS, 'name', 'nickname']}
      voiceFileId="onboarding_welcome"
      voicePrompt="Hey — welcome. Before we build anything, I just want to get to know you a little. What should I call you, how old are you, and how did you hear about us? You can just say it or type it in."
      onVoiceAction={handleVoiceAction}
      showTooltip
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
