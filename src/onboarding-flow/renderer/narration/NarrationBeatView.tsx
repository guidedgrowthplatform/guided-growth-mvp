/**
 * NarrationBeatView — the narration driver (Lane A A1,
 * onboarding-consolidation-plan-2026-07-06 section-6 gap 1).
 *
 * Plays a beat whose node carries narration[]: the ordered bubble/reveal
 * script runs one segment at a time. Bubble segments draw coach bubbles whose
 * karaoke rides the segment's REAL audio; reveal segments bloom the card's
 * nth element while their say line (if any) plays verbal-only. After the last
 * segment the beat hands over to the normal dialogue stream.
 *
 * Audio per segment reuses useBeatOpenerMp3 wholesale (preload pool, autoplay
 * gesture fallback, activation tokens, QA mute): the driver just swaps the src
 * as segments advance. Karaoke pinning reuses openerRevealPin (B4/B28/B29
 * invariants). Per-word captions ride in automatically when a clip's entry
 * exists in openerCaptions.ts (keyed by resolved src); clips without captions
 * keep the duration-fraction reveal. The render's beatNarration.ts is the
 * REFERENCE for this sequencing, not ported code (it is preview harness).
 *
 * Component-owned beats (greeting, mic) never reach this view: BeatView skips
 * the driver for node.componentOwned so their audio/orb is not double-played.
 *
 * NO EM DASHES.
 */
import { useEffect, useRef, useState } from 'react';
import type { BeatCapture, FlowAnswers, FlowNode, NarrationSegment } from '../../types';
import { applyName } from '../applyName';
import { BeatConversation, COACH_BUBBLE_CLASS, Karaoke } from '../BeatPlayer';
import { openerRevealPin } from '../openerReveal';
import { useBeatOpenerMp3 } from '../useBeatOpenerMp3';
import { countWords } from '../useCoachSpeechReveal';
import { narrationClipSrc } from './narrationClips';
import { NarrationRevealContext } from './NarrationRevealContext';
import {
  cardVisibleAt,
  narrationDone,
  revealCountAt,
  silentDwellMs,
  visibleBubbles,
} from './narrationSchedule';

// Breath between a finished segment's audio and the next segment starting,
// mirroring BeatPlayer's post-line pause.
const SEGMENT_BREATH_MS = 450;

// B28-equivalent affordance while a clip holds for the autoplay-unlock gesture.
function TapToPlayHint() {
  return (
    <button
      type="button"
      aria-label="Tap to play the coach audio"
      className="animate-fade-in self-start rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-content-secondary shadow-sm"
    >
      🔊 Tap to play
    </button>
  );
}

export interface NarrationBeatViewProps {
  node: FlowNode;
  answers: FlowAnswers;
  card: React.ReactNode;
  onCapture: (capture: BeatCapture) => void;
  onReveal?: () => void;
}

export function NarrationBeatView({ node, answers, card, onReveal }: NarrationBeatViewProps) {
  const segments: NarrationSegment[] = node.narration ?? [];
  const [segIdx, setSegIdx] = useState(0);
  const active = segIdx < segments.length ? segments[segIdx] : null;

  // Segment audio: one hook instance, src swaps per segment. The hook fully
  // resets per src change (its effect keys on [active, src]).
  const say = active?.say ? applyName(active.say, answers.nickname) : '';
  const clipSrc = active?.clip ? narrationClipSrc(active.clip) : null;
  const wordTotal = say ? countWords(say) : 0;
  const audio = useBeatOpenerMp3(clipSrc, !!clipSrc, wordTotal);

  // Advance on the segment's terminal condition: audio settled (clip segments,
  // after a breath) or the text-cadence dwell (clip-less segments). The done
  // flag belongs to the CURRENT src only; keying the effect on segIdx keeps a
  // late settle from a previous segment out of the next one's advance.
  const segIdxRef = useRef(segIdx);
  segIdxRef.current = segIdx;
  useEffect(() => {
    if (!active) return;
    const here = segIdxRef.current;
    if (clipSrc) {
      if (!audio.done) return;
      const t = window.setTimeout(() => {
        setSegIdx((i) => (i === here ? i + 1 : i));
      }, SEGMENT_BREATH_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setSegIdx((i) => (i === here ? i + 1 : i));
    }, silentDwellMs(active));
    return () => window.clearTimeout(t);
  }, [segIdx, audio.done, clipSrc, active]);

  // Keep the feed pinned as segments and the card land.
  const revealTick = segIdx + (cardVisibleAt(segments, segIdx) ? 1 : 0);
  useEffect(() => {
    onReveal?.();
  }, [revealTick, onReveal]);

  const bubbles = visibleBubbles(segments, segIdx);
  const revealN = revealCountAt(segments, segIdx);
  const showCard = cardVisibleAt(segments, segIdx);
  const done = narrationDone(segments, segIdx);

  // Karaoke pin for the ACTIVE bubble segment (B4/B28/B29 invariants). Reveal
  // segments speak verbal-only: their say never renders, so no pin needed.
  const activeIsBubble = active?.kind === 'bubble' && !!active.say;
  const pinned = openerRevealPin({
    wordCount: wordTotal,
    progress: audio.progress,
    revealWords: audio.revealWords,
    hasOpenerAudio: !!clipSrc,
    playing: audio.playing,
    done: audio.done,
    textFallback: audio.textFallback,
  });
  const showTapToPlay = !!clipSrc && audio.blocked;

  return (
    <div className="flex flex-col gap-3">
      {bubbles.map((b) => {
        const isActive = activeIsBubble && b.segIdx === segIdx;
        const text = applyName(b.say, answers.nickname);
        return (
          <div key={b.segIdx} className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>
            <Karaoke text={text} active={isActive} revealCount={isActive ? pinned : undefined} />
          </div>
        );
      })}
      {showTapToPlay && <TapToPlayHint />}
      {showCard && (
        <div className="animate-fade-in">
          <NarrationRevealContext.Provider value={done ? null : revealN}>
            {card}
          </NarrationRevealContext.Provider>
        </div>
      )}
      {/* After the script, the normal dialogue stream continues below the card
          (voice or taps); hideOpener because the bubbles above already drew the
          coach's scripted lines. */}
      {done && (
        <BeatConversation
          key={node.id}
          screenId={node.screenId}
          active
          connecting={false}
          hideOpener
          onText={onReveal}
        />
      )}
    </div>
  );
}
