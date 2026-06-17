import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { HabitReportCard } from '@/components/coach/HabitReportCard';
import { CheckInCard } from '@/components/home/CheckInCard';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { deriveOrbRing } from '@/components/ui/orbRing';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useToast } from '@/contexts/ToastContext';
import { useCoachTranscripts } from '@/contexts/useCoachVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
import type { CoachChatApi } from '@/lib/chat/coachChatTypes';
import { stopTTS } from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';

interface CoachChatViewProps extends CoachChatApi {
  currentScreenId: string;
  displayName?: string;
  onClose: () => void;
}

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

// Coach chat overlay UI — mirrors OnboardingChatOverlay's orb-first shape
// (DualButton + gradients + smooth-reveal partials), driven by CoachChatApi
// from CoachVoiceProvider. Used for HOME-CHECKIN, MCHECK-*, ECHECK-*.
export function CoachChatView({
  messages,
  voiceState,
  speaking,
  micListening,
  sendText,
  updateHabitDays,
  loadOlder,
  hasMore,
  loadingOlder,
  displayName,
  onClose,
}: CoachChatViewProps) {
  const {
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();

  // Soniox interim (set by useCoachChat's onInterim). Shows the user typing-by-voice.
  const interim = useVoiceStore((s) => s.interim);

  // Orb liveness = mic toggle AND a live Soniox stream. A dead/restarting mic
  // (track ended on resume) reads as preparing, not a false blue "listening".
  const micLive = micRuntimeOn && micListening;
  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';

  const [draft, setDraft] = useState('');
  const [partialAssistant, setPartialAssistant] = useState('');

  const displayedAssistant = useSmoothReveal(partialAssistant);
  const displayedUser = useSmoothReveal(interim);

  let revealingId: string | null = null;
  if (displayedAssistant.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'ai') {
        revealingId = messages[i].id;
        break;
      }
    }
  }
  const renderedMessages = revealingId ? messages.filter((m) => m.id !== revealingId) : messages;
  // Render the habit report once, after the LATEST habit-completion turn — not
  // only when it's the absolute last message (the user often chats after).
  let lastHabitReportId: string | null = null;
  for (let i = renderedMessages.length - 1; i >= 0; i--) {
    if (renderedMessages[i].habitReport) {
      lastHabitReportId = renderedMessages[i].id;
      break;
    }
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const touchStartY = useRef<number | null>(null);
  // Captured just before loadOlder(): scrollHeight + the current top message id.
  // Keying on the top id means an appended live turn mid-fetch is NOT mistaken
  // for a prepend (only a real prepend changes the top id).
  const prependAnchorRef = useRef<{ scrollHeight: number; topId: string | null } | null>(null);
  const firstMessageId = messages[0]?.id ?? null;

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && hasMore && !loadingOlder && prependAnchorRef.current === null) {
      prependAnchorRef.current = { scrollHeight: el.scrollHeight, topId: firstMessageId };
      // Release the anchor only when the page added NOTHING new (empty/all-dup) —
      // no blind timeout, so a genuinely slow prepend never loses its anchor (MR#8).
      void loadOlder().then((added) => {
        if (added === 0) prependAnchorRef.current = null;
      });
    }
  }, [hasMore, loadingOlder, loadOlder, firstMessageId]);

  // Restore the prior viewport offset ONLY on a real prepend (top id changed),
  // so older pages don't jump the view; otherwise pin to bottom for live turns.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const anchor = prependAnchorRef.current;
    if (anchor !== null) {
      if (firstMessageId !== anchor.topId) {
        el.scrollTop += el.scrollHeight - anchor.scrollHeight;
        prependAnchorRef.current = null;
      }
      return;
    }
    if (pinnedToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, firstMessageId, isProcessing, displayedAssistant, displayedUser]);

  useCoachTranscripts((evt) => {
    if (evt.role !== 'assistant') return;
    if (evt.kind === 'partial') setPartialAssistant(evt.text);
    else setPartialAssistant('');
  });

  const { intensity: micRingIntensity, speaking: micSpeaking } = useMicVoiceActivity(
    micLive && isListening,
  );

  const handleClose = useCallback(() => {
    stopTTS();
    onClose();
  }, [onClose]);

  const handleToggleMic = useCallback(() => {
    if (!micAllowed) return;
    toggleMic();
  }, [micAllowed, toggleMic]);

  const { addToast } = useToast();
  const handleRequestMic = useCallback(async () => {
    const result = await requestMicPermission();
    if (result === 'denied') {
      addToast(
        'error',
        'Microphone is blocked. Enable it in your browser settings, then tap the mic again.',
      );
    } else if (result === 'unavailable') {
      addToast('error', "Couldn't reach the mic — it may be in use. Try again.");
    }
  }, [requestMicPermission, addToast]);

  const handleSendText = useCallback(
    (text: string) => {
      sendText(text);
      setDraft('');
    },
    [sendText],
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

  const visualState: 'speaking' | 'listening' | 'idle' = speaking
    ? 'speaking'
    : isListening
      ? 'listening'
      : 'idle';

  const gradient = visualState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT;
  const dualActiveRings = deriveOrbRing({
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    speaking,
    listening: micLive && isListening,
    micSpeaking,
  });

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
        className="relative z-10 flex-1 overflow-y-auto px-4 pt-[64px]"
        style={{
          paddingBottom: 'calc(240px + max(48px, env(safe-area-inset-bottom)))',
          maskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
        }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loadingOlder && (
          <div className="py-2 text-center text-[12px] font-medium text-slate-500">
            Loading older messages…
          </div>
        )}
        {renderedMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <ChatBubble
              role={msg.role}
              text={msg.text}
              userName={displayName}
              eyebrowVariant="dark"
              compact
              animate={false}
              markdown
            />
            {msg.habitCards?.map((card, i) => (
              <HabitSuggestionCard
                key={i}
                name={card.name}
                days={card.days}
                onDaysChange={(days) => updateHabitDays(msg.id, i, days)}
              />
            ))}
            {msg.checkinCard && (
              <div className="mb-3 mt-2 w-full max-w-[360px]">
                <CheckInCard selectedDate={msg.checkinCard.date} embedded onClose={handleClose} />
              </div>
            )}
            {msg.habitReport && msg.id === lastHabitReportId && <HabitReportCard />}
          </div>
        ))}
        {displayedAssistant.length > 0 && (
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
        {micLive && displayedUser.length > 0 && (
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
        {isProcessing && partialAssistant.length === 0 && <TypingIndicator />}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto">
          <DualButton
            size={91}
            leftActive={voiceChosen}
            rightActive={micLive}
            activeRings={dualActiveRings}
            ringCount={3}
            ringStep={4}
            intensity={dualActiveRings === 'right' ? micRingIntensity : undefined}
            leftIcon={voiceChosen ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
            rightIcon={micRuntimeOn ? <IconMic size={26} /> : <IconMicMuted size={26} />}
            onLeftClick={toggleVoice}
            onRightClick={micRuntimeOn ? handleToggleMic : handleRequestMic}
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
          disabled={isProcessing}
          className="pointer-events-auto flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
        />
      </div>
    </div>
  );
}
