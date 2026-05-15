import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchScreenRoutes } from '@/api/context';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useLLM } from '@/hooks/useLLM';
import { STEP_TO_SCREEN_ID } from '@/hooks/useOnboarding';
import {
  useOnboardingVoice,
  type OnboardingStepContext,
  type OnboardingVoiceResult,
} from '@/hooks/useOnboardingVoice';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, stopTTS, unlockTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { queryKeys } from '@/lib/query';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

interface OnboardingChatOverlayProps {
  stepContext: OnboardingStepContext;
  onAction: (result: OnboardingVoiceResult) => void;
  onClose: () => void;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
}

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

export function OnboardingChatOverlay({
  stepContext,
  onAction,
  onClose,
  messages,
  setMessages,
}: OnboardingChatOverlayProps) {
  const { user } = useAuth();
  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || undefined;
  const { preferences, updatePreferences } = useUserPreferences();
  const voiceChosen = preferences.voiceMode === 'voice';
  const micAllowed = preferences.micPermission === true;
  const micRuntimeOn = micAllowed && preferences.micEnabled === true;
  const [requestingMic, setRequestingMic] = useState(false);
  const { isListening, transcript, interim, toggle, error, resetTranscript } = useVoiceInput();
  const { processTranscript } = useOnboardingVoice();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draft, setDraft] = useState('');
  const lastErrorRef = useRef('');
  const processedTranscriptRef = useRef('');

  // Path 3 active when both orbs off.
  const textOnlyMode = !voiceChosen && !micRuntimeOn;
  const screenId =
    STEP_TO_SCREEN_ID[stepContext.step] ?? `ONBOARD-${String(stepContext.step).padStart(2, '0')}`;
  const llm = useLLM(screenId, { coachingStyle: 'warm' });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: routesData } = useQuery({
    queryKey: ['screenRoutes'],
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
    enabled: textOnlyMode,
  });
  const firedToolEventIdsRef = useRef<Set<string>>(new Set());
  const mirroredAssistantIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef<string>('');

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, llm.response, llm.isStreaming]);

  useEffect(() => {
    if (!error || error === lastErrorRef.current) return;
    lastErrorRef.current = error;
    setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'ai', text: error }]);
  }, [error, setMessages]);

  const voiceState = isProcessing ? 'processing' : isListening ? 'listening' : 'idle';

  const handleClose = useCallback(() => {
    if (isListening) toggle();
    resetTranscript();
    onClose();
  }, [isListening, toggle, onClose, resetTranscript]);

  const handleToggleVoice = useCallback(() => {
    const next = !voiceChosen;
    if (!next) stopTTS();
    void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: next });
  }, [voiceChosen, updatePreferences]);

  const handleToggleMic = useCallback(() => {
    if (!micAllowed) return;
    const turningOn = !micRuntimeOn;
    if (turningOn) {
      unlockTTS();
      stopTTS();
      processedTranscriptRef.current = '';
    }
    void updatePreferences({ micEnabled: turningOn });
  }, [micAllowed, micRuntimeOn, updatePreferences]);

  const handleRequestMic = useCallback(async () => {
    if (requestingMic) return;
    setRequestingMic(true);
    let granted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      granted = false;
    }
    await updatePreferences({ micPermission: granted, micEnabled: granted });
    if (granted) unlockTTS();
    setRequestingMic(false);
  }, [requestingMic, updatePreferences]);

  useEffect(() => {
    if (!micRuntimeOn) {
      if (isListening) toggle();
      return;
    }
    if (!isListening && !isProcessing && !isSpeaking) {
      const timer = setTimeout(() => {
        if (!useTtsPlaybackStore.getState().isSpeaking && !isProcessing) {
          unlockTTS();
          toggle();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [micRuntimeOn, isListening, isProcessing, isSpeaking, toggle]);

  const runAssistant = useCallback(
    (userText: string) => {
      setIsProcessing(true);
      processTranscript(userText, stepContext)
        .then((result) => {
          setMessages((prev) => [
            ...prev,
            { id: `assistant-${Date.now()}`, role: 'ai', text: result.message },
          ]);
          if (voiceChosen) speak(result.message);
          if (result.success) onAction(result);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'ai',
              text: 'Sorry, something went wrong. Please try again.',
            },
          ]);
        })
        .finally(() => setIsProcessing(false));
    },
    [processTranscript, stepContext, onAction, setMessages, voiceChosen],
  );

  useEffect(() => {
    if (
      micRuntimeOn &&
      !isListening &&
      transcript &&
      !isProcessing &&
      transcript !== processedTranscriptRef.current
    ) {
      processedTranscriptRef.current = transcript;
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', text: transcript },
      ]);
      resetTranscript();
      runAssistant(transcript);
    }
  }, [
    micRuntimeOn,
    isListening,
    transcript,
    isProcessing,
    resetTranscript,
    setMessages,
    runAssistant,
  ]);

  const handleSendText = useCallback(
    (text: string) => {
      if (textOnlyMode) {
        if (llm.isStreaming) return;
        setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', text }]);
        void llm.sendMessage(text);
        return;
      }
      if (isProcessing) return;
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', text }]);
      runAssistant(text);
    },
    [textOnlyMode, llm, isProcessing, setMessages, runAssistant],
  );

  // Mirror finalized llm assistant turns into parent messages.
  useEffect(() => {
    if (!textOnlyMode) return;
    for (const m of llm.messages) {
      if (m.role !== 'assistant') continue;
      if (mirroredAssistantIdsRef.current.has(m.id)) continue;
      if (!m.content) continue;
      mirroredAssistantIdsRef.current.add(m.id);
      setMessages((prev) => [...prev, { id: `llm-${m.id}`, role: 'ai', text: m.content }]);
    }
  }, [textOnlyMode, llm.messages, setMessages]);

  useEffect(() => {
    if (!textOnlyMode || !llm.error) return;
    const msg = llm.error.message;
    if (msg === lastLlmErrorRef.current) return;
    lastLlmErrorRef.current = msg;
    setMessages((prev) => [...prev, { id: `llm-error-${Date.now()}`, role: 'ai', text: msg }]);
  }, [textOnlyMode, llm.error, setMessages]);

  // Tool-call side effects; get_user_context / log_event are server-only.
  useEffect(() => {
    if (!textOnlyMode) return;
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
  }, [textOnlyMode, llm.toolEvents, navigate, queryClient, routesData]);

  // Abort in-flight llm stream on switch to voice/mic-on.
  useEffect(() => {
    if (textOnlyMode) return;
    if (llm.isStreaming) llm.cancel();
  }, [textOnlyMode, llm]);

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
  const activeRings = voiceState === 'listening' ? 'right' : isSpeaking ? 'left' : null;
  const currentRms = useAudioMetricsStore((s) => s.currentRms);
  const micIntensity = isListening ? Math.min(currentRms / 0.05, 1) : undefined;
  const showInputPill = !micRuntimeOn;

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
        {textOnlyMode && llm.isStreaming && llm.response.length > 0 && (
          <ChatBubble
            role="ai"
            text={llm.response}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
          />
        )}
        {(voiceState === 'processing' ||
          (textOnlyMode && llm.isStreaming && llm.response.length === 0)) && <TypingIndicator />}
        {interim && (
          <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-content-secondary">
            {interim}
          </p>
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
            activeRings={micRuntimeOn ? activeRings : null}
            intensity={micRuntimeOn ? micIntensity : undefined}
            ringCount={3}
            ringStep={4}
            leftIcon={voiceChosen ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
            rightIcon={micRuntimeOn ? <IconMic size={26} /> : <IconMicMuted size={26} />}
            onLeftClick={handleToggleVoice}
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
          disabled={(textOnlyMode ? llm.isStreaming : isProcessing) || !showInputPill}
          ariaHidden={!showInputPill}
          tabbable={showInputPill}
          className={`flex h-[44px] w-full items-center gap-2 rounded-full bg-white pl-5 pr-3 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)] transition-all duration-300 ease-out ${
            showInputPill
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-3 opacity-0'
          }`}
        />
      </div>
    </div>
  );
}
