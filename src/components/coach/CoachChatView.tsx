import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { HabitReportCard } from '@/components/coach/HabitReportCard';
import { CheckInCard } from '@/components/home/CheckInCard';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useCoachTranscripts } from '@/contexts/useCoachVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import type { CoachChatApi } from '@/lib/chat/coachChatTypes';
import { stopTTS } from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';

interface CoachChatViewProps extends CoachChatApi {
  currentScreenId: string;
  displayName?: string;
  onClose: () => void;
}

const CoachMessageRow = memo(
  function CoachMessageRow({
    msg,
    displayName,
    updateHabitDays,
    onClose,
  }: {
    msg: CoachChatApi['messages'][number];
    displayName?: string;
    updateHabitDays: CoachChatApi['updateHabitDays'];
    onClose: () => void;
  }) {
    return (
      <div className="flex flex-col">
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
            <CheckInCard selectedDate={msg.checkinCard.date} embedded onClose={onClose} />
          </div>
        )}
        {msg.habitReport && <HabitReportCard />}
      </div>
    );
  },
  // useCoachChat rebuilds every message object each turn; without this the whole
  // thread re-renders (and re-parses markdown) on every send — a visible flash.
  (a, b) =>
    a.msg.id === b.msg.id &&
    a.msg.text === b.msg.text &&
    a.msg.role === b.msg.role &&
    a.msg.habitReport === b.msg.habitReport &&
    a.displayName === b.displayName &&
    a.updateHabitDays === b.updateHabitDays &&
    a.onClose === b.onClose &&
    JSON.stringify(a.msg.habitCards) === JSON.stringify(b.msg.habitCards) &&
    JSON.stringify(a.msg.checkinCard) === JSON.stringify(b.msg.checkinCard),
);

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

// Coach chat overlay for HOME-CHECKIN, MCHECK-*, ECHECK-*.
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
  const { micOn: micRuntimeOn, voiceOn } = useDualButtonControls();

  // Soniox interim (set by useCoachChat's onInterim). Shows the user typing-by-voice.
  const interim = useVoiceStore((s) => s.interim);

  // Orb liveness = mic toggle AND a live Soniox stream. A dead/restarting mic
  // (track ended on resume) reads as preparing, not a false blue "listening".
  const micLive = micRuntimeOn && micListening;
  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';

  const [draft, setDraft] = useState('');
  const [partialAssistant, setPartialAssistant] = useState('');

  const displayedAssistant = partialAssistant;
  const displayedUser = interim;

  // Tail-only: hide the in-flight reply's committed row while it speaks (no
  // full-text flash); never hides a previous turn (tail is the user msg then).
  const tail = messages[messages.length - 1];
  const revealingId =
    tail && tail.role === 'ai' && (displayedAssistant.length > 0 || speaking) ? tail.id : null;
  const renderedMessages = revealingId ? messages.filter((m) => m.id !== revealingId) : messages;

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

  const handleClose = useCallback(() => {
    stopTTS();
    onClose();
  }, [onClose]);

  const handleSendText = useCallback(
    (text: string) => {
      setPartialAssistant(''); // drop stale reveal → straight to user msg + loading
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

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-up flex-col">
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 backdrop-blur-[50px]" />
      <div className="absolute inset-0" style={{ backgroundImage: IDLE_GRADIENT }} />
      <div
        className="absolute inset-0 transition-opacity duration-300 ease-out"
        style={{
          backgroundImage: LISTENING_GRADIENT,
          opacity: visualState === 'listening' ? 1 : 0,
        }}
      />

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close chat"
        className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-content shadow-card"
      >
        <Icon icon="ic:round-close" width={20} height={20} />
      </button>

      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 pt-[64px]"
        style={{
          overflowAnchor: 'none',
          paddingBottom: 'calc(200px + env(safe-area-inset-bottom))',
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
          <CoachMessageRow
            key={msg.id}
            msg={msg}
            displayName={displayName}
            updateHabitDays={updateHabitDays}
            onClose={handleClose}
          />
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
            revealByWord={!voiceOn}
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
            revealByWord
          />
        )}
        {isProcessing && partialAssistant.length === 0 && <TypingIndicator />}
      </div>

      {/* clear nav bar (72) + orb half poking above it (46) + gap */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6"
        style={{ paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' }}
      >
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
