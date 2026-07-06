/**
 * NarrationBeatView — the narration driver (Lane A A1,
 * onboarding-consolidation-plan-2026-07-06 section-6 gap 1).
 *
 * Plays a beat whose node carries narration[]: the ordered bubble/reveal
 * script runs one segment at a time. Bubble segments draw coach bubbles whose
 * karaoke rides the segment's REAL audio; reveal segments bloom the card's
 * nth element while their say line (if any) plays verbal-only. CLOSE segments
 * (the advanced-capture close line, the advanced-frequency confirm) hold
 * until the beat's interaction completes: when the card fires its capture,
 * the driver plays the closes as bubbles below the card, then forwards the
 * capture so the flow advances. After the script the beat hands over to the
 * normal dialogue stream.
 *
 * Audio per segment reuses useBeatOpenerMp3 wholesale (preload pool, autoplay
 * gesture fallback, activation tokens, QA mute): the driver just swaps the src
 * as segments advance. Clip refs resolve through the beat's mp3Assets first
 * (the Lane B converter's model), then path rules (narrationClips.ts).
 * Karaoke pinning reuses openerRevealPin (B4/B28/B29 invariants). Per-word
 * captions ride in automatically when a clip's entry exists in
 * openerCaptions.ts (clip-name or src key); clips without captions keep the
 * duration-fraction reveal. The render's beatNarration.ts is the REFERENCE
 * for this sequencing, not ported code (it is preview harness).
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
  closeSegments,
  narrationDone,
  revealCountAt,
  scriptSegments,
  silentDwellMs,
  visibleBubbles,
} from './narrationSchedule';

// Breath between a finished segment's audio and the next segment starting,
// mirroring BeatPlayer's post-line pause.
const SEGMENT_BREATH_MS = 450;

// Hard ceiling on a close segment: if its audio never settles (stalled clip),
// force the advance so a finished interaction can never strand the beat
// (BeatPlayer's VOICE_REVEAL_MAX_MS, same rationale).
const CLOSE_SEGMENT_MAX_MS = 12000;

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
  /** Renders the beat's card wired to the given capture handler, so the
   * driver can hold the capture behind the close script. */
  renderCard: (onCapture: (capture: BeatCapture) => void) => React.ReactNode;
  onCapture: (capture: BeatCapture) => void;
  onReveal?: () => void;
}

export function NarrationBeatView({
  node,
  answers,
  renderCard,
  onCapture,
  onReveal,
}: NarrationBeatViewProps) {
  const allSegments: NarrationSegment[] = node.narration ?? [];
  const script = scriptSegments(allSegments);
  const closes = closeSegments(allSegments);

  const [segIdx, setSegIdx] = useState(0);
  const [closeIdx, setCloseIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  // The capture that triggered the close script; forwarded when it finishes.
  // A re-capture during the closes keeps the NEWEST data.
  const pendingCaptureRef = useRef<BeatCapture | null>(null);

  const closeDone = closeIdx >= closes.length;
  const active: NarrationSegment | null = closing
    ? closeDone
      ? null
      : closes[closeIdx]
    : segIdx < script.length
      ? script[segIdx]
      : null;

  // Segment audio: one hook instance, src swaps per segment. The hook fully
  // resets per src change (its effect keys on [active, src]).
  const say = active?.say ? applyName(active.say, answers.nickname) : '';
  const mp3Assets = node.meta?.voiceOut?.mp3Assets;
  const clipSrc = active?.clip ? narrationClipSrc(active.clip, mp3Assets) : null;
  const wordTotal = say ? countWords(say) : 0;
  const audio = useBeatOpenerMp3(clipSrc, !!clipSrc, wordTotal);

  // Advance on the segment's terminal condition: audio settled (clip segments,
  // after a breath) or the text-cadence dwell (clip-less segments). Keying on
  // the phase + index keeps a late settle from a previous segment out of the
  // next one's advance.
  const phaseKey = closing ? `close-${closeIdx}` : `script-${segIdx}`;
  const phaseKeyRef = useRef(phaseKey);
  phaseKeyRef.current = phaseKey;
  useEffect(() => {
    if (!active) return;
    const here = phaseKeyRef.current;
    const isClose = closing;
    const bump = () => {
      if (phaseKeyRef.current !== here) return;
      if (isClose) setCloseIdx((i) => i + 1);
      else setSegIdx((i) => i + 1);
    };
    if (clipSrc) {
      if (!audio.done) {
        // A close must not strand a completed interaction on a stalled clip;
        // script segments keep B4's hold-until-audio semantics.
        if (!isClose) return;
        const cap = window.setTimeout(bump, CLOSE_SEGMENT_MAX_MS);
        return () => window.clearTimeout(cap);
      }
      const t = window.setTimeout(bump, SEGMENT_BREATH_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(bump, silentDwellMs(active));
    return () => window.clearTimeout(t);
  }, [phaseKey, audio.done, clipSrc, active, closing]);

  // Forward the held capture once the close script finishes.
  useEffect(() => {
    if (!closing || !closeDone) return;
    const capture = pendingCaptureRef.current;
    if (!capture) return;
    pendingCaptureRef.current = null;
    onCapture(capture);
  }, [closing, closeDone, onCapture]);

  const handleCapture = (capture: BeatCapture) => {
    if (closes.length === 0) {
      onCapture(capture);
      return;
    }
    pendingCaptureRef.current = capture;
    if (!closing) setClosing(true);
  };

  // Keep the feed pinned as segments, the card, and the closes land.
  const revealTick = segIdx + closeIdx + (cardVisibleAt(script, segIdx) ? 1 : 0);
  useEffect(() => {
    onReveal?.();
  }, [revealTick, onReveal]);

  const bubbles = visibleBubbles(script, segIdx);
  const revealN = revealCountAt(script, segIdx);
  const showCard = cardVisibleAt(script, segIdx) || closing;
  const scriptDone = narrationDone(script, segIdx);
  // Close bubbles shown so far (the active one included; it karaokes).
  const closeBubbles = closing ? closes.slice(0, Math.min(closeIdx + 1, closes.length)) : [];

  // Karaoke pin for the ACTIVE bubble/close segment (B4/B28/B29 invariants).
  // Reveal segments speak verbal-only: their say never renders, so no pin.
  const activeDrawsBubble = !!active && active.kind !== 'reveal' && !!active.say;
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
        const isActive = !closing && activeDrawsBubble && b.segIdx === segIdx;
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
          <NarrationRevealContext.Provider value={scriptDone || closing ? null : revealN}>
            {renderCard(handleCapture)}
          </NarrationRevealContext.Provider>
        </div>
      )}
      {/* Close bubbles: the coach's post-interaction lines, below the card. */}
      {closeBubbles.map((seg, i) => {
        if (!seg.say) return null;
        const isActive = closing && activeDrawsBubble && i === closeIdx;
        const text = applyName(seg.say, answers.nickname);
        return (
          <div key={`close-${i}`} className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>
            <Karaoke text={text} active={isActive} revealCount={isActive ? pinned : undefined} />
          </div>
        );
      })}
      {/* After the script, the normal dialogue stream continues below the card
          (voice or taps); hideOpener because the bubbles above already drew the
          coach's scripted lines. */}
      {scriptDone && !closing && (
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
