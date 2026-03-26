import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { authClient } from '@/lib/auth-client';
import { supabase } from '@/lib/supabase';

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

  // Redirect already-onboarded users back to home
  useEffect(() => {
    let cancelled = false;

    async function checkCompleted() {
      try {
        const { data: session } = await authClient.getSession();
        const uid = session?.user?.id;
        if (!uid) return;

        const { data } = await supabase
          .from('onboarding_states')
          .select('status')
          .eq('user_id', uid)
          .maybeSingle();

        if (!cancelled && data?.status === 'completed') {
          navigate('/home', { replace: true });
        }
      } catch {
        // Non-blocking: allow access if check fails
      }
    }

    checkCompleted();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleNext = useCallback(async () => {
    // Save onboarding state (step 1) to Supabase
    try {
      const { data: session } = await authClient.getSession();
      const uid = session?.user?.id;
      if (uid) {
        await supabase.from('onboarding_states').upsert(
          {
            user_id: uid,
            path: 'beginner',
            status: 'in_progress',
            current_step: 1,
            data: { nickname, ageRange, gender },
          },
          { onConflict: 'user_id' },
        );
      }
    } catch {
      // Non-blocking: continue even if save fails
    }
    navigate('/onboarding/step-2');
  }, [nickname, ageRange, gender, navigate]);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !ageRange || !gender}
      showVoiceButton
      onTranscript={(text) => setNickname(text)}
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
