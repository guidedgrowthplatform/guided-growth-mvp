import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const AGE_OPTIONS = [
  '14 or under',
  '15 - 20',
  '21 - 25',
  '26 - 30',
  '31 - 35',
  '36 - 40',
  '41 - 45',
  '46 - 50',
  '51 - 55',
  '56 - 60',
  '61 - 65',
  '66 - 70',
  '>70',
];

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export function Step1Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStep } = useOnboarding();
  const [nickname, setNickname] = useState('');
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  useEffect(() => {
    if (onboardingState?.data) {
      if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
      if (onboardingState.data.ageRange) setAgeRange(onboardingState.data.ageRange as string);
      if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
    }
  }, [onboardingState?.data]);

  const handleNext = useCallback(() => {
    saveStep(1, { nickname, ageRange, gender });
    navigate('/onboarding/step-2');
  }, [nickname, ageRange, gender, navigate, saveStep]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params) {
      const { nickname: voiceNickname, ageRange: voiceAge, gender: voiceGender } = result.params;

      if (typeof voiceNickname === 'string') {
        setNickname(voiceNickname);
      }
      if (typeof voiceAge === 'string') {
        setAgeRange(voiceAge);
      }
      if (typeof voiceGender === 'string') {
        setGender(voiceGender);
      }
    }
  }, []);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !ageRange || !gender}
      showVoiceButton
      onTranscript={(text) => setNickname(text)}
      voiceOptions={[...AGE_OPTIONS, ...GENDER_OPTIONS, 'name', 'nickname']}
      voicePrompt="Hi! Welcome to Guided Growth. I'm your AI companion. What should I call you, and could you share your age and gender so I can personalize your experience?"
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
        <ChipSelect options={AGE_OPTIONS} value={ageRange} onChange={setAgeRange} columns={3} />
      </OnboardingSection>
      <OnboardingSection label="How do you identify?">
        <ChipSelect options={GENDER_OPTIONS} value={gender} onChange={setGender} columns={3} />
      </OnboardingSection>
    </OnboardingLayout>
  );
}
