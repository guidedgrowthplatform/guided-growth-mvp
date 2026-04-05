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
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (Capacitor.isNativePlatform()) {
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

        // If confidence is too low, treat as failure
        if (confidence < 0.5) {
          return {
            success: false,
            action: 'error',
            params: {},
            message: "I didn't catch that — try again or select manually.",
            confidence,
          };
        }

        return {
          success: result.success === true || result.action === 'onboarding_select',
          action: result.action || 'error',
          params: result.params || {},
          message: result.message || 'Got it!',
          confidence,
        };
      } catch (error) {
        console.error('Onboarding voice processing failed:', error);
        return {
          success: false,
          action: 'error',
          params: {},
          message: 'Something went wrong. Try again or select manually.',
          confidence: 0,
        };
      }
    },
    [],
  );

  return { processTranscript };
}
