import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

export function Step1Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStep } = useOnboarding();
  const [nickname, setNickname] = useState('');
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [showAgePicker, setShowAgePicker] = useState(false);

  useEffect(() => {
    if (onboardingState?.data) {
      if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
      if (onboardingState.data.ageRange) setAgeRange(onboardingState.data.ageRange as string);
      if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
      if (onboardingState.data.referralSource)
        setReferralSource(onboardingState.data.referralSource as string);
    }
  }, [onboardingState?.data]);

  const handleNext = useCallback(() => {
    saveStep(1, { nickname, ageRange, gender, referralSource });
    navigate('/onboarding/step-2');
  }, [nickname, ageRange, gender, referralSource, navigate, saveStep]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params) {
      const {
        nickname: voiceNickname,
        ageRange: voiceAge,
        gender: voiceGender,
        referralSource: voiceReferral,
      } = result.params;

      if (typeof voiceNickname === 'string') {
        setNickname(voiceNickname);
      }
      if (typeof voiceAge === 'string') {
        setAgeRange(voiceAge);
      }
      if (typeof voiceGender === 'string') {
        setGender(voiceGender);
      }
      if (typeof voiceReferral === 'string') {
        setReferralSource(voiceReferral);
      }
    }
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAgePicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAgePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAgePicker]);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !ageRange || !gender || !referralSource}
      showVoiceButton
      onTranscript={(text) => setNickname(text)}
      voiceOptions={[...AGE_OPTIONS, ...GENDER_OPTIONS, ...REFERRAL_OPTIONS, 'name', 'nickname']}
      voicePrompt="What's your name, age range, how do you identify, and how did you hear about us?"
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
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAgePicker((prev) => !prev)}
            className="relative w-full rounded-[16px] bg-white px-[22px] py-[14px] pr-[48px] text-left text-[18px] shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)] outline-none"
          >
            <span className={ageRange ? 'text-content' : 'text-content-tertiary'}>
              {ageRange || 'Select your age'}
            </span>
            <Icon
              icon="formkit:down"
              width={24}
              height={10}
              className={`pointer-events-none absolute right-[22px] top-1/2 -translate-y-1/2 text-content-subtle transition-transform ${showAgePicker ? 'rotate-180' : ''}`}
            />
          </button>
          {showAgePicker && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[240px] overflow-y-auto rounded-[16px] bg-white p-2 shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.12)] [scrollbar-color:rgba(0,0,0,0.25)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-[6px]">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setAgeRange(opt);
                    setShowAgePicker(false);
                  }}
                  className={`w-full rounded-[10px] px-[16px] py-[10px] text-left text-[16px] transition-colors ${
                    ageRange === opt
                      ? 'bg-primary/10 font-bold text-primary'
                      : 'text-content active:bg-gray-100'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
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
      </OnboardingSection>
    </OnboardingLayout>
  );
}
