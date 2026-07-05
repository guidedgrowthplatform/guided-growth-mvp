/**
 * BeatPlayer + Karaoke, ported from the flow builder's beatKit
 * (ggmvp-flow-builder/src/components/flow-designer/beatKit.tsx) into the running
 * engine. This is the LATEST onboarding presentation model: a beat plays as an
 * ordered timeline of steps that fade in one after another, the coach line reads
 * as a karaoke-style caption (words light up as if spoken), and the interactive
 * card reveals after the coach has finished speaking.
 *
 * The difference from the builder's static version: here a step's body can be a
 * live React node (the real interactive card wired to the orchestrator), not a
 * canned sample. The player only owns the reveal timing and the coach karaoke,
 * never the card's own state, selection, voice capture, or saving. Those stay in
 * the card adapters and the orchestrator, untouched.
 */
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  useOnboardingVoice,
  type OnboardingTranscriptListener,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
import { COACH_THINKING_INITIAL, coachThinkingReducer, showCoachThinking } from './coachThinking';
import { openerTurns } from './openerTurns';
import { countWords, useCoachSpeechReveal } from './useCoachSpeechReveal';

// Hard ceiling on how long the card waits behind a voice-driven coach line. If
// the speech signal stalls (frozen/half-open session that never emits
// speech-end), reveal anyway so onboarding can never dead-end with no card.
const VOICE_REVEAL_MAX_MS = 12000;

// How long the opener waits for a TRANSCRIPT before falling back to the authored
// line. Cold-start appends the opener instantly (no wait); warm Vapi streams it in
// a second or two. The fallback only fires if voice fails to produce any opener.
const OPENER_FALLBACK_MS = 12000;

// One part of a beat the player reveals in turn.
//   - kind 'coach'  + say  -> a white bubble the coach speaks (karaoke reveal)
//   - kind 'card'   + body -> the interactive card, revealed after the coach line
export interface BeatStep {
  id: string;
  kind: 'coach' | 'card';
  say?: string;
  body?: ReactNode;
}

// Shared bubble styles, so the active beat and the scrolled-back past beats read
// as the same chat. Coach = white bubble on the left, user = blue bubble on the
// right (ported from the builder's BeatPlayer).
export const COACH_BUBBLE_CLASS =
  'max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-[14px] font-medium leading-[1.45] text-content shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.12)]';

export const USER_BUBBLE_CLASS =
  'max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[rgba(19,91,236,0.9)] px-4 py-2.5 text-[14px] font-medium text-white shadow-card';

// A past beat replayed as static bubbles: the coach line(s), then the user's
// answer. No karaoke, no timing (the beat already happened); same visual language
// as the active beat so the scroll reads as one conversation.
export function PastBeatBubbles({
  coach,
  reply,
}: {
  coach?: string | null;
  reply?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {openerTurns(coach).map((line, i) => (
        <div key={i} className={COACH_BUBBLE_CLASS}>
          {line}
        </div>
      ))}
      {reply && <div className={USER_BUBBLE_CLASS}>{reply}</div>}
    </div>
  );
}

/**
 * A beat's FULL conversation, rendered from the provider's single chronological
 * message store (every coach + user turn for this beat, in turn order — opener
 * first, then the dialogue). ONE source of order, so turns can never interleave
 * wrong. Because it renders the persisted store, a COMPLETED beat keeps its whole
 * conversation on screen (and rehydrates after a refresh) instead of collapsing —
 * pass `active={false}` for a static past-beat replay.
 *
 * Active beat only: the in-progress turn streams as a live partial at the tail, a
 * thinking indicator shows while the coach connects / replies, and the cold-start
 * Cartesia opener (source 'opener') karaokes word-by-word. Warm Vapi openers and
 * replies already arrive word-by-word as STT partials.
 *
 * `fallbackOpener` (the authored line) shows only if the active beat produces no
 * coach turn within the failsafe window (voice stalled), so a beat can't dead-end.
 */
export function BeatConversation({
  screenId,
  active,
  onText,
  fallbackOpener,
  card,
  cardReadyOverride,
  connecting = true,
  hideOpener = false,
}: {
  screenId: string;
  active: boolean;
  onText?: () => void;
  fallbackOpener?: string | null;
  // The beat's interactive component, placed IN the timeline right after the
  // opener (coach presents it, then the dialogue continues below it).
  card?: ReactNode;
  // Optional external reveal gate for beats whose opener is rendered outside the
  // transcript stream (for example, prerecorded MP3 hybrid openers).
  cardReadyOverride?: boolean;
  // Whether to show the connecting/thinking + authored-opener failsafe. Off on the
  // non-Vapi path (the authored opener is already drawn by BeatPlayer there).
  connecting?: boolean;
  // On when BeatPlayer draws the authored opener beside this component: the
  // store/streamed opener copy would render the same line twice (B33).
  hideOpener?: boolean;
}) {
  const session = useOnboardingVoice();
  const all = session?.messages;
  const subscribe = session?.subscribeTranscripts;
  const openerReveal = session?.openerReveal;

  const beatMsgs = (all ?? []).filter((m) => m.screenId === screenId);
  const hasCoachTurn = beatMsgs.some((m) => m.role === 'ai');
  // The opener is the first coach turn before any user turn; the rest is dialogue.
  const firstUserIdx = beatMsgs.findIndex((m) => m.role === 'user');
  const openerIdx = beatMsgs.findIndex(
    (m, i) => m.role === 'ai' && (firstUserIdx < 0 || i < firstUserIdx),
  );
  const opener = openerIdx >= 0 ? beatMsgs[openerIdx] : null;
  const dialogue = openerIdx >= 0 ? beatMsgs.slice(openerIdx + 1) : beatMsgs;

  const [partial, setPartial] = useState<{ role: 'ai' | 'user'; text: string } | null>(null);
  const shown = useSmoothReveal(partial?.text ?? '');
  const [fallbackOn, setFallbackOn] = useState(false);

  useEffect(() => {
    if (!active || !subscribe) {
      setPartial(null);
      return;
    }
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      const role: 'ai' | 'user' = evt.role === 'assistant' ? 'ai' : 'user';
      if (evt.kind === 'partial') setPartial({ role, text: evt.text });
      else setPartial(null);
    };
    return subscribe(onTranscript);
  }, [active, subscribe]);

  // Failsafe: surface the authored opener if voice never produces a coach turn.
  useEffect(() => {
    if (!connecting || !active || hasCoachTurn || !fallbackOpener) return;
    const t = window.setTimeout(() => setFallbackOn(true), OPENER_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [connecting, active, hasCoachTurn, fallbackOpener]);

  useEffect(() => {
    if (beatMsgs.length > 0 || shown.trim().length > 0) onText?.();
  }, [beatMsgs.length, shown, onText]);

  const coldOpenerLive = !!(active && openerReveal && openerReveal.screenId === screenId);
  // The cold opener turn exists with 0 revealed words before the audio starts — don't
  // draw an empty bubble; hold it until the first word lands so it grows from nothing.
  const coldOpenerPending =
    coldOpenerLive && opener?.source === 'opener' && (openerReveal!.revealedWords ?? 0) <= 0;
  const showConnecting = connecting && active && !hasCoachTurn && !partial;
  const openerPresent = !!opener || (fallbackOn && !!fallbackOpener);

  // ONE bubble per turn: the live partial EXTENDS the current turn's bubble when it
  // continues that turn (same role as the tail), instead of spawning a second
  // bubble that later collapses. A partial of a NEW turn (different role) renders
  // as its own bubble at the tail.
  const livePartial = active && partial && shown.trim().length > 0 ? shown : null;
  const tail = dialogue.length > 0 ? dialogue[dialogue.length - 1] : opener;
  const partialExtendsTail = !!livePartial && !!tail && tail.role === partial!.role;
  const partialExtendsOpener = partialExtendsTail && dialogue.length === 0;
  const partialExtendsDialogue = partialExtendsTail && dialogue.length > 0;
  // A warm opener still STREAMING before it commits to the store: no committed
  // opener yet, an AI partial, nothing in dialogue. It IS the opener, so it
  // renders ABOVE the card while the card is still held back.
  const liveOpener =
    !opener && !!livePartial && partial?.role === 'ai' && dialogue.length === 0
      ? livePartial
      : null;
  // Reveal the card only AFTER the coach finishes the opener: a cold-start opener
  // is still speaking until its karaoke has lit every word; a warm opener is still
  // speaking while it streams uncommitted (liveOpener). The authored-opener
  // failsafe (fallbackOn) also satisfies openerPresent, so a stalled voice can't
  // hang the card forever.
  const coldOpenerSpeaking =
    coldOpenerLive &&
    opener?.source === 'opener' &&
    (openerReveal?.revealedWords ?? 0) < countWords(opener?.text ?? '');
  const cardReady = openerPresent && !liveOpener && !coldOpenerSpeaking;
  // A PAST beat is completed: its card is a persisted receipt and must ALWAYS
  // render, never gated on whether the thread happens to hold a committed
  // opener turn. (Direct-LLM beats karaoke their opener without committing it
  // to the store, so a completed beat often has user turns but no stored coach
  // opener; gating the card on openerPresent made those cards vanish: B6/B7.)
  const shouldRevealCard = !active ? true : (cardReadyOverride ?? cardReady);
  // Same never-disappear rule for the coach line: a past beat with dialogue but
  // no committed opener re-renders the AUTHORED opener statically, so the line
  // the coach actually spoke (karaoke, uncommitted) stays in the scrollback.
  const authoredOpenerTurns =
    !active && !opener && fallbackOpener ? openerTurns(fallbackOpener) : [];

  const renderTurn = (m: VoiceMessage, append?: string | null) => {
    const isColdOpener = coldOpenerLive && m.source === 'opener' && m.id === opener?.id;
    const text = append ? `${m.text} ${append}`.replace(/\s+/g, ' ').trim() : m.text;
    return (
      <div key={m.id} className={m.role === 'ai' ? COACH_BUBBLE_CLASS : USER_BUBBLE_CLASS}>
        {isColdOpener ? (
          <Karaoke text={m.text} active revealCount={openerReveal!.revealedWords} />
        ) : (
          text
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* opener (committed, the streaming opener before it commits, the
          authored failsafe if voice never spoke, or the authored line replayed
          on a past beat whose thread has no committed opener), always ABOVE
          the card */}
      {hideOpener ? null : opener && !coldOpenerPending ? (
        active ? (
          renderTurn(opener, partialExtendsOpener ? livePartial : null)
        ) : (
          // Past-beat replay: a committed multi-prompt opener keeps its authored
          // turn breaks — one bubble per line, not one merged bubble (B34).
          openerTurns(opener.text).map((line, i) => (
            <div key={`${opener.id}-turn-${i}`} className={COACH_BUBBLE_CLASS}>
              {line}
            </div>
          ))
        )
      ) : liveOpener ? (
        <div className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>{liveOpener}</div>
      ) : showConnecting && fallbackOn && fallbackOpener ? (
        openerTurns(fallbackOpener).map((line, i) => (
          <div key={`fallback-${i}`} className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>
            {line}
          </div>
        ))
      ) : authoredOpenerTurns.length > 0 ? (
        authoredOpenerTurns.map((line, i) => (
          <div key={`authored-${i}`} className={COACH_BUBBLE_CLASS}>
            {line}
          </div>
        ))
      ) : null}

      {/* the beat component, IN the timeline — revealed only AFTER the coach has
          finished the opener (cold karaoke complete / warm opener committed, or
          the 12s authored-opener failsafe), so it slots in BELOW the finished
          opener instead of above an in-progress one. */}
      {card && shouldRevealCard && <div className="animate-fade-in">{card}</div>}

      {/* dialogue, the partial extending the last turn's bubble when it continues it */}
      {dialogue.map((m, i) =>
        renderTurn(m, i === dialogue.length - 1 && partialExtendsDialogue ? livePartial : null),
      )}

      {/* a partial that STARTS a new turn renders as its own (single) bubble —
          except the streaming opener, already drawn above the card */}
      {livePartial && !partialExtendsTail && !liveOpener && (
        <div
          className={`animate-fade-in ${partial!.role === 'ai' ? COACH_BUBBLE_CLASS : USER_BUBBLE_CLASS}`}
        >
          {livePartial}
        </div>
      )}

      {showConnecting && !fallbackOn ? <ThinkingDots /> : active && <CoachThinkingIndicator />}
    </div>
  );
}

// True after the user finishes a turn ON THIS BEAT and before the coach starts
// replying. Keys off a USER final, so it never fires during the opener (no user
// turn yet) and clears as soon as the coach speaks. The B19 rules live in the
// pure coachThinkingReducer: a stream already busy at mount belongs to the
// previous beat (no loading bubble on beat load), and a stream that settles
// with no assistant output clears the latch (no stuck bubble).
function useCoachThinking(): boolean {
  const session = useOnboardingVoice();
  const subscribe = session?.subscribeTranscripts;
  const speaking = session?.isAssistantSpeaking ?? false;
  const chatBusy = session?.chatBusy ?? false;
  const [state, dispatch] = useReducer(coachThinkingReducer, COACH_THINKING_INITIAL);

  useEffect(() => {
    if (!subscribe) return;
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      if (evt.role === 'user' && evt.kind === 'final') dispatch({ type: 'user-final' });
      else if (evt.role === 'assistant') dispatch({ type: 'assistant-activity' });
    };
    return subscribe(onTranscript);
  }, [subscribe]);

  useEffect(() => {
    if (speaking) dispatch({ type: 'assistant-activity' });
  }, [speaking]);

  // Edge-detect chatBusy: only a rise observed while mounted counts as "busy
  // here"; a settle clears everything (covers reply-less failures).
  const prevBusyRef = useRef(chatBusy);
  useEffect(() => {
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = chatBusy;
    if (chatBusy && !wasBusy) dispatch({ type: 'busy-rose' });
    else if (!chatBusy && wasBusy) dispatch({ type: 'busy-settled' });
  }, [chatBusy]);

  return showCoachThinking(state, speaking);
}

// The coach "thinking" loading cue in the flow feed. Uses the home coach's
// loading BUBBLE UI (TypingIndicator) — the bigger white bubble with backdrop
// blur — but WITHOUT its "GUIDED GROWTH COACH" eyebrow label.
export function ThinkingDots() {
  return (
    <div
      className="flex w-fit animate-fade-in items-center gap-1.5 rounded-bl-2xl rounded-br-2xl rounded-tr-2xl bg-white px-5 py-5 shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.08)] backdrop-blur-[6px]"
      aria-label="Coach is thinking"
    >
      <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40 [animation-delay:150ms]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40 [animation-delay:300ms]" />
    </div>
  );
}

// Renders the typing dots only while the coach is thinking. Mount ONLY on the
// active beat (the hook subscribes to the transcript bus).
export function CoachThinkingIndicator() {
  return useCoachThinking() ? <ThinkingDots /> : null;
}

// Reveals words one at a time while `active`, dimming the not-yet-spoken ones so
// the line reads like it is being spoken. Shows the whole line when inactive.
//
// `revealCount` (optional) drives the reveal off the REAL coach audio: when a
// number is passed, exactly that many words are lit (the caller paces it from the
// voice provider's per-word or speech-window signal). When it is undefined, the
// component runs its original fixed 110ms-per-word timer, the text-only fallback
// for no-voice / Path 3 / no speech signal.
export function Karaoke({
  text,
  active,
  revealCount,
}: {
  text: string;
  active: boolean;
  revealCount?: number | null;
}) {
  const parts = text.split(/(\s+)/);
  const total = parts.filter((p) => /\S/.test(p)).length;
  // Driven mode: the caller supplies the lit-word count (audio-synced). Inactive
  // beats always show the whole line.
  const driven = active && typeof revealCount === 'number';
  const [n, setN] = useState(active ? 0 : total);
  useEffect(() => {
    // Driven by an external (audio-synced) count, the timer effect below stays
    // dormant; the render reads `revealCount` directly.
    if (driven) return;
    if (!active) {
      setN(total);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= total) window.clearInterval(id);
    }, 110);
    return () => window.clearInterval(id);
  }, [text, active, total, driven]);
  const shownCount = !active ? total : driven ? Math.max(0, Math.min(total, revealCount ?? 0)) : n;
  // Render ONLY the revealed words so the bubble GROWS word-by-word as the coach
  // speaks (like the dialogue bubbles) — not a full-width box with hidden/grey words.
  let seen = 0;
  let end = parts.length;
  for (let i = 0; i < parts.length; i += 1) {
    if (/\S/.test(parts[i])) {
      if (seen >= shownCount) {
        end = i;
        break;
      }
      seen += 1;
    }
  }
  return <>{parts.slice(0, end).join('')}</>;
}

/**
 * Plays a beat's steps in order: each fades in, the coach line karaokes, then the
 * card reveals once the spoken line has finished. `onReveal` fires after each new
 * step appears so the feed can keep the latest content in view.
 *
 * Coach-line reveal + the advance to the card are both paced off the REAL coach
 * audio via useCoachSpeechReveal (per-word over the Direct-LLM ws path, or the
 * speech window over Vapi). When no voice signal is present (text-only / Path 3 /
 * voice not engaged) it degrades to the original fixed cadence + dwell.
 */
export function BeatPlayer({
  steps,
  onReveal,
  overrideRevealCount,
}: {
  steps: BeatStep[];
  onReveal?: () => void;
  /**
   * When provided (e.g. driven by an MP3 opener's playback progress), overrides
   * the useCoachSpeechReveal signal for the active coach step. Lets the caller
   * feed an external word-count derived from audio currentTime/duration so the
   * karaoke reveal tracks the pre-encoded clip instead of the live TTS signal.
   * Pass null to fall back to the internal voice-pacing logic.
   */
  overrideRevealCount?: number | null;
}) {
  const sig = steps.map((s) => `${s.kind}:${s.say ?? ''}`).join('|');
  const [revealed, setRevealed] = useState(1);

  // The step currently being revealed (the last visible one).
  const cur = steps[revealed - 1];
  const curIsCoach = cur?.kind === 'coach' && !!cur.say;
  // Audio-synced reveal for the active coach line. The hook self-detects the
  // available signal and returns mode 'fallback' (revealCount null) when there is
  // none, so the Karaoke component then runs its own fixed-cadence timer.
  const reveal = useCoachSpeechReveal(curIsCoach ? (cur?.say ?? '') : '', curIsCoach);
  // Caller can inject an MP3-progress-derived count; that wins over the internal signal.
  const effectiveRevealCount =
    overrideRevealCount !== null && overrideRevealCount !== undefined
      ? overrideRevealCount
      : reveal.revealCount;
  const effectiveMode =
    overrideRevealCount !== null && overrideRevealCount !== undefined
      ? ('window' as const)
      : reveal.mode;

  // Restart the reveal timeline when the beat's step shape changes.
  useEffect(() => {
    setRevealed(1);
  }, [sig]);

  useEffect(() => {
    if (revealed >= steps.length) return;
    const stepNow = steps[revealed - 1];
    // Must match the tokenizer the reveal source caps revealCount at
    // (useCoachSpeechReveal.countWords / Karaoke's word filter). A raw
    // split(/\s+/) over-counts on leading/trailing whitespace, making
    // revealCount >= wordTotal unreachable so the card never reveals.
    const wordTotal = stepNow?.say ? countWords(stepNow.say) : 0;

    // Voice-driven advance: when a live speech signal is pacing the coach line,
    // hold the card until the spoken words have all been revealed (the line is
    // done), then a short breath. This tracks the real audio length instead of
    // guessing it from a per-word constant.
    const voiceDriven = stepNow?.kind === 'coach' && effectiveMode !== 'fallback';
    if (voiceDriven) {
      const revealedAll = (effectiveRevealCount ?? 0) >= wordTotal && wordTotal > 0;
      if (!revealedAll) {
        // Don't strand the card if the speech signal never completes.
        const safety = window.setTimeout(
          () => setRevealed((r) => Math.min(steps.length, r + 1)),
          VOICE_REVEAL_MAX_MS,
        );
        return () => window.clearTimeout(safety);
      }
      const t = window.setTimeout(() => setRevealed((r) => Math.min(steps.length, r + 1)), 450);
      return () => window.clearTimeout(t);
    }

    // Fallback dwell: long enough for the fixed-cadence karaoke (base + 110ms per
    // word) to "finish" before the card reveals.
    const dwell = stepNow?.say ? 650 + wordTotal * 110 : 450;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(steps.length, r + 1)), dwell);
    return () => window.clearTimeout(t);
  }, [revealed, steps, effectiveMode, effectiveRevealCount]);

  useEffect(() => {
    onReveal?.();
  }, [revealed, onReveal]);

  return (
    <div className="flex flex-col gap-4">
      {steps.slice(0, revealed).map((s, i) => {
        const last = i === revealed - 1;
        if (s.kind === 'coach' && s.say) {
          return (
            <div key={s.id} className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>
              <Karaoke
                text={s.say}
                active={last}
                // Only the active coach line is audio-driven; earlier coach lines
                // in the same beat (if any) render fully (Karaoke shows the whole
                // line when inactive).
                revealCount={last ? effectiveRevealCount : undefined}
              />
            </div>
          );
        }
        if (s.kind === 'card' && s.body) {
          return (
            <div key={s.id} className="animate-fade-in">
              {s.body}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
