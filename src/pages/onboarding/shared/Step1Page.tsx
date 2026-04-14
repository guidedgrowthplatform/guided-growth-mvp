import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { speak } from '@/lib/services/tts-service';

/**
 * ONBOARD-01: Profile Setup.
 *
 * Flow:
 * A. Screen loads, pre-recorded intro MP3 plays (onb_profile_001).
 * B. User taps mic button, speaks profile info.
 * C. Transcript parsed via regex → form auto-fills.
 * D. Dynamic TTS acknowledgment plays once name captured.
 * E. User confirms and taps "Let's Begin".
 */

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
  const ackSpokenRef = useRef(false);

  // Restore saved state
  useEffect(() => {
    if (onboardingState?.data) {
      if (onboardingState.data.nickname) setNickname(onboardingState.data.nickname as string);
      if (onboardingState.data.age) setAge(onboardingState.data.age as number);
      if (onboardingState.data.gender) setGender(onboardingState.data.gender as string);
      if (onboardingState.data.referralSource)
        setReferralSource(onboardingState.data.referralSource as string);
    }
  }, [onboardingState?.data]);

  // Parse transcript → auto-fill form + speak acknowledgment once
  const parseTranscript = useCallback(
    (text: string) => {
      const t = text.toLowerCase();

      const nameMatch = t.match(/(?:i'm|i am|my name is|call me|name's)\s+(\w+)/i);
      let capturedName: string | null = null;
      if (nameMatch && !nickname) {
        capturedName = nameMatch[1];
        setNickname(capturedName);
      }

      const ageMatch = t.match(/\b(\d{1,2})\b/);
      if (ageMatch && !age) {
        const parsed = parseInt(ageMatch[1], 10);
        if (parsed >= 13 && parsed <= 120) setAge(parsed);
      }

      if (!gender) {
        if (/\b(female|woman|girl|lady)\b/i.test(t)) setGender('Female');
        else if (/\b(male|man|guy|boy|dude)\b/i.test(t)) setGender('Male');
        else if (/\bnon.?binary\b/i.test(t)) setGender('Other');
      }

      if (!referralSource) {
        if (
          /\b(tiktok|instagram|ig|insta|twitter|x|facebook|linkedin|reddit|youtube|social|webinar)\b/i.test(
            t,
          )
        )
          setReferralSource('Webinar');
        else if (/\b(friend|buddy|someone|word of mouth|recommended)\b/i.test(t))
          setReferralSource('Friend');
        else if (/\b(founder|invite|yair)\b/i.test(t)) setReferralSource('Founder Invite');
        else if (/\b(google|website|app store|search)\b/i.test(t)) setReferralSource('Other');
      }

      // Dynamic TTS acknowledgment — once, after name captured
      if (!ackSpokenRef.current) {
        ackSpokenRef.current = true;
        const displayName = capturedName || nickname || 'there';
        const cap = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        speak(`Nice to meet you, ${cap}. Tap Let's Begin when you're ready.`);
      }
    },
    [nickname, age, gender, referralSource],
  );

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
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age}
      showVoiceButton
      onTranscript={parseTranscript}
      voiceFileId="onb_profile_001"
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
