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
 * The user's words as they speak — a live blue bubble on the ACTIVE beat.
 *
 * Subscribes to the voice provider's user transcript bus (the same bus the old
 * single-page overlay reads, see OnboardingChatOverlay's partialUser listener).
 * The bus emits `{ role: 'user', kind: 'partial' }` while the user is speaking on
 * BOTH voice paths (Vapi via handleTranscript, Direct-LLM voice-in via
 * emitVoiceInInterim), and a `final` when the turn settles. We light the partial
 * smoothed by useSmoothReveal so it grows word by word, then clear it on final —
 * the captured answer then renders as the beat's settled blue reply.
 *
 * Scoped to voice turns by construction: a user transcript event only fires when
 * the mic is hot, so in text-only mode nothing arrives and the bubble never
 * shows (it renders null while empty). `onText` lets the feed scroll as it grows.
 */
export function LiveUserBubble({ onText }: { onText?: () => void }) {
  const session = useOnboardingVoice();
  const subscribe = session?.subscribeTranscripts;
  const [partial, setPartial] = useState('');
  // Settled utterances: each final becomes its OWN bubble (one composition = one
  // bubble) and STAYS on screen, instead of vanishing the moment the final lands.
  const [finals, setFinals] = useState<string[]>([]);
  const shown = useSmoothReveal(partial);

  useEffect(() => {
    if (!subscribe) return;
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      if (evt.role !== 'user') return;
      if (evt.kind === 'partial') {
        setPartial(evt.text);
        return;
      }
      const t = evt.text.trim();
      if (t) setFinals((f) => [...f, t]);
      setPartial('');
    };
    return subscribe(onTranscript);
  }, [subscribe]);

  useEffect(() => {
    if (shown.length > 0 || finals.length > 0) onText?.();
  }, [shown, finals.length, onText]);

  if (finals.length === 0 && shown.trim().length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {finals.map((t, i) => (
        <div key={i} className={USER_BUBBLE_CLASS}>
          {t}
        </div>
      ))}
      {shown.trim().length > 0 && (
        <div className={`animate-fade-in ${USER_BUBBLE_CLASS}`}>{shown}</div>
      )}
    </div>
  );
}

/**
 * The coach's LIVE spoken replies on the ACTIVE beat — the reactions and
 * confirmations Vapi/the LLM says BEYOND the authored opener ("Got it, thanks",
 * "Sleep, the foundation"). Without this, only the authored opener renders and
 * the actual conversation is invisible.
 *
 * Gated to turns AFTER the user has spoken this beat: the opener is the pre-user
 * coach turn and already renders as the karaoke line, so the post-user gate keeps
 * this from duplicating it. One settled bubble per coach utterance.
 */
export function LiveCoachBubble({ onText }: { onText?: () => void }) {
  const session = useOnboardingVoice();
  const subscribe = session?.subscribeTranscripts;
  const [partial, setPartial] = useState('');
  const [finals, setFinals] = useState<string[]>([]);
  const userSpokeRef = useRef(false);
  const shown = useSmoothReveal(partial);

  useEffect(() => {
    if (!subscribe) return;
    const onTranscript: OnboardingTranscriptListener = (evt) => {
      if (evt.role === 'user') {
        if (evt.kind === 'final') userSpokeRef.current = true;
        return;
      }
      if (evt.role !== 'assistant') return;
      // Opener (pre-user) is shown by the karaoke line — only render post-user
      // coach turns here so the opener never doubles.
      if (!userSpokeRef.current) return;
      if (evt.kind === 'partial') {
        setPartial(evt.text);
        return;
      }
      const t = evt.text.trim();
      if (t) setFinals((f) => [...f, t]);
      setPartial('');
    };
    return subscribe(onTranscript);
  }, [subscribe]);

  useEffect(() => {
    if (shown.length > 0 || finals.length > 0) onText?.();
  }, [shown, finals.length, onText]);

  if (finals.length === 0 && shown.trim().length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {finals.map((t, i) => (
        <div key={i} className={COACH_BUBBLE_CLASS}>
          {t}
        </div>
      ))}
      {shown.trim().length > 0 && (
        <div className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>{shown}</div>
      )}
    </div>
  );
}

// Three bouncing dots: the live cue that the coach is connecting / thinking, or a
// tool is in flight. Neutral by design (no words) — never narrate the system.
export function TypingIndicator() {
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

// Renders the typing dots only while the coach is thinking. Mount ONLY on the
// active beat (the hook subscribes to the transcript bus).
export function CoachThinkingIndicator() {
  return useCoachThinking() ? <TypingIndicator /> : null;
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
