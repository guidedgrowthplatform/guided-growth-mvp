import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingSection } from '@/components/onboarding/OnboardingSection';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { queryKeys } from '@/lib/query';
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
  const qc = useQueryClient();
  const { state: onboardingState, saveStep } = useOnboarding();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [referralOtherText, setReferralOtherText] = useState('');
  const [_micAvailable, setMicAvailable] = useState(true);
  const [aiText, setAiText] = useState('');
  const [userText, setUserText] = useState('');
  const [_voiceStatus, setVoiceStatus] = useState<
    'connecting' | 'speaking' | 'listening' | 'processing' | 'error' | 'idle'
  >('connecting');
  const [userId, setUserId] = useState<string>('');
  const agentStarted = useRef(false);
  const pendingStopRef = useRef<number | null>(null);

  // Step E: Parse transcript to auto-fill form
  const parseTranscript = useCallback((text: string) => {
    const t = text.toLowerCase();

    // Name: "I'm Sarah" / "call me Sarah" / "my name is Sarah"
    const nameMatch = t.match(/(?:i'm|i am|my name is|call me|name's)\s+(\w+)/i);
    if (nameMatch) setNickname(nameMatch[1]);

    // Age: any 2-digit number or textual representation ("thirty")
    let newAge: number | null = null;
    const ageMatch = t.match(/\b(\d{1,2})\b/);
    if (ageMatch) {
      newAge = parseInt(ageMatch[1], 10);
    } else {
      const tens: Record<string, number> = {
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90,
      };
      const ones: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
      };
      const teens: Record<string, number> = {
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
      };
      for (const [w, val] of Object.entries(teens)) {
        if (t.match(new RegExp(`\\b${w}\\b`))) {
          newAge = val;
          break;
        }
      }
      if (!newAge) {
        for (const [w, val] of Object.entries(tens)) {
          if (t.match(new RegExp(`\\b${w}\\b`))) {
            newAge = val;
            for (const [ow, oval] of Object.entries(ones)) {
              if (t.includes(`${w} ${ow}`) || t.includes(`${w}-${ow}`)) {
                newAge = val + oval;
                break;
              }
            }
            break;
          }
        }
      }
    }
    if (newAge && newAge >= 13 && newAge <= 120) {
      setAge(newAge);
    }

    // Gender
    if (/\b(female|woman|girl|lady)\b/i.test(t)) setGender('Female');
    else if (/\b(male|man|guy|boy|dude)\b/i.test(t)) setGender('Male');
    else if (/\bnon.?binary\b/i.test(t)) setGender('Other');

    // Referral
    if (
      /\b(webinar|tiktok|instagram|ig|insta|twitter|x|facebook|linkedin|reddit|youtube|social)\b/i.test(
        t,
      )
    )
      setReferralSource('Webinar'); // social media
    else if (/\b(friend|buddy|someone|word of mouth|recommended)\b/i.test(t))
      setReferralSource('Friend');
    else if (/\b(google|website|app store|search|other)\b/i.test(t)) setReferralSource('Other');
    else if (/\b(founder|invite|yair)\b/i.test(t)) setReferralSource('Founder Invite');
  }, []);

  // Real-time voice agent.
  // NOTE: Cartesia platform does not forward user_transcript events to the
  // browser (verified against the play.cartesia.ai reference client which
  // only handles ack/media_output/clear). So onUserSpeech almost never fires.
  // Fallback: parse the agent's spoken acknowledgment (onTranscript) — when
  // user says 'My name is Sam', agent replies 'Hi Sam…' and regex picks up
  // the name, age, gender, referral from the agent's confirmation sentence.
  const realtimeVoice = useRealtimeVoice({
    userContext: { name: nickname || undefined, coachingStyle: 'warm' },
    metadata: { user_id: userId, screen: 'onboard_01' },
    onTranscript: (text) => {
      setAiText(text);
      parseTranscript(text);
    },
    onUserSpeech: (text) => {
      setUserText(text);
      parseTranscript(text);
    },
    onError: () => setMicAvailable(false),
    // Agent-driven navigation: when the Cartesia Line agent calls
    // `navigate_next` after capturing all profile fields, route forward
    // without requiring the user to tap Continue (voice-first per spec).
    onToolCall: (name) => {
      if (name === 'navigate_next') {
        pendingStopRef.current = window.setTimeout(() => {
          realtimeVoice.stop();
          pendingStopRef.current = null;
          agentStarted.current = false;
          navigate('/onboarding/step-2', { replace: true });
        }, 400);
      }
    },
  });

  // Mirror realtime voice state to our UI indicator
  useEffect(() => {
    if (realtimeVoice.state === 'connecting') setVoiceStatus('connecting');
    else if (realtimeVoice.state === 'speaking') setVoiceStatus('speaking');
    else if (realtimeVoice.state === 'listening') setVoiceStatus('listening');
    else if (realtimeVoice.state === 'processing') setVoiceStatus('processing');
    else if (realtimeVoice.state === 'error') setVoiceStatus('error');
    else setVoiceStatus('idle');
  }, [realtimeVoice.state]);

  // Poll onboarding state every 2s while the realtime session is active.
  // The agent writes record_onboarding_profile tool results into Supabase
  // (onboarding_states.data); the existing restore effect below picks up
  // the new values and sets form fields.
  useEffect(() => {
    const active =
      realtimeVoice.state === 'listening' ||
      realtimeVoice.state === 'speaking' ||
      realtimeVoice.state === 'processing';
    if (!active) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: queryKeys.onboarding.state });
    }, 2000);
    return () => clearInterval(id);
  }, [realtimeVoice.state, qc]);

  // Robust fallback: Poll transcript directly from backend API
  // In case the agent fails to call record_onboarding_profile tool
  useEffect(() => {
    if (!realtimeVoice.streamId) return;

    // Always poll as long as streamId exists, until we unmount.
    const intervalId = setInterval(async () => {
      try {
        const apiBase =
          Capacitor.isNativePlatform() && import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL
            : '';

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(
          `${apiBase}/api/onboarding/transcript?streamId=${realtimeVoice.streamId}`,
          {
            headers,
          },
        );
        if (res.ok) {
          const { text } = await res.json();
          if (text) {
            parseTranscript(text);
          }
        }
      } catch {
        // quiet fail on background polling
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [realtimeVoice.streamId, parseTranscript]);

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
    // Cancel any pending stop from a previous (StrictMode dev) cleanup —
    // without this, the first cleanup closes the WS mid-handshake and the
    // re-mount sees agentStarted=true so it never reconnects.
    if (pendingStopRef.current !== null) {
      clearTimeout(pendingStopRef.current);
      pendingStopRef.current = null;
    }
    if (agentStarted.current) return;
    agentStarted.current = true;

    // Check mic permission
    (async () => {
      let uid = '';
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          uid = data.user.id;
          setUserId(uid);
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

      // Start real-time agent — it speaks the introduction automatically.
      // Pass user_id inline so the tool record_onboarding_profile can
      // persist results without waiting for a React re-render.
      try {
        await realtimeVoice.start({ user_id: uid, screen: 'onboard_01' });
      } catch {
        // Fallback if agent connection fails — use TTS
        speak(
          "OK, let me get to know you a little. What's your name, how old are you, how do you identify, and how did you hear about us? You can just say it all or fill it in on screen.",
        );
      }
    })();

    return () => {
      // Defer stop so StrictMode's double-invoke doesn't close the WS
      // mid-handshake. If the effect re-runs within 500ms, the next mount
      // clears this timer so the connection survives.
      pendingStopRef.current = window.setTimeout(() => {
        realtimeVoice.stop();
        pendingStopRef.current = null;
        agentStarted.current = false;
      }, 500);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="text-sm text-content">You said: {userText}</p>
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
