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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  useOnboardingVoice,
  type OnboardingTranscriptListener,
} from '@/contexts/useOnboardingVoiceSession';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
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

// A past beat replayed as static bubbles: the coach line, then the user's answer.
// No karaoke, no timing (the beat already happened); same visual language as the
// active beat so the scroll reads as one conversation.
export function PastBeatBubbles({
  coach,
  reply,
}: {
  coach?: string | null;
  reply?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {coach && <div className={COACH_BUBBLE_CLASS}>{coach}</div>}
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
  connecting = true,
}: {
  screenId: string;
  active: boolean;
  onText?: () => void;
  fallbackOpener?: string | null;
  // Whether to show the connecting/thinking + authored-opener failsafe. Off on the
  // non-Vapi path (the authored opener is already drawn by BeatPlayer there).
  connecting?: boolean;
}) {
  const session = useOnboardingVoice();
  const all = session?.messages;
  const subscribe = session?.subscribeTranscripts;

  const beatMsgs = (all ?? []).filter((m) => m.screenId === screenId);
  const hasCoachTurn = beatMsgs.some((m) => m.role === 'ai');

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

  // Karaoke the cold-start opener bubble IN SYNC with the Cartesia audio: it lands
  // as full text (TTS, no STT partials), and openerReveal carries the live word
  // count paced by the real playback. Only the live opener on this beat is driven;
  // hydrated / past / warm openers render in full.
  const openerReveal = session?.openerReveal;
  const coldOpenerLive = !!(active && openerReveal && openerReveal.screenId === screenId);
  const openerMsgId = beatMsgs.find((m) => m.source === 'opener')?.id;
  const showConnecting = connecting && active && !hasCoachTurn && !partial;

  return (
    <div className="flex flex-col gap-2">
      {beatMsgs.map((m) => (
        <div key={m.id} className={m.role === 'ai' ? COACH_BUBBLE_CLASS : USER_BUBBLE_CLASS}>
          {coldOpenerLive && m.id === openerMsgId ? (
            <Karaoke text={m.text} active revealCount={openerReveal!.revealedWords} />
          ) : (
            m.text
          )}
        </div>
      ))}
      {showConnecting && fallbackOn && fallbackOpener && (
        <div className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>{fallbackOpener}</div>
      )}
      {active && partial && shown.trim().length > 0 && (
        <div
          className={`animate-fade-in ${partial.role === 'ai' ? COACH_BUBBLE_CLASS : USER_BUBBLE_CLASS}`}
        >
          {shown}
        </div>
      )}
      {showConnecting && !fallbackOn ? <ThinkingDots /> : active && <CoachThinkingIndicator />}
    </div>
  );
}

// True after the user finishes a turn and before the coach starts replying (and
// while a Direct-LLM turn is in flight). Keys off a USER final, so it never fires
// during the opener (no user turn yet) and clears as soon as the coach speaks.
function useCoachThinking(): boolean {
  const session = useOnboardingVoice();
  const subscribe = session?.subscribeTranscripts;
  const speaking = session?.isAssistantSpeaking ?? false;
  const chatBusy = session?.chatBusy ?? false;
  const [awaiting, setAwaiting] = useState(false);

  useEffect(() => {
    if (!subscribe) return;
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      if (evt.role === 'user' && evt.kind === 'final') setAwaiting(true);
      else if (evt.role === 'assistant') setAwaiting(false);
    };
    return subscribe(onTranscript);
  }, [subscribe]);

  useEffect(() => {
    if (speaking) setAwaiting(false);
  }, [speaking]);

  return (awaiting || chatBusy) && !speaking;
}

// Three bouncing dots in a coach bubble — the live cue that the coach is
// connecting / thinking, or a tool is in flight. Neutral by design (no words),
// sized to the flow feed (not the old full-duplex page's labelled variant).
export function ThinkingDots() {
  return (
    <div
      className={`flex w-fit items-center gap-1.5 ${COACH_BUBBLE_CLASS} animate-fade-in`}
      aria-label="Coach is thinking"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-content/40" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-content/40 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-content/40 [animation-delay:300ms]" />
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
  let seen = 0;
  return (
    <>
      {parts.map((p, i) => {
        if (!/\S/.test(p)) return <span key={i}>{p}</span>;
        seen += 1;
        const shown = seen <= shownCount;
        return (
          <span key={i} style={{ opacity: shown ? 1 : 0.25, transition: 'opacity 160ms ease-out' }}>
            {p}
          </span>
        );
      })}
    </>
  );
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
export function BeatPlayer({ steps, onReveal }: { steps: BeatStep[]; onReveal?: () => void }) {
  const sig = steps.map((s) => `${s.kind}:${s.say ?? ''}`).join('|');
  const [revealed, setRevealed] = useState(1);

  // The step currently being revealed (the last visible one).
  const cur = steps[revealed - 1];
  const curIsCoach = cur?.kind === 'coach' && !!cur.say;
  // Audio-synced reveal for the active coach line. The hook self-detects the
  // available signal and returns mode 'fallback' (revealCount null) when there is
  // none, so the Karaoke component then runs its own fixed-cadence timer.
  const reveal = useCoachSpeechReveal(curIsCoach ? (cur?.say ?? '') : '', curIsCoach);

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
    const voiceDriven = stepNow?.kind === 'coach' && reveal.mode !== 'fallback';
    if (voiceDriven) {
      const revealedAll = (reveal.revealCount ?? 0) >= wordTotal && wordTotal > 0;
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
  }, [revealed, steps, reveal.mode, reveal.revealCount]);

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
                revealCount={last ? reveal.revealCount : undefined}
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
