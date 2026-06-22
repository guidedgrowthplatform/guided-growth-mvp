import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { OrbControls } from '@/components/voice/OrbControls';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import {
  useOnboardingVoice as useOnboardingVoiceSession,
  useOnboardingTranscripts,
} from '@/contexts/useOnboardingVoiceSession';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
import { useStreamingReveal } from '@/hooks/useStreamingReveal';
import { orbStateFrom } from '@/lib/orb/orbState';

interface OnboardingChatOverlayProps {
  onClose: () => void;
}

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

// Direct-LLM + Vapi chat surface. The LLM session is owned by the provider
// (works overlay-open or closed); this component only renders + sends.
export function OnboardingChatOverlay({ onClose }: OnboardingChatOverlayProps) {
  const displayName = useDisplayName();
  const {
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();
  const onboardingVoiceSession = useOnboardingVoiceSession();
  const vapiActive = onboardingVoiceSession?.status === 'active';
  const isAssistantSpeaking = onboardingVoiceSession?.isAssistantSpeaking ?? false;
  const isUserSpeaking = onboardingVoiceSession?.isUserSpeaking ?? false;
  const voiceInListening = onboardingVoiceSession?.voiceInListening ?? false;
  const chatBusy = onboardingVoiceSession?.chatBusy ?? false;
  const assistantMergeOpen = onboardingVoiceSession?.assistantMergeOpen ?? false;
  const sessionMessages = onboardingVoiceSession?.messages;
  const messages = useMemo(() => sessionMessages ?? [], [sessionMessages]);

  const isVoiceInOnly = orbStateFrom(voiceChosen, micRuntimeOn) === 'voice_in_only';

  const [draft, setDraft] = useState('');
  const [partialAssistant, setPartialAssistant] = useState('');
  const [partialUser, setPartialUser] = useState('');
  // Vapi has no client-side tool-call events; this fills the user-stops → assistant-starts gap.
  const [waitingForAssistant, setWaitingForAssistant] = useState(false);
  const prevUserSpeakingRef = useRef(false);

  const displayedAssistant = useSmoothReveal(partialAssistant);
  const displayedUser = useSmoothReveal(partialUser);

  // Voice (Vapi) assistant turns arrive as sentence-sized chunks that snap into
  // the bubble. Reveal the whole in-progress turn (committed finals + live
  // partial) through one continuous, capped stream so it flows instead of pops.
  const lastMsg = messages[messages.length - 1];
  const lastIsAi = lastMsg?.role === 'ai';
  const voiceStreaming = vapiActive && (assistantMergeOpen || partialAssistant.length > 0);
  const committedActive = lastIsAi && voiceStreaming ? lastMsg.text : '';
  const activeTurnTarget = voiceStreaming
    ? `${committedActive} ${partialAssistant}`.replace(/\s+/g, ' ').trim()
    : '';
  const revealedTurn = useStreamingReveal(activeTurnTarget);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const touchStartY = useRef<number | null>(null);

  const handleScrollPin = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !pinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, chatBusy, displayedAssistant, displayedUser, revealedTurn]);

  // Coach text — partials stream from both Vapi and the Direct-LLM path; clears
  // on final (the final lands as a message bubble).
  useOnboardingTranscripts((evt) => {
    if (evt.role !== 'assistant') return;
    if (evt.kind === 'partial') setPartialAssistant(evt.text);
    else setPartialAssistant('');
  });

  useEffect(() => {
    if (!vapiActive) setPartialAssistant('');
  }, [vapiActive]);

  useEffect(() => {
    const userJustStopped = prevUserSpeakingRef.current && !isUserSpeaking;
    prevUserSpeakingRef.current = isUserSpeaking;
    if (userJustStopped) setWaitingForAssistant(true);
  }, [isUserSpeaking]);

  useEffect(() => {
    if (isAssistantSpeaking || partialAssistant.length > 0 || isUserSpeaking) {
      setWaitingForAssistant(false);
    }
  }, [isAssistantSpeaking, partialAssistant, isUserSpeaking]);

  useEffect(() => {
    if (!vapiActive) setWaitingForAssistant(false);
  }, [vapiActive]);

  useEffect(() => {
    if (!isVoiceInOnly) setPartialUser('');
  }, [isVoiceInOnly]);

  useOnboardingTranscripts((evt) => {
    if (evt.role !== 'user') return;
    if (evt.kind === 'partial') setPartialUser(evt.text);
    else setPartialUser('');
  }, isVoiceInOnly);

  const { intensity: micRingIntensity, speaking: micSpeaking } = useMicVoiceActivity(
    isVoiceInOnly && voiceInListening,
  );

  // Idle gradient = blue, listening gradient = yellow.
  const voiceState: 'speaking' | 'listening' | 'idle' = isAssistantSpeaking
    ? 'speaking'
    : isUserSpeaking || voiceInListening
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

  const handleSendText = useCallback(
    (text: string) => {
      onboardingVoiceSession?.sendUserTurn(text);
      setWaitingForAssistant(true);
    },
    [onboardingVoiceSession],
  );

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
        className="absolute right-6 z-30 flex items-center gap-1.5 text-[12px] font-semibold leading-[16px] text-slate-700"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span>Close chat</span>
        <X className="h-5 w-5" />
      </button>

      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 pt-[64px]"
        style={{
          paddingBottom: 'calc(240px + max(48px, env(safe-area-inset-bottom)))',
          maskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
        }}
        onScroll={handleScrollPin}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          // Voice active turn: the last AI bubble shows the continuously-revealed
          // turn text (committed finals + live partial) instead of snapping.
          const voiceActiveBubble = isLast && msg.role === 'ai' && voiceStreaming;
          const text = voiceActiveBubble ? revealedTurn || msg.text : msg.text;
          return (
            <div key={msg.id} className="flex flex-col">
              <ChatBubble
                role={msg.role}
                text={text}
                userName={displayName}
                eyebrowVariant="dark"
                compact
                animate={false}
                streaming={voiceActiveBubble}
                markdown
              />
            </div>
          );
        })}
        {/* Voice turn before its first final has committed (no AI bubble yet). */}
        {voiceStreaming && !lastIsAi && revealedTurn.length > 0 && (
          <ChatBubble
            role="ai"
            text={revealedTurn}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
            streaming
            markdown
          />
        )}
        {/* Typed (Direct-LLM) streaming bubble — voice uses revealedTurn above. */}
        {!vapiActive && displayedAssistant.length > 0 && (
          <ChatBubble
            role="ai"
            text={displayedAssistant}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
            streaming
            markdown
          />
        )}
        {isVoiceInOnly && displayedUser.length > 0 && (
          <ChatBubble
            role="user"
            text={displayedUser}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
            streaming
          />
        )}
        {(chatBusy || waitingForAssistant) && partialAssistant.length === 0 && !voiceStreaming && (
          <TypingIndicator />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto">
          <OrbControls
            size={91}
            leftActive={voiceChosen}
            rightActive={micRuntimeOn}
            activeRings={dualActiveRings}
            ringCount={3}
            ringStep={4}
            intensity={micRingIntensity}
            micAllowed={micAllowed}
            onToggleVoice={toggleVoice}
            onToggleMic={handleToggleMic}
            onRequestMic={handleRequestMic}
          />
        </div>

        <ChatComposer
          value={draft}
          onValueChange={setDraft}
          onSubmit={handleSendText}
          disabled={chatBusy}
          className="pointer-events-auto flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
        />
      </div>
    </div>
  );
}
