/**
 * Voice layer for the check-in beat overlay (Path 2). Mounts the documented
 * half-duplex coach loop (useCoachChat, muted) scoped to the overlay for STT →
 * extract → tool, speaks the scripted (rotated) openers + acks via Cartesia, and
 * bridges tool results onto a voice-action bus the beat adapters consume. The
 * beat engine stays the source of truth; voice advances only the short say-only
 * beats (greeting / are-you-done) via explicit spoken intents.
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

// V5 say-only intents, parsed from the user's final transcript on the short
// say-only beats (greeting / are-you-done). Data-card beats (state-check,
// habit-review) and the reflection beat advance by tap — never keyword-matched:
// reflection answers are substantive prose, so "nothing"/"quit" would misfire.
const RE_DECLINE = /\b(not now|cancel|close this|exit|never ?mind|quit)\b/i;
const RE_MORE = /\b(add|more|wait|one more|another|something else)\b/i;
const RE_DONE =
  /\b(done|no|nope|nothing|that'?s (it|all)|move on|all good|finished|ready|let'?s go)\b/i;

type IntentBeat = 'are-you-done' | 'say-advance' | null;
function intentBeatFor(node: FlowNode | undefined): IntentBeat {
  if (!node) return null;
  if (node.componentType === 'coach-bubble' && node.voice.expectsInput) {
    return node.id.includes('are-you-done') ? 'are-you-done' : 'say-advance';
  }
  return null;
}

export type CheckinIntent = 'advance' | 'back' | 'decline' | null;

// Pure intent routing for a say-only beat's final user transcript.
export function resolveCheckinIntent(node: FlowNode | undefined, text: string): CheckinIntent {
  const beat = intentBeatFor(node);
  if (!beat) return null;
  if (RE_DECLINE.test(text)) return 'decline';
  if (beat === 'are-you-done') {
    if (RE_MORE.test(text)) return 'back';
    return RE_DONE.test(text) ? 'advance' : null;
  }
  return RE_DONE.test(text) ? 'advance' : null;
}

export interface CheckinVoiceHandlers {
  advance: () => void;
  back: () => void;
  decline: () => void;
}

export function useCheckinVoice(
  currentNode: FlowNode | undefined,
  nickname: string | undefined,
  checkinScreenId: string,
  handlers?: CheckinVoiceHandlers,
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
      // Voice can only mark a habit done (no "missed" tool); not-done stays tap.
      if (evt.name === 'complete_habit' && r?.habit && typeof r.habit === 'object') {
        const h = r.habit as { id?: unknown; name?: unknown };
        busRef.current!.notify({
          success: true,
          action: 'complete_habit',
          params: { id: h.id, name: h.name, status: 'done' },
          message: '',
          confidence: 1,
        });
      }
      if (voiceOn && CARD_TOOLS.has(evt.name)) speak(pickVariation('acknowledgment'));
    },
    [voiceOn, speak],
  );

  // Intent parsing reads the live node + handlers at call time.
  const nodeRef = useRef(currentNode);
  nodeRef.current = currentNode;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const intentFiredForRef = useRef<string | null>(null);

  const onTranscriptStream = useCallback(
    (role: 'user' | 'assistant', text: string, kind: 'partial' | 'final') => {
      if (role !== 'user' || kind !== 'final') return;
      const node = nodeRef.current;
      const h = handlersRef.current;
      if (!node || !h || intentFiredForRef.current === node.id) return;
      const intent = resolveCheckinIntent(node, text);
      if (!intent) return;
      intentFiredForRef.current = node.id;
      if (intent === 'decline') h.decline();
      else if (intent === 'back') h.back();
      else h.advance();
    },
    [],
  );

  const coach = useCoachChat(checkinScreenId, {
    suppressLlmSpeech: true,
    suppressCheckinCompleted: true,
    overlayOpen: true,
    micMuted: speaking,
    onToolResult,
    onTranscriptStream,
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
    intentFiredForRef.current = null;
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
