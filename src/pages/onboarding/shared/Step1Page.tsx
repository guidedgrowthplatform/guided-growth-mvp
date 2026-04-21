import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { track } from '@/analytics';
import { useAuthStore } from '@/stores/authStore';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

export function Step1Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStep } = useOnboarding();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [referralOtherText, setReferralOtherText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Tracks which fields were populated by the real-time agent's
  // record_onboarding_profile tool call so we can attribute
  // `complete_profile_setup.input_method` accurately.
  const voiceFilledFieldsRef = useRef<Set<string>>(new Set());

  // Observe agent tool-call side effects. When the agent calls
  // `record_onboarding_profile`, it writes to onboarding_states.data; the
  // sync hook mirrors that into React Query, which the useEffect below
  // maps back into local form state.
  useOnboardingRealtimeSync();

  const {
    start,
    stop,
    state: voiceState,
  } = useRealtimeVoice({
    metadata: { user_id: userId ?? '', screen: 'onboard_01', coaching_style: 'warm' },
    onError: (message) => setVoiceError(message),
    onEnd: () => setVoiceError(null),
  });

  useEffect(() => {
    if (onboardingState?.data) {
      if (onboardingState.data.nickname) {
        setNickname((prev) => {
          const next = onboardingState.data.nickname as string;
          if (prev !== next) voiceFilledFieldsRef.current.add('nickname');
          return next;
        });
      }
      if (onboardingState.data.age) {
        setAge((prev) => {
          const next = onboardingState.data.age as number;
          if (prev !== next) voiceFilledFieldsRef.current.add('age');
          return next;
        });
      }
      // Support legacy ageRange data
      if (onboardingState.data.ageRange && !onboardingState.data.age) setAge('');
      if (onboardingState.data.gender) {
        setGender((prev) => {
          const next = onboardingState.data.gender as string;
          if (prev !== next) voiceFilledFieldsRef.current.add('gender');
          return next;
        });
      }
      if (onboardingState.data.referralSource) {
        setReferralSource((prev) => {
          const next = onboardingState.data.referralSource as string;
          if (prev !== next) voiceFilledFieldsRef.current.add('referralSource');
          return next;
        });
      }
      if (onboardingState.data.referralOtherText)
        setReferralOtherText(onboardingState.data.referralOtherText as string);
    }
  }, [onboardingState?.data]);

  // Auto-start the real-time agent on mount only if microphone permission
  // has already been granted (by the earlier MicPermissionPage). If the
  // permission is `prompt` or `denied`, we stay silent and the form is
  // still fully operable — matches Yair's Phase 1 spec §1.1 denied path.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await navigator.permissions?.query?.({
          name: 'microphone' as PermissionName,
        });
        if (cancelled || perm?.state !== 'granted') return;
        await start();
      } catch {
        // Permissions API not supported on this browser — skip auto-start.
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // `start`/`stop` are stable wrt session; re-running on userId alone is
    // the right trigger (the hook depends on metadata.user_id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleNext = useCallback(() => {
    stop();
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
    track('complete_profile_setup', {
      input_method: fieldsFilledByVoice > 0 ? 'voice' : 'manual',
      fields_filled_by_voice: fieldsFilledByVoice,
      used_real_time_agent: true,
    });
    navigate('/onboarding/step-2');
  }, [nickname, age, gender, referralSource, referralOtherText, navigate, saveStep, stop]);

  const voiceStatusLabel =
    voiceState === 'listening'
      ? 'Listening…'
      : voiceState === 'thinking'
        ? 'Thinking…'
        : voiceState === 'speaking'
          ? 'Speaking…'
          : voiceState === 'connecting'
            ? 'Connecting…'
            : null;

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Continue"
      onBack={() => {
        stop();
        navigate('/onboarding/ai-coach-intro');
      }}
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age || !gender || !referralSource}
    >
      <OnboardingHeader
        title="Let's get to know you."
        subtitle="Tell us a bit about yourself to personalize your journey."
      />
      {(voiceStatusLabel || voiceError) && (
        <div
          className="text-center text-sm text-content-secondary"
          role="status"
          aria-live="polite"
        >
          {voiceError ? voiceError : voiceStatusLabel}
        </div>
      )}
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
