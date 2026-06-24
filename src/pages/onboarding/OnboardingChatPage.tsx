import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import {
  OnboardingCardSlot,
  type OnboardingCardApi,
  type ProfileSubmitFields,
  type ReflectionSubmitPayload,
} from '@/components/onboarding/chat/onboardingCardRegistry';
import { getOnboardingOpener } from '@/components/onboarding/onboardingOpeners';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { OrbControls } from '@/components/voice/OrbControls';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import {
  useOnboardingVoice as useOnboardingVoiceSession,
  useOnboardingTranscripts,
  useOnboardingVoiceActions,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { useAuth } from '@/hooks/useAuth';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingBeat } from '@/hooks/useOnboardingBeat';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { ONBOARDING_CHAT_VAPI } from '@/lib/config/voice';
import { buildActiveBeatCard } from '@/lib/onboarding/onboardingChatCards';
import type { SerializedHabitConfig } from '@/lib/onboarding/onboardingChatTypes';
import { beatForStep, CHAT_VAPI_BEAT_SCREENS } from '@/lib/onboarding/onboardingStepBeats';
import { STATIC_FEED_MODE } from '@/lib/onboarding/staticFeed';
import { queryKeys } from '@/lib/query';
import { pathToSpec } from '@/pages/onboarding/shared/pathToSpec';
import { deriveStateFromOnboarding } from '@/pages/onboarding/shared/planReviewDerive';
import type { OnboardingPath, OnboardingState } from '@gg/shared/types';

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

// Chat-native onboarding as a full PAGE (not an overlay over a form). The chat
// IS the surface. Same bottom orb + composer as the coach overlay. Voice modes:
// both orbs → real Vapi full-duplex per beat (when ONBOARDING_CHAT_VAPI is on,
// post-auth); mic only → Soniox→LLM (text reply). No standalone Cartesia here.
export function OnboardingChatPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const authed = !!user;
  const displayName = useDisplayName();
  const session = useOnboardingVoiceSession();
  const { beat, advance } = useOnboardingBeat();
  const { state, saveStepAsync, isSaving, complete, isCompleting, completeError } = useOnboarding();
  // Vapi tool writes (submit_profile, navigate_next) land server-side; the ONLY
  // way they reach this surface is Supabase Realtime → React Query cache. The
  // routed screens get this via OnboardingLayout, but the chat page isn't wrapped
  // in it — without this the card never fills and the beat never advances (the
  // user has to refresh). Harmless for the Direct-LLM path (it also writes the cache).
  // The status is read below to warn the user if the channel can't connect.
  const realtimeStatus = useOnboardingRealtimeSync();
  const { updatePreferences } = useUserPreferences();
  const {
    voiceOn: voiceChosen,
    micOn: micRuntimeOn,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();

  const messages = session?.messages ?? [];
  const chatBusy = session?.chatBusy ?? false;
  const registerScreen = session?.registerScreen;
  const registerAdvance = session?.registerAdvance;
  const openOverlay = session?.openOverlay;
  const isAssistantSpeaking = session?.isAssistantSpeaking ?? false;
  const isUserSpeaking = session?.isUserSpeaking ?? false;
  const voiceInListening = session?.voiceInListening ?? false;
  const errorMessage = session?.errorMessage ?? null;
  const restartCall = session?.restartCall;
  const voiceStatus = session?.status ?? 'idle';

  const [partialAssistant, setPartialAssistant] = useState('');
  const [partialUser, setPartialUser] = useState('');
  const displayedAssistant = useSmoothReveal(partialAssistant);

  // Mic is live whenever it's runtime-on — full-duplex (voice + mic) or voice-in-only.
  const micActive = micRuntimeOn;
  const { intensity: micRingIntensity, speaking: micSpeaking } = useMicVoiceActivity(
    micActive && voiceInListening,
  );
  const voiceState: 'speaking' | 'listening' | 'idle' = isAssistantSpeaking
    ? 'speaking'
    : isUserSpeaking || voiceInListening
      ? 'listening'
      : 'idle';
  const dualActiveRings: 'left' | 'right' | 'ready' | 'idle' | null =
    micActive && voiceInListening
      ? micSpeaking
        ? 'right'
        : 'ready'
      : micRuntimeOn && isUserSpeaking
        ? 'right'
        : voiceChosen && isAssistantSpeaking
          ? 'left'
          : null;
  const handleToggleMic = useCallback(() => {
    if (micAllowed) toggleMic();
  }, [micAllowed, toggleMic]);
  const handleRequestMic = useCallback(() => {
    void requestMicPermission();
  }, [requestMicPermission]);

  // Vapi-intended beat (voice on, covered beat) but mic not granted yet → Vapi
  // can't start and Direct-LLM is (correctly) suppressed, so there's no opener
  // coming. Don't show the misleading "coach is typing" dots — the user sees the
  // card and the mic orb to tap.
  const vapiPendingMic =
    ONBOARDING_CHAT_VAPI &&
    CHAT_VAPI_BEAT_SCREENS.has(beat.screenId) &&
    voiceChosen &&
    !micRuntimeOn;

  // Enable the Direct-LLM chat session for this surface (chatEnabled keys off
  // overlayOpen; the provider suppresses the floating overlay on this route).
  useEffect(() => {
    openOverlay?.();
  }, [openOverlay]);

  // Drive screen context off the beat (current_step), not the route.
  useEffect(() => {
    registerScreen?.(beat.screenId);
  }, [registerScreen, beat.screenId]);

  // Coach-driven "move on" (revisit-affirm) advances the beat in place.
  useEffect(() => {
    registerAdvance?.(advance);
    return () => registerAdvance?.(null);
  }, [registerAdvance, advance]);

  // Safety-net: clear a stuck user partial if the user stops speaking and no
  // final ever lands (dropped final / echo). Without this the live user bubble
  // would hang on screen with a streaming cursor. A real final still commits to
  // `messages` and clears the partial directly, so this only catches the gap.
  useEffect(() => {
    if (isUserSpeaking || voiceInListening) return;
    const t = setTimeout(() => setPartialUser(''), 1500);
    return () => clearTimeout(t);
  }, [isUserSpeaking, voiceInListening]);

  // Live transcript for BOTH speakers — the active speaker's partial grows as a
  // streaming bubble; the other speaker's live partial is cleared (turn switch).
  useOnboardingTranscripts((evt) => {
    if (evt.role === 'assistant') {
      if (evt.kind === 'partial') {
        setPartialAssistant(evt.text);
        setPartialUser('');
      } else {
        setPartialAssistant('');
      }
    } else {
      if (evt.kind === 'partial') {
        setPartialUser(evt.text);
        setPartialAssistant('');
      } else {
        setPartialUser('');
      }
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const handleScrollPin = useCallback(() => {
    const el = scrollRef.current;
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);
  // Auto-scroll only when a NEW turn lands and the user is already at the bottom.
  // NOT on every streaming tick / typing flip — that would snap-pin the view and
  // fight the user trying to scroll up to read history.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Advance the beat OPTIMISTICALLY (instant UI) to a FIXED target step, then
  // persist in the background — never block the flow on the network. The fixed
  // target (Math.max in advance) makes a re-tap of an already-frozen card a
  // no-op. The save's onError surfaces failures via toast; the server's GREATEST
  // upsert reconciles. Profile is step 1 → advance to step 2 (the fork).
  const handleSubmitProfile = useCallback(
    (fields: ProfileSubmitFields) => {
      // Re-taps of a frozen profile card after the flow has moved past Beat 1
      // would clobber coach-driven captures on later beats.
      if (state && state.current_step > 1) return;
      advance(2);
      void saveStepAsync(1, fields);
    },
    [state, advance, saveStepAsync],
  );
  // Beat 0 (preferences) → step 1 (profile). Persist only the interaction
  // preference; mic stays off until the conversational voice loop lands. NO
  // saveStepAsync here — a step-1 save with empty data would emit a bogus
  // ONBOARD-01 form_submit and make the coach think the profile was already
  // captured. The profile row is created when the profile card submits.
  const handleSubmitPreferences = useCallback(
    (mode: 'voice' | 'screen') => {
      // Re-taps after Beat 0 would silently flip voiceMode and turn mic off
      // even if the user enabled mic later.
      if (state && state.current_step !== 0) return;
      advance(1);
      void updatePreferences({
        voiceMode: mode,
        micEnabled: false,
      });
    },
    [state, advance, updatePreferences],
  );

  // Beat 2 (fork) → step 3. Prime the path optimistically so beatForStep(3)
  // immediately resolves the right branch (beginner vs braindump) without
  // waiting on the save's round-trip — mirrors Step2Page.applyPathChoice.
  const handleSubmitPathChoice = useCallback(
    (path: OnboardingPath) => {
      // Re-taps of a frozen fork card after Beat 2 would re-fork mid-flow while
      // downstream beats already committed to the original path.
      if (state && state.current_step > 2) return;
      qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
        prev ? { ...prev, path } : prev,
      );
      track('select_onboarding_path', {
        path: pathToSpec(path === 'advanced' ? 'braindump' : path),
      });
      advance(3);
      void saveStepAsync(2, {}, { path });
    },
    [state, qc, advance, saveStepAsync],
  );
  // Beat 3 (category) → step 4. Seed cache so the next beat's card can read
  // state.data.category synchronously without waiting on saveStepAsync.
  const handleSubmitCategory = useCallback(
    (category: string) => {
      qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
        prev ? { ...prev, data: { ...prev.data, category } } : prev,
      );
      advance(4);
      void saveStepAsync(3, { category });
    },
    [qc, advance, saveStepAsync],
  );
  // Beat 4 (goals) → step 5. Same optimistic-cache pattern as category.
  const handleSubmitGoals = useCallback(
    (goals: string[]) => {
      qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
        prev ? { ...prev, data: { ...prev.data, goals } } : prev,
      );
      advance(5);
      void saveStepAsync(4, { goals });
    },
    [qc, advance, saveStepAsync],
  );
  // Beat 5 (habits) → step 6.
  const handleSubmitHabits = useCallback(
    (habitConfigs: Record<string, SerializedHabitConfig>) => {
      advance(6);
      void saveStepAsync(5, { habitConfigs });
    },
    [advance, saveStepAsync],
  );
  // Beat 6 (reflection) → step 7.
  const handleSubmitReflection = useCallback(
    (payload: ReflectionSubmitPayload) => {
      advance(7);
      void saveStepAsync(6, payload);
    },
    [advance, saveStepAsync],
  );

  // Completion — mirrors PlanReviewPage. Derives the plan from persisted state
  // and finalizes (route to /home). Single-fire so a redundant Realtime push or
  // a double-tap can't re-complete.
  const completedRef = useRef(false);
  const finalize = useCallback(() => {
    if (completedRef.current || isCompleting) return;
    if (!state) return;
    const derived = deriveStateFromOnboarding(state.data);
    if (!derived?.habitConfigs || !derived?.reflectionConfig) return;
    completedRef.current = true;
    complete({
      habitConfigs: derived.habitConfigs,
      goals: derived.goals,
      category: derived.category,
      reflectionConfig: derived.reflectionConfig,
    });
  }, [state, isCompleting, complete]);

  // Voice path: confirm_plan bumps current_step past 7 (server GREATEST → 8),
  // which fires finalize. The plan-review card's "Start plan" tap calls finalize
  // directly (no current_step gate) — that's the explicit tap path.
  useEffect(() => {
    if (!state || state.current_step <= 7) return;
    finalize();
  }, [state, finalize]);

  // Voice/typed "let's go" on the plan beat. The confirm_plan tool succeeds
  // server-side but does NOT bump current_step, so the current_step>7 effect
  // never fires for this path — finalize directly (mirrors the card-tap path).
  // A fresh confirm after a failed complete() clears the single-fire latch for
  // ONE more attempt; we never auto-retry on every render (a persistently-500ing
  // backend would retry-storm), so each explicit confirm is its own attempt.
  useOnboardingVoiceActions((result) => {
    if (STATIC_FEED_MODE) return;
    if (result.action === 'set_path') {
      const params = result.params as { path?: string };
      if (params.path === 'simple' || params.path === 'braindump') {
        track('select_onboarding_path', { path: pathToSpec(params.path) });
      }
      return;
    }
    if (result.action !== 'confirm_plan') return;
    if (completedRef.current && completeError) completedRef.current = false;
    finalize();
  });

  const cardApi: OnboardingCardApi = {
    submitProfile: handleSubmitProfile,
    submitPreferences: handleSubmitPreferences,
    submitPathChoice: handleSubmitPathChoice,
    submitCategory: handleSubmitCategory,
    submitGoals: handleSubmitGoals,
    submitHabits: handleSubmitHabits,
    submitReflection: handleSubmitReflection,
    confirmPlan: finalize,
    busy: isSaving,
    completing: isCompleting,
  };

  const currentStep = state?.current_step ?? 0;

  // Once authenticated the auth beat (Beat 0) collapses → advance to profile.
  // Covers OAuth return, email-verify return, and in-card login; a returning
  // user who signed up but never did profile (still at step 0) skips to it too.
  useEffect(() => {
    if (authed && currentStep === 0) advance(1);
  }, [authed, currentStep, advance]);

  const activeBeatRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!STATIC_FEED_MODE) return;
    activeBeatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep]);

  const gradient = voiceState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT;

  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="absolute inset-0 bg-white" />
      <div
        className="absolute inset-0 backdrop-blur-[50px]"
        style={{ backgroundImage: gradient, transition: 'background-image 300ms ease-out' }}
      />

      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 pt-[64px]"
        style={{ paddingBottom: 'calc(240px + max(48px, env(safe-area-inset-bottom)))' }}
        onScroll={handleScrollPin}
      >
        {/* ONE continuous beat feed: every beat from profile up stays rendered and
            scrollable (only auth is hidden). Each beat shows its own dialogue +
            card; the active beat streams live. Never a message-only feed that
            drops beats whose opener didn't land as a turn. */}
        <BeatFeed
          currentStep={currentStep}
          authed={authed}
          path={state?.path ?? null}
          state={state ?? null}
          cardApi={cardApi}
          activeBeatRef={activeBeatRef}
          messages={messages}
          chatBusy={chatBusy}
          displayedAssistant={displayedAssistant}
          displayedUser={partialUser}
          isAssistantSpeaking={isAssistantSpeaking}
          displayName={displayName}
          vapiPendingMic={vapiPendingMic}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        {voiceStatus === 'error' ? (
          <button
            type="button"
            onClick={() => void restartCall?.()}
            className="pointer-events-auto rounded-full bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 shadow-md"
          >
            Voice disconnected — tap to reconnect
          </button>
        ) : realtimeStatus === 'error' ? (
          <div className="pointer-events-none rounded-full bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700 shadow-md">
            Trouble connecting — check your network
          </div>
        ) : vapiPendingMic ? (
          <button
            type="button"
            onClick={handleRequestMic}
            className="pointer-events-auto rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            Tap to talk with your coach
          </button>
        ) : null}
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
      </div>
    </div>
  );
}

function BeatFeed({
  currentStep,
  authed,
  path,
  state,
  cardApi,
  activeBeatRef,
  messages,
  chatBusy,
  displayedAssistant,
  displayedUser,
  isAssistantSpeaking,
  displayName,
  vapiPendingMic,
}: {
  currentStep: number;
  authed: boolean;
  path: OnboardingPath | null;
  state: OnboardingState | null;
  cardApi: OnboardingCardApi;
  activeBeatRef: React.MutableRefObject<HTMLDivElement | null>;
  messages: VoiceMessage[];
  chatBusy: boolean;
  displayedAssistant: string;
  displayedUser: string;
  isAssistantSpeaking: boolean;
  displayName?: string;
  vapiPendingMic: boolean;
}) {
  // Once authed, Beat 0 (the auth card) vanishes — render from profile up.
  const start = authed ? 1 : 0;
  const last = Math.max(currentStep, start);
  const steps: number[] = [];
  for (let s = start; s <= last; s++) steps.push(s);
  const beats = steps.map((s) => ({ s, beat: beatForStep(s, path) }));
  const knownScreenIds = new Set(beats.map(({ beat }) => beat.screenId));
  // Untagged / out-of-range turns (affirmations, errors, legacy) render under the
  // active beat so nothing is silently dropped.
  const orphans = messages.filter((m) => !m.screenId || !knownScreenIds.has(m.screenId));

  return (
    <div className="flex w-full flex-col items-center gap-12 py-12">
      {beats.map(({ s, beat }) => {
        const isActive = s === currentStep;
        const beatMessages = messages.filter((m) => m.screenId === beat.screenId);
        const renderMsgs = isActive ? [...beatMessages, ...orphans] : beatMessages;
        const opener = getOnboardingOpener(beat.screenId);
        const hasCardInMsgs = renderMsgs.some((m) => m.cards && m.cards.length > 0);
        const frozenCard = buildActiveBeatCard(beat.cardType, state);
        // Authored line ONLY for frozen prior beats with no landed turn (settled
        // scrollback). NEVER for the active beat — a static line there would flash
        // before the stream and then be replaced. The active beat shows typing
        // dots while waiting, then the live stream.
        const showAuthoredOpener = renderMsgs.length === 0 && !isActive && !!opener;
        const lastMsg = renderMsgs[renderMsgs.length - 1];
        const lastIdx = renderMsgs.length - 1;
        // The in-progress turn's live partial (whichever speaker is talking now).
        const livePartial: { role: 'ai' | 'user'; text: string } | null =
          isActive && displayedUser.length > 0
            ? { role: 'user', text: displayedUser }
            : isActive && displayedAssistant.length > 0
              ? { role: 'ai', text: displayedAssistant }
              : null;
        // A live partial that CONTINUES the last committed turn (same speaker) is
        // appended to that bubble rather than rendered as a second one — so a
        // multi-segment Vapi turn stays ONE growing bubble (no flicker / double bubble).
        const partialExtendsLast = !!livePartial && !!lastMsg && lastMsg.role === livePartial.role;
        // Loading dots: waiting for the coach — opener not landed, or the user just
        // spoke and the coach is composing/running a tool. NOT while it's speaking or
        // a partial is streaming (that would show "loading" over real speech).
        const awaitingReply = !!lastMsg && lastMsg.role === 'user';
        const showActiveTyping =
          isActive &&
          !vapiPendingMic &&
          !isAssistantSpeaking &&
          !livePartial &&
          (chatBusy || awaitingReply || (renderMsgs.length === 0 && !!opener));
        const messageBlock = (m: VoiceMessage, i: number) => {
          const extend = i === lastIdx && partialExtendsLast;
          const text =
            extend && livePartial
              ? `${m.text} ${livePartial.text}`.replace(/\s+/g, ' ').trim()
              : m.text;
          return (
            <div key={m.id} className="flex flex-col gap-3">
              {text ? (
                <ChatBubble
                  role={m.role}
                  text={text}
                  userName={displayName}
                  eyebrowVariant="dark"
                  compact
                  animate={false}
                  streaming={extend}
                  markdown
                />
              ) : null}
              {m.cards?.map((card, ci) => (
                <OnboardingCardSlot key={`${m.id}-card-${ci}`} card={card} api={cardApi} />
              ))}
            </div>
          );
        };
        // Card keeps a FIXED slot (right after the opener) across the streaming→landed
        // transition so it never remounts (which would wipe in-progress card input).
        // Suppressed when a message already carries its own card (Direct-LLM path).
        const cardNode =
          !hasCardInMsgs && frozenCard ? (
            <OnboardingCardSlot
              key={`beat-card-${beat.screenId}`}
              card={frozenCard}
              api={cardApi}
            />
          ) : null;
        const streamingBubble = livePartial ? (
          <ChatBubble
            key={`${livePartial.role}-streaming`}
            role={livePartial.role}
            text={livePartial.text}
            userName={displayName}
            eyebrowVariant="dark"
            compact
            animate={false}
            streaming
            markdown
          />
        ) : null;
        // Slot 1 (opener): first committed turn, or — before anything commits — the
        // streaming opener / authored line / typing dots.
        const openerSlot =
          renderMsgs.length > 0
            ? messageBlock(renderMsgs[0], 0)
            : (streamingBubble ??
              (showAuthoredOpener ? (
                <ChatBubble
                  role="ai"
                  text={opener}
                  eyebrowVariant="dark"
                  compact
                  animate={false}
                  markdown
                />
              ) : showActiveTyping ? (
                <TypingIndicator key="typing" />
              ) : null));
        // Slot 4 (tail): a NEW-turn partial (different speaker than the last bubble)
        // or typing dots — only when there are committed turns above.
        const tailNode =
          renderMsgs.length > 0 ? (
            livePartial && !partialExtendsLast ? (
              streamingBubble
            ) : !livePartial && showActiveTyping ? (
              <TypingIndicator key="typing" />
            ) : null
          ) : null;
        return (
          <div
            key={`beat-${s}-${beat.screenId}`}
            ref={isActive ? activeBeatRef : undefined}
            className="flex w-full max-w-md flex-col gap-3"
          >
            {/* Stable slots: opener → card → rest → live tail. Card stays at slot 2
                so it never remounts when the opener goes streaming→landed. */}
            {openerSlot}
            {cardNode}
            {renderMsgs.slice(1).map((m, i) => messageBlock(m, i + 1))}
            {tailNode}
          </div>
        );
      })}
    </div>
  );
}
