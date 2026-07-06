/**
 * FlowVoiceControls, the in-page voice orb for the chat-native flow renderer.
 *
 * On the flow routes (/onboarding/flow and /onboarding-flow-preview) the
 * OnboardingVoiceProvider suppresses its floating OnboardingChatOverlay (it
 * keys off onChatPage), so the PAGE must render the orb itself. The flow
 * renderer is already the chat surface (beat cards in a scrolling feed), so we
 * do NOT mount the full-screen OnboardingChatOverlay here, which would replace
 * the beat flow with the old single-stream chat. Instead this reuses the same
 * OrbControls component and the same provider wiring the overlay uses, floating
 * the orb at the bottom over the beat flow.
 *
 * Wiring mirrors OnboardingChatOverlay's orb section:
 *   - useDualButtonControls drives the voice/mic toggles + mic-permission request.
 *   - useOnboardingVoice exposes the live Vapi session (speaking flags, status).
 *   - useMicVoiceActivity drives the ring pulse in voice-in-only mode.
 * The provider owns the actual voice loop (Vapi / Soniox -> LLM); this component
 * only renders the control and forwards the toggles.
 */
import { useCallback } from 'react';
import { OrbControls } from '@/components/voice/OrbControls';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { useCoachVoiceActivity } from '@/hooks/useCoachVoiceActivity';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { orbStateFrom } from '@/lib/orb/orbState';

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0) 60%, rgba(255,255,255,0) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0) 60%, rgba(255,255,255,0) 100%)';

export function FlowVoiceControls() {
  const {
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();
  const session = useOnboardingVoice();

  const vapiActive = session?.status === 'active';
  const isAssistantSpeaking = session?.isAssistantSpeaking ?? false;
  const isUserSpeaking = session?.isUserSpeaking ?? false;
  const voiceInListening = session?.voiceInListening ?? false;
  const assistantVolumeLevel = session?.assistantVolumeLevel ?? 0;
  const userAudioLevel = session?.userAudioLevel ?? 0;

  const isVoiceInOnly = orbStateFrom(voiceChosen, micRuntimeOn) === 'voice_in_only';
  // Soniox-fed RMS (audioMetricsStore) only ever runs in voice-in-only mode —
  // it never runs while Vapi owns the mic (see OnboardingVoiceProvider's
  // voiceInShouldBeLive). During a real Vapi call (full 'vapi' engine state,
  // both voice + mic on) userAudioLevel (Daily's local-audio-level observer,
  // wired in useRealtimeVoice, B51) is the only live signal, so it's used
  // whenever the Soniox path isn't the active one.
  const { intensity: sonioxMicIntensity, speaking: micSpeaking } = useMicVoiceActivity(
    isVoiceInOnly && voiceInListening,
  );
  const micRingIntensity = isVoiceInOnly ? sonioxMicIntensity : userAudioLevel;
  const { intensity: coachIntensity } = useCoachVoiceActivity(
    isAssistantSpeaking,
    assistantVolumeLevel,
  );

  const handleToggleMic = useCallback(() => {
    if (!micAllowed) return;
    toggleMic();
  }, [micAllowed, toggleMic]);

  const handleRequestMic = useCallback(() => {
    void requestMicPermission();
  }, [requestMicPermission]);

  // Idle gradient = blue, listening gradient = yellow (mirrors the overlay).
  const voiceState: 'speaking' | 'listening' | 'idle' = isAssistantSpeaking
    ? 'speaking'
    : isUserSpeaking || voiceInListening
      ? 'listening'
      : 'idle';
  const gradient = voiceState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT;

  const dualActiveRings: 'left' | 'right' | 'ready' | 'idle' | null =
    isVoiceInOnly && voiceInListening
      ? micSpeaking
        ? 'right'
        : 'ready'
      : micRuntimeOn && isUserSpeaking
        ? 'right'
        : voiceChosen && isAssistantSpeaking
          ? 'left'
          : vapiActive
            ? 'idle'
            : null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pt-[24px]"
      style={{
        paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        backgroundImage: gradient,
        transition: 'background-image 300ms ease-out',
      }}
    >
      <div className="pointer-events-auto">
        <OrbControls
          size={88}
          leftActive={voiceChosen}
          rightActive={micRuntimeOn}
          activeRings={dualActiveRings}
          ringCount={3}
          ringStep={4}
          intensity={micRingIntensity}
          coachIntensity={coachIntensity}
          micAllowed={micAllowed}
          onToggleVoice={toggleVoice}
          onToggleMic={handleToggleMic}
          onRequestMic={handleRequestMic}
        />
      </div>
    </div>
  );
}
