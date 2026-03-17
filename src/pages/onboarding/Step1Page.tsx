import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChipSelect } from '@/components/onboarding/ChipSelect';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';

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
  const [nickname, setNickname] = useState('');
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={() => navigate('/onboarding/step-2')}
      showVoiceButton
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
