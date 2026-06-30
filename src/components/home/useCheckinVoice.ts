/**
 * Voice layer for the check-in beat overlay (Path 2). Mounts the documented
 * half-duplex coach loop (useCoachChat, muted) scoped to the overlay for STT →
 * extract → tool, speaks the scripted (rotated) openers + acks via Cartesia, and
 * bridges tool results onto a voice-action bus the beat adapters consume. The
 * beat engine stays the source of truth; this never advances beats itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type OnboardingVoiceActionListener,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { useCoachChat } from '@/hooks/useCoachChat';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { acquireWakeLock, releaseWakeLock } from '@/lib/services/keepAwake';
import { createListenerBus, type ListenerBus } from '@/lib/util/listenerBus';
import { speakOpener, type SpeakOpenerHandle } from '@/lib/voice/speakOpener';
import { applyName } from '@/onboarding-flow/renderer/applyName';
import type { FlowNode } from '@/onboarding-flow/types';
import { pickVariation } from '@gg/shared/checkin/scriptVariations';
import type { LLMToolEvent } from '@gg/shared/types/llm';

const noopUnsub = () => () => {};
// Tools whose result warrants a spoken ack (the card-filling writes).
const CARD_TOOLS = new Set(['record_checkin', 'complete_habit', 'log_reflection']);

// Wire shape: useLLM wraps tool_result as { ok, payload: e.result }; the server
// ok() nests { ok, result }, so values live at payload.result.
function toolResultPayload(evt: LLMToolEvent): Record<string, unknown> | null {
  const payload = evt.result?.payload as { result?: Record<string, unknown> } | undefined;
  const r = payload?.result;
  return r && typeof r === 'object' ? r : null;
}

export function useCheckinVoice(
  currentNode: FlowNode | undefined,
  nickname: string | undefined,
  checkinScreenId: string,
): { value: OnboardingVoiceContextValue } {
  const { voiceOn } = useDualButtonControls();
  const [speaking, setSpeaking] = useState(false);
  const busRef = useRef<ListenerBus<OnboardingVoiceResult> | null>(null);
  if (busRef.current === null) busRef.current = createListenerBus('checkin-voice/voice-action');
  // Stable callback (reads the ref at call time) so the context value + memo
  // never touch busRef.current during render.
  const subscribeVoiceActions = useCallback(
    (l: OnboardingVoiceActionListener) => busRef.current!.subscribe(l),
    [],
  );

  const handleRef = useRef<SpeakOpenerHandle | null>(null);

  // Speak a scripted line. `speaking` is fed back to useCoachChat as micMuted,
  // so the mic is closed for the duration (speakOpener bypasses tts-service).
  const speak = useCallback((text: string) => {
    handleRef.current?.stop();
    if (!text.trim()) return;
    setSpeaking(true);
    const handle = speakOpener(text);
    handleRef.current = handle;
    void handle.done.then(() => {
      if (handleRef.current === handle) setSpeaking(false);
    });
  }, []);

  // Bridge each successful card tool result onto the action bus + speak an ack.
  const onToolResult = useCallback(
    (evt: LLMToolEvent) => {
      const r = toolResultPayload(evt);
      if (evt.name === 'record_checkin' && r?.checkin && typeof r.checkin === 'object') {
        busRef.current!.notify({
          success: true,
          action: 'record_checkin',
          params: { ...(r.checkin as Record<string, unknown>) },
          message: '',
          confidence: 1,
        });
      }
      if (voiceOn && CARD_TOOLS.has(evt.name)) speak(pickVariation('acknowledgment'));
    },
    [voiceOn, speak],
  );

  const coach = useCoachChat(checkinScreenId, {
    suppressLlmSpeech: true,
    suppressCheckinCompleted: true,
    overlayOpen: true,
    micMuted: speaking,
    onToolResult,
  });

  // Speak the active beat's opener once per beat.
  const spokenForRef = useRef<string | null>(null);
  const openerText = currentNode?.voice.openerText ?? null;
  useEffect(() => {
    if (!currentNode) {
      handleRef.current?.stop();
      setSpeaking(false);
      return;
    }
    if (spokenForRef.current === currentNode.id) return;
    spokenForRef.current = currentNode.id;
    if (voiceOn && openerText) speak(applyName(openerText, nickname));
    else setSpeaking(false);
  }, [currentNode, openerText, voiceOn, nickname, speak]);

  // Muting voice mid-speech stops playback immediately.
  useEffect(() => {
    if (!voiceOn) {
      handleRef.current?.stop();
      setSpeaking(false);
    }
  }, [voiceOn]);

  // Keep the screen awake for the duration of the check-in.
  useEffect(() => {
    void acquireWakeLock();
    return () => {
      handleRef.current?.stop();
      void releaseWakeLock();
    };
  }, []);

  const screenId = currentNode?.screenId ?? null;
  const value = useMemo<OnboardingVoiceContextValue>(
    () => ({
      status: 'idle',
      isAssistantSpeaking: speaking,
      isUserSpeaking: false,
      voiceInListening: coach.micListening,
      errorMessage: null,
      currentScreenId: screenId,
      overlayOpen: true,
      openOverlay: () => {},
      closeOverlay: () => {},
      messages: [],
      openerReveal: null,
      appendMessage: () => {},
      startThread: () => {},
      sendUserTurn: () => {},
      chatBusy: false,
      assistantMergeOpen: false,
      subscribeVoiceActions,
      registerScreen: () => {},
      registerAdvance: () => {},
      endCall: () => {},
      restartCall: async () => {},
      pushSubScreen: () => {},
      setFormSnapshot: () => {},
      subscribeTranscripts: noopUnsub,
      voiceCapReached: false,
      dismissVoiceCap: () => {},
    }),
    [speaking, screenId, subscribeVoiceActions, coach.micListening],
  );

  return { value };
}
