import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { speak } from '@/lib/services/tts-service';
import { supabase } from '@/lib/supabase';

/**
 * ONBOARD-01: Profile Setup — REAL-TIME AGENT.
 *
 * Phase 1 docs (Steps A-G):
 * A. Screen loads with empty form.
 * B. Agent speaks AUTOMATICALLY: "OK, let me get to know you..."
 * C. User responds by voice. Transcript appears as subtitle.
 * D. GPT responds with user's name: "Great to meet you, Sarah."
 * E. Form auto-fills from transcript (regex parsing).
 * F. Conversation continues for missing fields.
 * G. User confirms and taps "Let's Begin".
 *
 * If mic denied: introduction shows as text bubble. Manual form fill.
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
  const [micAvailable, setMicAvailable] = useState(true);
  const [aiText, setAiText] = useState('');
  const [userText, setUserText] = useState('');
  const agentStarted = useRef(false);

  // Real-time voice agent
  const realtimeVoice = useRealtimeVoice({
    userContext: { name: nickname || undefined, coachingStyle: 'warm' },
    onTranscript: (text) => setAiText(text),
    onUserSpeech: (text) => {
      setUserText(text);
      parseTranscript(text);
    },
    onError: () => setMicAvailable(false),
  });

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

  // Step B: Auto-start agent on mount (agent speaks first)
  useEffect(() => {
    if (agentStarted.current) return;
    agentStarted.current = true;

    // Check mic permission
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('mic_permission')
            .eq('id', data.user.id)
            .maybeSingle();
          if (profile?.mic_permission === false) {
            setMicAvailable(false);
            // Screen mode fallback: show introduction as text
            setAiText(
              "OK, let me get to know you a little. What's your name, how old are you, how do you identify, and how did you hear about us? You can just fill it in on screen.",
            );
            return;
          }
        }
      } catch {
        /* continue with agent */
      }

      // Start real-time agent — it speaks the introduction automatically
      try {
        await realtimeVoice.start();
      } catch {
        // Fallback if agent fails
        setMicAvailable(false);
        speak(
          "OK, let me get to know you a little. What's your name, how old are you, how do you identify, and how did you hear about us?",
        );
      }
    })();

    return () => {
      realtimeVoice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step E: Parse transcript to auto-fill form
  const parseTranscript = useCallback(
    (text: string) => {
      const t = text.toLowerCase();

      // Name: "I'm Sarah" / "call me Sarah" / "my name is Sarah"
      const nameMatch = t.match(/(?:i'm|i am|my name is|call me|name's)\s+(\w+)/i);
      if (nameMatch && !nickname) setNickname(nameMatch[1]);

      // Age: any 2-digit number
      const ageMatch = t.match(/\b(\d{1,2})\b/);
      if (ageMatch && !age) {
        const parsed = parseInt(ageMatch[1], 10);
        if (parsed >= 13 && parsed <= 120) setAge(parsed);
      }

      // Gender
      if (!gender) {
        if (/\b(female|woman|girl|lady)\b/i.test(t)) setGender('Female');
        else if (/\b(male|man|guy|boy|dude)\b/i.test(t)) setGender('Male');
        else if (/\bnon.?binary\b/i.test(t)) setGender('Other');
      }

      // Referral
      if (!referralSource) {
        if (
          /\b(tiktok|instagram|ig|insta|twitter|x|facebook|linkedin|reddit|youtube|social)\b/i.test(
            t,
          )
        )
          setReferralSource('Webinar'); // social media
        else if (/\b(friend|buddy|someone|word of mouth|recommended)\b/i.test(t))
          setReferralSource('Friend');
        else if (/\b(google|website|app store|search)\b/i.test(t)) setReferralSource('Other');
        else if (/\b(founder|invite|yair)\b/i.test(t)) setReferralSource('Founder Invite');
      }
    },
    [nickname, age, gender, referralSource],
  );

  const handleNext = useCallback(() => {
    realtimeVoice.stop();
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
  }, [nickname, age, gender, referralSource, referralOtherText, navigate, saveStep, realtimeVoice]);

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={7}
      ctaLabel="Let's Begin"
      onNext={handleNext}
      ctaDisabled={!nickname.trim() || !age}
      showVoiceButton={micAvailable}
      voiceOptions={[...GENDER_OPTIONS, ...REFERRAL_OPTIONS, 'name', 'nickname']}
      voicePrompt=""
      onVoiceAction={() => {}}
    >
      <OnboardingHeader
        title="Let's get to know you."
        subtitle="Tell us a bit about yourself to personalize your journey."
      />

      {/* AI/User transcript display */}
      {aiText && (
        <div className="rounded-2xl bg-primary/5 p-4">
          <p className="text-sm italic text-content-secondary">{aiText}</p>
        </div>
      )}
      {userText && (
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <p className="text-sm text-content">{userText}</p>
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
