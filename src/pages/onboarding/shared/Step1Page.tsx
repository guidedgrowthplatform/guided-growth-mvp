import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { track } from '@/lib/analytics';

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
  // Tracks which fields were populated from the voice STT flow so we can
  // attribute `complete_profile_setup.input_method` accurately.
  const voiceFilledFieldsRef = useRef<Set<string>>(new Set());

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
    const fieldsFilledByVoice = voiceFilledFieldsRef.current.size;
    // `used_real_time_agent` is false on current main — push-to-talk STT,
    // not the realtime Cartesia agent. Flips to true once !89 lands and
    // Step1Page is wired to useRealtimeVoice.
    track('complete_profile_setup', {
      input_method: fieldsFilledByVoice > 0 ? 'voice' : 'manual',
      fields_filled_by_voice: fieldsFilledByVoice,
      used_real_time_agent: false,
    });
    navigate('/onboarding/step-2');
  }, [nickname, age, gender, referralSource, referralOtherText, navigate, saveStep]);

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
        voiceFilledFieldsRef.current.add('nickname');
      }
      if (typeof voiceAge === 'number') {
        setAge(voiceAge);
        voiceFilledFieldsRef.current.add('age');
      } else if (typeof voiceAge === 'string') {
        const parsed = parseInt(voiceAge, 10);
        if (!isNaN(parsed)) {
          setAge(parsed);
          voiceFilledFieldsRef.current.add('age');
        }
      } else if (typeof voiceAgeRange === 'string') {
        // Legacy voice support — leave age for user to fill
        setAge('');
      }
      if (typeof voiceGender === 'string') {
        setGender(voiceGender);
        voiceFilledFieldsRef.current.add('gender');
      }
      if (typeof voiceReferral === 'string') {
        setReferralSource(voiceReferral);
        voiceFilledFieldsRef.current.add('referralSource');
      }
    }
  }, []);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Continue"
      onBack={() => navigate('/onboarding/ai-coach-intro')}
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age || !gender || !referralSource}
      showVoiceButton
      onTranscript={(text) => setNickname(text)}
      voiceOptions={[...GENDER_OPTIONS, ...REFERRAL_OPTIONS, 'name', 'nickname']}
      voiceFileId="ONBOARD-01"
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
