import { Capacitor } from '@capacitor/core';
import { useCallback } from 'react';
import { supabase, sessionReady } from '@/lib/supabase';

export interface OnboardingStepContext {
  step: number;
  screen_id?: string; // canonical screen id from src/generated/screen_contexts.json
  options: string[];
  prompt: string;
  // Snapshot of fields already filled on the current page + prior pages
  // (persisted onboarding_states.data merged with the page's in-flight React
  // state). Forwarded to /api/process-command so the parser LLM prefers
  // empty fields on multi-field utterances.
  filled_fields?: Record<string, unknown>;
  extraData?: Record<string, unknown>;
}

export interface OnboardingVoiceResult {
  success: boolean;
  action: string;
  params: Record<string, unknown>;
  message: string;
  confidence: number;
}

/**
 * Hook for processing transcripts in onboarding steps.
 * Calls /api/process-command with onboarding-specific context.
 */

// Keyed by the bundled screen IDs in src/generated/screen_contexts.json. The
// non-bundled `ONBOARD-ADV-CUSTOM` is a canonical name we own — the bundle has
// no exact match for the AdvancedCustomPromptsPage today.
const SCREEN_FALLBACKS: Record<string, string> = {
  'ONBOARD-01--FORM':
    "I didn't catch that clearly. Could you say your name again? Or just type it in — totally fine.",
  'ONBOARD-FORK--FORM':
    "No pressure either way — just tap the one that feels right, or say 'simple' or 'brain dump.'",
  'ONBOARD-BEGINNER-01':
    "I didn't catch which area. Just say one — like 'sleep' or 'focus' — or tap it.",
  'ONBOARD-BEGINNER-02': 'Could you say that again? Or just tap the ones that resonate.',
  'ONBOARD-BEGINNER-03': 'Which habit do you want to add? Say it like "meditate at 7am".',
  'ONBOARD-BEGINNER-06': "Say 'let's go' or tap 'Start plan.'",
  'ONBOARD-BEGINNER-07': 'Want me to remind you each evening? Pick a time or skip.',
  'ONBOARD-ADVANCED': 'Just talk through everything you want to track. Take your time.',
  'ONBOARD-ADVANCED-02': 'You can change or remove any of these — just say which one.',
  'ONBOARD-ADVANCED-04': 'Want me to remind you each evening? Pick a time or skip.',
  'ONBOARD-ADV-CUSTOM': 'What prompt do you want me to use for journaling?',
};

const STEP_FALLBACKS: Record<number, string> = {
  1: SCREEN_FALLBACKS['ONBOARD-01--FORM'],
  2: SCREEN_FALLBACKS['ONBOARD-FORK--FORM'],
  3: SCREEN_FALLBACKS['ONBOARD-BEGINNER-01'],
  4: SCREEN_FALLBACKS['ONBOARD-BEGINNER-02'],
  5: SCREEN_FALLBACKS['ONBOARD-BEGINNER-03'],
  6: SCREEN_FALLBACKS['ONBOARD-BEGINNER-07'],
  7: SCREEN_FALLBACKS['ONBOARD-BEGINNER-06'],
};

function getFallbackMessage(stepContext: OnboardingStepContext): string {
  return (
    (stepContext.screen_id && SCREEN_FALLBACKS[stepContext.screen_id]) ||
    STEP_FALLBACKS[stepContext.step] ||
    "I didn't catch that — try again or select manually."
  );
}

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[OnboardingVoice] VITE_API_URL not set — API calls will fail on native');
  }
  return '';
}

export function useOnboardingVoice() {
  const processTranscript = useCallback(
    async (
      transcript: string,
      stepContext: OnboardingStepContext,
    ): Promise<OnboardingVoiceResult> => {
      if (!transcript.trim()) {
        return {
          success: false,
          action: 'error',
          params: {},
          message: "I didn't hear anything. Try again.",
          confidence: 0,
        };
      }

      try {
        // Get auth token for production API calls
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          // Native session is async — see stt-service.ts. Without
          // this await, voice fired immediately at app launch races the
          // Capacitor Preferences loader and the request goes out with
          // no Authorization header, returning 401.
          if (Capacitor.isNativePlatform()) {
            await sessionReady;
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch {
          /* continue without auth */
        }

        const response = await fetch(`${getApiBase()}/api/process-command`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            transcript,
            onboarding_context: {
              step: stepContext.step,
              screen_id: stepContext.screen_id,
              options: stepContext.options,
              prompt: stepContext.prompt,
              filled_fields: stepContext.filled_fields,
              ...stepContext.extraData,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        // Ensure confidence is a number
        const confidence = typeof result.confidence === 'number' ? result.confidence : 0;

        // If confidence is too low, treat as failure with screen-specific fallback
        if (confidence < 0.5) {
          return {
            success: false,
            action: 'error',
            params: {},
            message: getFallbackMessage(stepContext),
            confidence,
          };
        }

        // Post-process: fix PII-scrubbed names by extracting from original transcript
        const params = result.params || {};
        if (stepContext.step === 1) {
          // Note: previously logged params + transcript here, but those
          // contain PII (user's name, demographic). Removed to keep prod
          // logs clean and avoid leaking PII into Sentry/Vercel logs.

          // Fix nickname if it contains [NAME]
          if (
            params.nickname &&
            typeof params.nickname === 'string' &&
            params.nickname.includes('[NAME]')
          ) {
            // Number words that should NOT be treated as names
            const numberWords = new Set([
              'one',
              'two',
              'three',
              'four',
              'five',
              'six',
              'seven',
              'eight',
              'nine',
              'ten',
              'eleven',
              'twelve',
              'thirteen',
              'fourteen',
              'fifteen',
              'sixteen',
              'seventeen',
              'eighteen',
              'nineteen',
              'twenty',
              'thirty',
              'forty',
              'fifty',
              'sixty',
              'seventy',
              'eighty',
              'ninety',
              'hundred',
              'no',
              'sorry',
              'not',
              'yes',
              'yeah',
            ]);
            const stopWords = [
              'and',
              'i',
              "i'm",
              'im',
              'am',
              'years',
              'old',
              'male',
              'female',
              'other',
              'a',
              'guy',
              'man',
              'boy',
              'woman',
              'girl',
              'dude',
            ];

            // Prefer explicit name patterns: "my name is X" / "call me X"
            const explicitName = transcript.match(
              /(?:my name is|call me|name's|name is)\s+([a-zA-Z]+)/i,
            );
            if (explicitName && !numberWords.has(explicitName[1].toLowerCase())) {
              params.nickname = explicitName[1];
            } else {
              // Fallback: "I'm X" but skip number words
              const imMatch = transcript.match(/(?:i'm|i am)\s+([a-zA-Z]+)/i);
              if (
                imMatch &&
                !numberWords.has(imMatch[1].toLowerCase()) &&
                !stopWords.includes(imMatch[1].toLowerCase())
              ) {
                params.nickname = imMatch[1];
              } else {
                // Last resort: first capitalized word not in any skip list
                const words = transcript.split(/\s+/);
                const allSkip = new Set([
                  ...stopWords,
                  ...numberWords,
                  'hello',
                  'hi',
                  'hey',
                  'my',
                  'name',
                  'is',
                  'the',
                ]);
                const nameWord = words.find(
                  (w) => w.length > 1 && /^[A-Z]/.test(w) && !allSkip.has(w.toLowerCase()),
                );
                if (nameWord) params.nickname = nameWord;
              }
            }
          }

          // ALWAYS extract gender from transcript for step 1 (API often gets it wrong due to PII scrubbing)
          const normalizedTranscript = transcript
            .toLowerCase()
            .replace(/[\u2018\u2019\u2032]/g, "'");
          if (/\b(male|man|guy|boy|dude)\b/.test(normalizedTranscript)) {
            params.gender = 'Male';
          } else if (/\b(female|woman|girl|lady|gal)\b/.test(normalizedTranscript)) {
            params.gender = 'Female';
          } else if (params.gender && typeof params.gender === 'string') {
            // Fallback: normalize whatever API returned
            const g = params.gender.toLowerCase().trim();
            if (['male', 'm', 'man', 'boy', 'guy', 'dude'].includes(g)) params.gender = 'Male';
            else if (['female', 'f', 'woman', 'girl', 'lady', 'gal'].includes(g))
              params.gender = 'Female';
            else params.gender = 'Other';
          }

          // Extract referral source from transcript
          if (/\b(founder|invite|invited)\b/.test(normalizedTranscript)) {
            params.referralSource = 'Founder Invite';
          } else if (/\b(webinar)\b/.test(normalizedTranscript)) {
            params.referralSource = 'Webinar';
          } else if (/\b(friend|buddy|colleague|someone)\b/.test(normalizedTranscript)) {
            params.referralSource = 'Friend';
          }
        }

        // Step-specific responses — inspired by Voice Journey Spreadsheet v3
        // Shortened for natural spoken delivery
        const stepSuccessMessages: Record<number, string> = {
          1: `Great to meet you, ${params.nickname || 'there'}. I'm glad you're here. Let's build something that actually works for you.`,
          2: `That's great. The fact that you're here means something. I'm going to help you pick a few small things — not a huge list, just what matters. Morning and evening check-ins, under a minute each. Let's go.`,
          3: `That's a great area to focus on. When this gets better, everything else follows. You picked well. Let's go deeper.`,
          4: `I hear that a lot. It's usually not about willpower — it's about small shifts in your routine. Let me show you.`,
          5: `Solid. That one alone can make a real difference. Let's set it up.`,
          6: `Good call. We'll do this at the end of each day. You just talk, I'll capture everything.`,
          7: `You're in. Your first check-in is on the home screen. Talk to you soon.`,
        };

        const step = stepContext.step;
        // Flow 3 vocabulary: actions that carry a per-utterance value (not the
        // legacy step-bump select) get the terse acknowledgement; the
        // step-completion messages still apply to onboarding_select.
        const PER_UTTERANCE_ACTIONS = new Set([
          'fill_field',
          'select_option',
          'select_multiple',
          'add_habit',
          'update_habit',
          'remove_habit',
          'set_reflection_config',
          'set_path',
          'confirm_plan',
          'navigate_next',
        ]);
        const isPerUtterance = PER_UTTERANCE_ACTIONS.has(String(result.action));
        const successMessage = isPerUtterance ? `Got it.` : stepSuccessMessages[step] || 'Got it!';

        return {
          success:
            result.success === true || result.action === 'onboarding_select' || isPerUtterance,
          action: result.action || 'error',
          params,
          message: successMessage,
          confidence,
        };
      } catch (error) {
        console.error('Onboarding voice processing failed:', error);
        return {
          success: false,
          action: 'error',
          params: {},
          message: getFallbackMessage(stepContext),
          confidence: 0,
        };
      }
    },
    [],
  );

  return { processTranscript };
}
