import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { ReflectionModeEditor } from '@/components/onboarding/ReflectionModeEditor';
import {
  useOnboardingVoice,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { useStepTiming } from '../shared/useStepTiming';

type JournalMode = 'freeform' | 'custom';

interface LocationState {
  habitConfigs?: Array<{ name: string; days: number[] }>;
  customPrompts?: string[];
  journalMode?: JournalMode;
}

function deserializePrompts(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    return value
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function AdvancedCustomPromptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const onboardingVoice = useOnboardingVoice();
  const state = location.state as LocationState | null;

  useAgentNavigation(5, '/onboarding/advanced-step-6');

  // Vapi + Direct-LLM context for the custom-prompts screen.
  useEffect(() => {
    if (!onboardingVoice) return;
    onboardingVoice.pushSubScreen('ONBOARD-ADV-CUSTOM');
    return () => onboardingVoice.pushSubScreen(null);
  }, [onboardingVoice]);
  const trackStepComplete = useStepTiming(7, 'custom_prompts', 'advanced');

  const [journalMode, setJournalMode] = useState<JournalMode>(state?.journalMode ?? 'custom');
  const [prompts, setPrompts] = useState<string[]>(
    state?.customPrompts?.length ? state.customPrompts : [],
  );

  useEffect(() => {
    const incoming = onboardingState?.data?.customPrompts;
    const list = deserializePrompts(incoming);
    if (list.length > 0) {
      setPrompts((prev) => (prev.length === 0 ? list : prev));
      if (list.length > 0) setJournalMode('custom');
    }
  }, [onboardingState?.data?.customPrompts]);

  const filledPrompts = prompts.filter((p) => p.trim().length > 0);
  const canSubmit = journalMode === 'freeform' || filledPrompts.length >= 1;

  const snapshot = useOnboardingFormSnapshot({
    customPrompts: filledPrompts.length > 0 ? filledPrompts : undefined,
  });

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action !== 'fill_field') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (typeof p.fieldName !== 'string' || typeof p.value !== 'string') return;
    const m = p.fieldName.match(/^customPrompts\[(\d+)\]$/);
    if (!m) return;
    const idx = parseInt(m[1], 10);
    setPrompts((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push('');
      next[idx] = p.value!;
      return next;
    });
    setJournalMode('custom');
  }, []);

  const handleDone = useCallback(async () => {
    // Persist the mode choice so onboarding-complete can materialize it.
    // 'custom' is the prompts mode with a user-defined list.
    await saveStepAsync(5, {
      reflectionMode: journalMode === 'freeform' ? 'freeform' : 'prompts',
      customPrompts: journalMode === 'custom' ? filledPrompts : undefined,
    });
    trackStepComplete();
    navigate('/onboarding/advanced-step-6', {
      state: {
        habitConfigs: state?.habitConfigs,
        customPrompts: journalMode === 'custom' ? filledPrompts : undefined,
        journalMode,
      },
    });
  }, [navigate, state?.habitConfigs, journalMode, filledPrompts, trackStepComplete, saveStepAsync]);

  return (
    <OnboardingLayout
      screenId="ONBOARD-ADV-CUSTOM"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      onBack={() =>
        navigate('/onboarding/advanced-step-6', { state: { habitConfigs: state?.habitConfigs } })
      }
      onNext={handleDone}
      ctaDisabled={!canSubmit}
      showVoiceButton
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="How do you want to reflect?"
        subtitle="Choose guided questions, create your own, or just talk freely."
      />

      <ReflectionModeEditor
        mode={journalMode === 'freeform' ? 'freeform' : 'prompts'}
        onModeChange={(m) => setJournalMode(m === 'freeform' ? 'freeform' : 'custom')}
        prompts={prompts}
        onPromptsChange={setPrompts}
      />
    </OnboardingLayout>
  );
}
