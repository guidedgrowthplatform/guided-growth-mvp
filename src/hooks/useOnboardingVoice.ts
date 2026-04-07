import { Capacitor } from '@capacitor/core';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface OnboardingStepContext {
  step: number;
  options: string[];
  prompt: string;
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
              options: stepContext.options,
              prompt: stepContext.prompt,
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

        // If confidence is too low, treat as failure with step-specific fallback
        if (confidence < 0.5) {
          const lowConfFallback: Record<number, string> = {
            1: "I didn't catch that clearly. Could you say your name again? Or just type it in — totally fine.",
            2: "No pressure either way — just tap the one that feels right, or say 'new' or 'experienced.'",
            3: "I didn't catch which area. Just say one — like 'sleep' or 'focus' — or tap it.",
            4: "Could you say that again? Or just tap the one that resonates.",
            5: "Which one sounds right? Say the name or tap it.",
            6: "Do you want the daily reflection, or skip for now?",
            7: "Say 'let's go' or tap 'Start plan.'",
          };
          return {
            success: false,
            action: 'error',
            params: {},
            message: lowConfFallback[stepContext.step] || "I didn't catch that — try again or select manually.",
            confidence,
          };
        }

        // Post-process: fix PII-scrubbed names by extracting from original transcript
        const params = result.params || {};
        if (stepContext.step === 1) {
          console.log('[OnboardingVoice] API params:', JSON.stringify(params));
          console.log('[OnboardingVoice] Original transcript:', transcript);

          // Fix nickname if it contains [NAME]
          if (
            params.nickname &&
            typeof params.nickname === 'string' &&
            params.nickname.includes('[NAME]')
          ) {
            // Number words that should NOT be treated as names
            const numberWords = new Set([
              'one','two','three','four','five','six','seven','eight','nine','ten',
              'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
              'eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy',
              'eighty','ninety','hundred','no','sorry','not','yes','yeah',
            ]);
            const stopWords = ['and', 'i', "i'm", 'im', 'am', 'years', 'old', 'male', 'female', 'other', 'a', 'guy', 'man', 'boy', 'woman', 'girl', 'dude'];

            // Prefer explicit name patterns: "my name is X" / "call me X"
            const explicitName = transcript.match(
              /(?:my name is|call me|name's|name is)\s+([a-zA-Z]+)/i,
            );
            if (explicitName && !numberWords.has(explicitName[1].toLowerCase())) {
              params.nickname = explicitName[1];
            } else {
              // Fallback: "I'm X" but skip number words
              const imMatch = transcript.match(/(?:i'm|i am)\s+([a-zA-Z]+)/i);
              if (imMatch && !numberWords.has(imMatch[1].toLowerCase()) && !stopWords.includes(imMatch[1].toLowerCase())) {
                params.nickname = imMatch[1];
              } else {
                // Last resort: first capitalized word not in any skip list
                const words = transcript.split(/\s+/);
                const allSkip = new Set([
                  ...stopWords, ...numberWords,
                  'hello', 'hi', 'hey', 'my', 'name', 'is', 'the',
                ]);
                const nameWord = words.find(
                  (w) => w.length > 1 && /^[A-Z]/.test(w) && !allSkip.has(w.toLowerCase()),
                );
                if (nameWord) params.nickname = nameWord;
              }
            }
            console.log('[OnboardingVoice] Extracted nickname:', params.nickname);
          }

          // ALWAYS extract gender from transcript for step 1 (API often gets it wrong due to PII scrubbing)
          const normalizedTranscript = transcript.toLowerCase().replace(/[\u2018\u2019\u2032]/g, "'");
          if (/\b(male|man|guy|boy|dude)\b/.test(normalizedTranscript)) {
            params.gender = 'Male';
          } else if (/\b(female|woman|girl|lady|gal)\b/.test(normalizedTranscript)) {
            params.gender = 'Female';
          } else if (params.gender && typeof params.gender === 'string') {
            // Fallback: normalize whatever API returned
            const g = params.gender.toLowerCase().trim();
            if (['male', 'm', 'man', 'boy', 'guy', 'dude'].includes(g)) params.gender = 'Male';
            else if (['female', 'f', 'woman', 'girl', 'lady', 'gal'].includes(g)) params.gender = 'Female';
            else params.gender = 'Other';
          }

          console.log('[OnboardingVoice] Final params:', JSON.stringify(params));
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
        // ALWAYS use our curated messages — never trust GPT's random message field
        const successMessage = stepSuccessMessages[step] || 'Got it!';

        return {
          success: result.success === true || result.action === 'onboarding_select',
          action: result.action || 'error',
          params,
          message: successMessage,
          confidence,
        };
      } catch (error) {
        console.error('Onboarding voice processing failed:', error);
        // Step-specific fallbacks — EXACT from Voice Journey Spreadsheet v3
        const step = stepContext.step;
        const fallback: Record<number, string> = {
          1: "I didn't catch that clearly. Could you say your name again? Or just type it in — totally fine.",
          2: "No pressure either way — just tap the one that feels right, or say 'new' or 'experienced.'",
          3: "I didn't catch which area. Just say one — like 'sleep' or 'focus' — or tap it.",
          4: "Could you say that again? Or just tap the one that resonates.",
          5: "Which one sounds right? Say the name or tap it.",
          6: "Do you want the daily reflection, or skip for now?",
          7: "Say 'let's go' or tap 'Start plan.'",
        };
        return {
          success: false,
          action: 'error',
          params: {},
          message: fallback[step] || "I didn't catch that — try again or select manually.",
          confidence: 0,
        };
      }
    },
    [],
  );

  return { processTranscript };
}
