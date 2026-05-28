import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchScreenRoutes } from '@/api/context';
import { parseOnboardingInput } from '@/api/onboarding';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import {
  getOnboardingOpener,
  getOnboardingRevisitOpener,
} from '@/components/onboarding/onboardingOpeners';
import { DualButton } from '@/components/ui/DualButton';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import {
  useOnboardingVoice as useOnboardingVoiceSession,
  useOnboardingTranscripts,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { useAuth } from '@/hooks/useAuth';
import { useChatSession } from '@/hooks/useChatSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useLLM } from '@/hooks/useLLM';
import { STEP_TO_SCREEN_ID } from '@/hooks/useOnboarding';
import {
  useOnboardingVoice,
  type OnboardingStepContext,
  type OnboardingVoiceResult,
} from '@/hooks/useOnboardingVoice';
import { useState3VoiceInput } from '@/hooks/useState3VoiceInput';
import { orbStateFrom } from '@/lib/orb/orbState';
import { routeOrbSend } from '@/lib/orb/routeOrbSend';
import { queryKeys } from '@/lib/query';
import { speak, stopTTS } from '@/lib/services/tts-service';
import type { OnboardingState } from '@shared/types';

export type { VoiceMessage };

interface OnboardingChatOverlayProps {
  stepContext: OnboardingStepContext;
  onAction: (result: OnboardingVoiceResult) => void;
  onAdvance?: () => void;
  autoAdvance?: boolean;
  onClose: () => void;
}

const ADVANCE_DELAY_MS = 800;

const REVISIT_NUDGE =
  'Sure — just tell me the new value (like “my age is 30”), or say “move on” to keep things as they are.';

const AFFIRMATION_TOKENS = new Set([
  'yes',
  'yep',
  'yeah',
  'yup',
  'sure',
  'ok',
  'okay',
  'sounds good',
  'looks good',
  'all good',
  'move on',
  'keep',
  'keep it',
  'keep going',
  'keep that',
  'next',
  'continue',
  'go on',
  "that's right",
  'correct',
  'done',
  'perfect',
]);
const AFFIRMATION_PHRASES = ['move on', 'looks good', 'sounds good'];
const NEGATION_TOKENS = ['no', 'nope', 'nah', 'not', 'change', 'wrong', 'edit', 'switch'];

// Revisit "move on" intent. Conservative: anything with a negation falls
// through to the parser so edits never auto-advance.
function isAffirmation(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
    .trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/);
  if (words.some((w) => NEGATION_TOKENS.includes(w))) return false;
  if (AFFIRMATION_TOKENS.has(cleaned)) return true;
  return AFFIRMATION_PHRASES.some((p) => cleaned.includes(p));
}

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

export function OnboardingChatOverlay({
  stepContext,
  onAction,
  onAdvance,
  autoAdvance = false,
  onClose,
}: OnboardingChatOverlayProps) {
  const { user } = useAuth();
  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || undefined;
  const {
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();
  const { processTranscript } = useOnboardingVoice();
  const onboardingVoiceSession = useOnboardingVoiceSession();
  const vapiActive = onboardingVoiceSession?.status === 'active';
  const isAssistantSpeaking = onboardingVoiceSession?.isAssistantSpeaking ?? false;
  const isUserSpeaking = onboardingVoiceSession?.isUserSpeaking ?? false;
  const sessionMessages = onboardingVoiceSession?.messages;
  const messages = useMemo(() => sessionMessages ?? [], [sessionMessages]);
  const appendMessage = onboardingVoiceSession!.appendMessage;
  const startThread = onboardingVoiceSession!.startThread;
  const [isProcessing, setIsProcessing] = useState(false);
  const [draft, setDraft] = useState('');
  const [partialAssistant, setPartialAssistant] = useState('');

  const orbState = orbStateFrom(voiceChosen, micRuntimeOn);
  const isVapi = orbState === 'vapi';
  const isVoiceOutOnly = orbState === 'voice_out_only';
  const isVoiceInOnly = orbState === 'voice_in_only';
  const isOverlayDriven = !isVapi;
  // Prefer the canonical screen_id (matches onboardingPrompt vocab + opener keys).
  const screenId =
    stepContext.screen_id ??
    STEP_TO_SCREEN_ID[stepContext.step] ??
    `ONBOARD-${String(stepContext.step).padStart(2, '0')}`;
  const isOnboardingScreen = screenId.startsWith('ONBOARD-');
  const { chatSessionId, initialMessages, status: sessionStatus } = useChatSession(screenId);
  const llm = useLLM(screenId, {
    coachingStyle: 'warm',
    chatSessionId: chatSessionId ?? undefined,
    initialMessages,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: routesData } = useQuery({
    queryKey: ['screenRoutes'],
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
    enabled: isOverlayDriven,
  });
  const firedToolEventIdsRef = useRef<Set<string>>(new Set());
  const mirroredIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef<string>('');
  const openerFiredScreensRef = useRef<Set<string>>(new Set());

  // Frozen at mount (overlay is key={currentStep}). Warm cache snapshot, not
  // page-local state — prefill hydrates after this child's first render.
  const revisitOpenerRef = useRef<string | null | undefined>(undefined);
  if (revisitOpenerRef.current === undefined) {
    const onboardingState =
      queryClient.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null;
    revisitOpenerRef.current = getOnboardingRevisitOpener(screenId, onboardingState) ?? null;
  }
  const landedComplete = revisitOpenerRef.current !== null;
  // Latest onAdvance — deferred advance must fire the page's fresh handleNext.
  const onAdvanceRef = useRef(onAdvance);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(advanceTimerRef.current), []);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, llm.response, llm.isStreaming, partialAssistant]);

  useOnboardingTranscripts((evt) => {
    if (evt.role !== 'assistant') return;
    if (evt.kind === 'partial') setPartialAssistant(evt.text);
    else setPartialAssistant('');
  }, isVapi);

  // Drop any lingering partial when Vapi disconnects.
  useEffect(() => {
    if (!vapiActive) setPartialAssistant('');
  }, [vapiActive]);

  const handleSendTextRef = useRef<(t: string) => void>(() => {});
  const { isListeningLocal } = useState3VoiceInput({
    active: isVoiceInOnly,
    vapiStatus: onboardingVoiceSession?.status ?? null,
    onTranscript: (t) => handleSendTextRef.current(t),
  });

  // Speaker-state derivation drives the gradient and the in-overlay dual
  // button rings. Idle gradient = blue, listening gradient = yellow.
  const voiceState: 'speaking' | 'listening' | 'idle' = isAssistantSpeaking
    ? 'speaking'
    : isUserSpeaking || isListeningLocal
      ? 'listening'
      : 'idle';

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleToggleMic = useCallback(() => {
    if (!micAllowed) return;
    toggleMic();
  }, [micAllowed, toggleMic]);

  const handleRequestMic = useCallback(() => {
    void requestMicPermission();
  }, [requestMicPermission]);

  const runAssistant = useCallback(
    (userText: string) => {
      setIsProcessing(true);
      processTranscript(userText, stepContext)
        .then((result) => {
          appendMessage({ id: `assistant-${Date.now()}`, role: 'ai', text: result.message });
          if (result.success) onAction(result);
        })
        .catch(() => {
          appendMessage({
            id: `error-${Date.now()}`,
            role: 'ai',
            text: 'Sorry, something went wrong. Please try again.',
          });
        })
        .finally(() => setIsProcessing(false));
    },
    [processTranscript, stepContext, onAction, appendMessage],
  );

  const isVoiceOutOnlyRef = useRef(isVoiceOutOnly);
  useEffect(() => {
    isVoiceOutOnlyRef.current = isVoiceOutOnly;
  }, [isVoiceOutOnly]);

  const runOnboardingTurn = useCallback(
    async (text: string) => {
      if (landedComplete && isAffirmation(text)) {
        appendMessage({ id: `ai-${Date.now()}`, role: 'ai', text: 'Great — moving on.' });
        if (isVoiceOutOnlyRef.current) void speak('Great — moving on.');
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => onAdvanceRef.current?.(), ADVANCE_DELAY_MS);
        return;
      }
      setIsProcessing(true);
      try {
        const res = await parseOnboardingInput(
          screenId,
          text,
          stepContext.options ?? [],
          stepContext.filled_fields ?? {},
          stepContext.step,
        );
        let appliedField = false;
        for (const a of res.actions) {
          if (a.action === 'navigate_next' || a.action === 'confirm_plan' || a.action === 'error') {
            continue;
          }
          appliedField = true;
          onAction({
            success: true,
            action: a.action,
            params: a.params,
            message: res.message,
            confidence: 1,
          });
        }
        // Complete screen + no edit → engine has nothing to collect and tends
        // to improvise; invite the concrete change instead of looping.
        if (landedComplete && !appliedField) {
          appendMessage({ id: `ai-${Date.now()}`, role: 'ai', text: REVISIT_NUDGE });
          if (isVoiceOutOnlyRef.current) void speak(REVISIT_NUDGE);
        } else if (res.message) {
          appendMessage({ id: `ai-${Date.now()}`, role: 'ai', text: res.message });
          if (isVoiceOutOnlyRef.current) void speak(res.message);
        }
        if (autoAdvance && appliedField) {
          clearTimeout(advanceTimerRef.current);
          advanceTimerRef.current = setTimeout(() => onAdvanceRef.current?.(), ADVANCE_DELAY_MS);
        }
      } catch {
        appendMessage({
          id: `err-${Date.now()}`,
          role: 'ai',
          text: 'Sorry, something went wrong. Please try again.',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [screenId, stepContext, onAction, appendMessage, autoAdvance, landedComplete],
  );

  const handleSendText = useCallback(
    (text: string) => {
      const action = routeOrbSend({
        orbState,
        isOnboardingScreen,
        isProcessing,
        isStreaming: llm.isStreaming,
      });
      if (action === 'noop') return;
      appendMessage({ id: `user-${Date.now()}`, role: 'user', text });
      if (action === 'vapi') runAssistant(text);
      else if (action === 'onboarding') void runOnboardingTurn(text);
      else void llm.sendMessage(text);
    },
    [
      orbState,
      isOnboardingScreen,
      llm,
      isProcessing,
      appendMessage,
      runOnboardingTurn,
      runAssistant,
    ],
  );

  useEffect(() => {
    handleSendTextRef.current = handleSendText;
  });

  useEffect(() => {
    if (!isOverlayDriven) return;
    for (const m of llm.messages) {
      if (m.role !== 'assistant' && m.role !== 'user') continue;
      if (mirroredIdsRef.current.has(m.id)) continue;
      if (!m.content) continue;
      mirroredIdsRef.current.add(m.id);
      appendMessage({
        id: `llm-${m.id}`,
        role: m.role === 'assistant' ? 'ai' : 'user',
        text: m.content,
      });
      if (m.role === 'assistant' && isVoiceOutOnlyRef.current) void speak(m.content);
    }
  }, [isOverlayDriven, llm.messages, appendMessage]);

  useEffect(() => {
    if (!isOverlayDriven || !llm.error) return;
    const msg = llm.error.message;
    if (msg === lastLlmErrorRef.current) return;
    lastLlmErrorRef.current = msg;
    appendMessage({ id: `llm-error-${Date.now()}`, role: 'ai', text: msg });
  }, [isOverlayDriven, llm.error, appendMessage]);

  // Tool-call side effects; get_user_context / log_event are server-only.
  useEffect(() => {
    if (!isOverlayDriven) return;
    for (const evt of llm.toolEvents) {
      if (!evt.result?.ok) continue;
      if (firedToolEventIdsRef.current.has(evt.id)) continue;
      firedToolEventIdsRef.current.add(evt.id);
      switch (evt.name) {
        case 'navigate_next': {
          const target = (evt.args as { target_screen?: unknown }).target_screen;
          if (typeof target !== 'string') break;
          const route = routesData?.routes.find((r) => r.screen_id === target)?.route;
          if (route) navigate(route);
          else console.warn('[onboarding] navigate_next: unknown target_screen', target);
          break;
        }
        case 'update_profile': {
          void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });
          break;
        }
        default:
          break;
      }
    }
  }, [isOverlayDriven, llm.toolEvents, navigate, queryClient, routesData]);

  // Abort in-flight llm stream when Vapi takes over.
  useEffect(() => {
    if (isOverlayDriven) return;
    if (llm.isStreaming) llm.cancel();
  }, [isOverlayDriven, llm]);

  // Kill any in-flight TTS when leaving State 2.
  useEffect(() => {
    if (isVoiceOutOnly) return;
    stopTTS();
  }, [isVoiceOutOnly]);

  // Reset to a fresh per-screen thread before paint so the prior screen's
  // bubbles never bleed through. Seeds empty when a screen has no opener.
  useLayoutEffect(() => {
    if (!isOverlayDriven || !isOnboardingScreen) return;
    const opener = revisitOpenerRef.current ?? getOnboardingOpener(screenId);
    startThread(
      screenId,
      opener ? [{ id: `opener-${screenId}`, role: 'ai', text: opener }] : [],
    );
  }, [isOverlayDriven, isOnboardingScreen, screenId, startThread]);

  const initialMessagesLength = initialMessages.length;
  const llmMessagesLength = llm.messages.length;
  const sendOpener = llm.sendOpener;
  useEffect(() => {
    if (!isOverlayDriven || isOnboardingScreen) return;
    if (openerFiredScreensRef.current.has(screenId)) return;
    if (sessionStatus !== 'ready') return;
    if (!chatSessionId) return;
    if (initialMessagesLength > 0 || llmMessagesLength > 0) return;
    openerFiredScreensRef.current.add(screenId);
    void sendOpener();
  }, [
    isOverlayDriven,
    isOnboardingScreen,
    screenId,
    sessionStatus,
    chatSessionId,
    initialMessagesLength,
    llmMessagesLength,
    sendOpener,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const scrollTop = e.currentTarget.scrollTop;
    if (deltaY > 100 && scrollTop <= 0) handleClose();
    touchStartY.current = null;
  };

  const gradient = voiceState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT;
  const dualActiveRings: 'left' | 'right' | null =
    micRuntimeOn && (isUserSpeaking || isListeningLocal)
      ? 'right'
      : voiceChosen && isAssistantSpeaking
        ? 'left'
        : null;

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-up flex-col">
      <div className="absolute inset-0 bg-white" />
      <div
        className="absolute inset-0 backdrop-blur-[50px]"
        style={{ backgroundImage: gradient, transition: 'background-image 300ms ease-out' }}
      />

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close chat"
        className="absolute right-6 z-30 flex items-center gap-1.5 text-[12px] font-semibold leading-[16px] text-content"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span>Close chat</span>
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pt-[64px]"
        style={{
          paddingBottom: 'calc(240px + max(48px, env(safe-area-inset-bottom)))',
          maskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <ChatBubble
              role={msg.role}
              text={msg.text}
              userName={displayName}
              eyebrowVariant="dark"
              compact
            />
          </div>
        ))}
        {isOverlayDriven && llm.isStreaming && llm.response.length > 0 && (
          <ChatBubble
            role="ai"
            text={llm.response}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
          />
        )}
        {isVapi && partialAssistant.length > 0 && (
          <ChatBubble
            role="ai"
            text={partialAssistant}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
          />
        )}
        {(isProcessing || (isOverlayDriven && llm.isStreaming && llm.response.length === 0)) && (
          <TypingIndicator />
        )}
        <div ref={scrollAnchorRef} />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto">
          <DualButton
            size={91}
            leftActive={voiceChosen}
            rightActive={micRuntimeOn}
            activeRings={dualActiveRings}
            ringCount={3}
            ringStep={4}
            leftIcon={voiceChosen ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
            rightIcon={micRuntimeOn ? <IconMic size={26} /> : <IconMicMuted size={26} />}
            onLeftClick={toggleVoice}
            onRightClick={micAllowed ? handleToggleMic : handleRequestMic}
            leftAriaLabel={voiceChosen ? 'Switch to screen mode' : 'Switch to voice mode'}
            rightAriaLabel={
              !micAllowed ? 'Allow microphone' : micRuntimeOn ? 'Turn mic off' : 'Turn mic on'
            }
          />
        </div>

        <ChatComposer
          value={draft}
          onValueChange={setDraft}
          onSubmit={handleSendText}
          disabled={isOverlayDriven ? isProcessing || llm.isStreaming : isProcessing}
          className="pointer-events-auto flex h-[44px] w-full items-center gap-2 rounded-full bg-white pl-5 pr-3 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
        />
      </div>
    </div>
  );
}
