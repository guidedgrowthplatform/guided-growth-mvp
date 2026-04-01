import { useCallback } from 'react';

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

const IS_BYPASS = import.meta.env.VITE_AUTH_BYPASS_MODE === 'true';

/** Simple local mock for voice processing in dev bypass mode */
function mockProcessTranscript(
  transcript: string,
  ctx: OnboardingStepContext,
): OnboardingVoiceResult {
  const t = transcript.toLowerCase().trim();

  // Step 1: Demographics
  if (ctx.step === 1) {
    // Extract nickname (first word or name-like pattern)
    const nameMatch = t.match(/(?:i'm|im|i am|call me|name is|my name's)\s+(\w+)/i);
    const nickname = nameMatch ? nameMatch[1] : transcript.split(/[\s,]+/)[0];

    // Match age range
    const ageRange = ctx.options.find((opt) => {
      const nums = opt.match(/\d+/g);
      if (!nums) return false;
      return nums.some((n) => t.includes(n));
    });

    // Match gender
    const gender =
      t.includes('male') && !t.includes('female')
        ? 'Male'
        : t.includes('female')
          ? 'Female'
          : t.includes('other')
            ? 'Other'
            : null;

    if (nickname) {
      return {
        success: true,
        action: 'onboarding_select',
        params: {
          nickname: nickname.charAt(0).toUpperCase() + nickname.slice(1),
          ...(ageRange ? { ageRange } : {}),
          ...(gender ? { gender } : {}),
        },
        message: `Nice to meet you, ${nickname.charAt(0).toUpperCase() + nickname.slice(1)}! Let's get started on building your routine.`,
        confidence: 0.85,
      };
    }
  }

  // Step 2: Path selection
  if (ctx.step === 2) {
    if (
      t.includes('step') ||
      t.includes('guide') ||
      t.includes('simple') ||
      t.includes('beginner')
    ) {
      return {
        success: true,
        action: 'onboarding_select',
        params: { path: 'simple' },
        message: "Great! Let's take it one step at a time.",
        confidence: 0.9,
      };
    }
    if (t.includes('brain') || t.includes('dump') || t.includes('tell') || t.includes('advanced')) {
      return {
        success: true,
        action: 'onboarding_select',
        params: { path: 'braindump' },
        message: "Awesome. Let's jump right in.",
        confidence: 0.9,
      };
    }
  }

  // Step 3: Category
  if (ctx.step === 3) {
    const match = ctx.options.find((opt) => t.includes(opt.toLowerCase().split(' ')[0]));
    if (match) {
      return {
        success: true,
        action: 'onboarding_select',
        params: { category: match },
        message: `${match} is a great choice. Let's dive into that.`,
        confidence: 0.85,
      };
    }
  }

  // Step 4: Goals
  if (ctx.step === 4) {
    const matched = ctx.options.filter((opt) =>
      opt
        .toLowerCase()
        .split(' ')
        .some((word) => word.length > 3 && t.includes(word)),
    );
    if (matched.length > 0) {
      return {
        success: true,
        action: 'onboarding_select',
        params: { goals: matched.slice(0, 2) },
        message: `${matched[0]} is the foundation of everything.`,
        confidence: 0.8,
      };
    }
  }

  // Step 5: Habits
  if (ctx.step === 5) {
    const matched = ctx.options.filter((opt) =>
      opt
        .toLowerCase()
        .split(' ')
        .some((word) => word.length > 3 && t.includes(word)),
    );
    if (matched.length > 0) {
      return {
        success: true,
        action: 'onboarding_select',
        params: { habits: matched.slice(0, 2) },
        message: "Perfect choice. Let's set up the details.",
        confidence: 0.8,
      };
    }
  }

  // Step 6: Reflection schedule
  if (ctx.step === 6) {
    const timeMatch = t.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/i);
    let time: string | undefined;
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (timeMatch[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
      time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    const schedule =
      t.includes('every') || t.includes('daily')
        ? 'Every day'
        : t.includes('weekend')
          ? 'Weekend'
          : 'Weekday';
    return {
      success: true,
      action: 'onboarding_select',
      params: { schedule, ...(time ? { time } : {}) },
      message: `I'll prepare some thoughtful questions for you each day. Got it, scheduled for ${schedule.toLowerCase()}.`,
      confidence: 0.8,
    };
  }

  // Fuzzy match any option
  const fuzzyMatch = ctx.options.find((opt) => {
    const words = opt.toLowerCase().split(/\s+/);
    return words.some((w) => w.length > 3 && t.includes(w));
  });
  if (fuzzyMatch) {
    return {
      success: true,
      action: 'onboarding_select',
      params: { selection: fuzzyMatch },
      message: `Got it — ${fuzzyMatch}.`,
      confidence: 0.7,
    };
  }

  return {
    success: false,
    action: 'error',
    params: {},
    message: "I didn't quite get this. can you please answer again?",
    confidence: 0.3,
  };
}

/**
 * Hook for processing transcripts in onboarding steps.
 * Calls /api/process-command with onboarding-specific context.
 * In bypass mode, uses a local mock parser instead.
 */
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

      // In bypass mode, use local mock instead of hitting the remote API
      if (IS_BYPASS) {
        // Simulate a small delay like real API
        await new Promise((r) => setTimeout(r, 500));
        return mockProcessTranscript(transcript, stepContext);
      }

      try {
        const response = await fetch('/api/process-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            message: "I didn't quite get this. can you please answer again?",
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
