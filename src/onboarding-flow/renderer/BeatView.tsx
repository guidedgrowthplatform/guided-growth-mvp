/**
 * One beat in the continuous chat, in the LATEST flow-builder presentation model.
 *
 * Active beat: the coach line plays as a karaoke caption (a white coach bubble),
 * then the interactive card reveals beneath it (the BeatPlayer step timeline).
 * Past beats: the coach line, then either the same card re-rendered FROZEN in its
 * captured state (the data beats — profile, category, goals, habits, schedules,
 * plan — so the whole conversation stays on screen as persisted receipts), or a
 * short answer bubble for beats where a frozen form would be noise (auth, mic,
 * brain-dump, say-only). Either way the scroll reads back as a real conversation.
 *
 * The card itself is unchanged: it is the same orchestrator-wired adapter, with
 * its own state, voice capture, and save path. This view only changes how the
 * beat is presented (reveal timing + karaoke + the frozen/summary past state).
 */
import { useCallback, useLayoutEffect } from 'react';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import {
  CHAT_VAPI_BEAT_SCREENS,
  LOCAL_CAPTURE_BEATS,
} from '@/lib/onboarding/onboardingStepBeats';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { applyName } from './applyName';
import {
  BeatConversation,
  BeatPlayer,
  COACH_BUBBLE_CLASS,
  Karaoke,
  PastBeatBubbles,
  type BeatStep,
} from './BeatPlayer';
import { FROZEN_CARD_TYPES, getAdapter, summarizeBeat } from './componentRegistry';
import { useBeatOpenerCartesia } from './useBeatOpenerCartesia';
import { useBeatOpenerMp3 } from './useBeatOpenerMp3';

export interface BeatViewProps {
  node: FlowNode;
  answers: FlowAnswers;
  active: boolean;
  onCapture: (capture: BeatCapture) => void;
  /** Called whenever a step reveals, so the feed can keep the latest in view. */
  onReveal?: () => void;
}

export function BeatView({ node, answers, active, onCapture, onReveal }: BeatViewProps) {
  const session = useOnboardingVoice();
  // getAdapter returns a module-stable component reference per componentType, so
  // identity only changes when the beat (and thus the card) changes — which is
  // exactly when a state reset is correct. Safe despite the static-components rule.
  const Adapter = getAdapter(node.componentType);
  const opener = node.voice.openerText ? applyName(node.voice.openerText, answers.nickname) : null;
  const summary = !active ? summarizeBeat(node, answers) : null;
  // Does this beat have persisted/live conversation turns in the store? Drives
  // whether a PAST beat replays its real dialogue (so it never disappears) or
  // falls back to the authored opener + receipt.
  const hasBeatConversation = (session?.messages ?? []).some(
    (m) => m.screenId === node.screenId && !!m.text,
  );
  // Engine per beat is metadata-driven: read the fill brain off node.meta (the
  // re-exported flow carries it). The legacy sets stay only as a fallback for any
  // screen the meta does not cover, so behavior is identical when meta is present.
  const isLocalCaptureBeat = node.meta
    ? node.meta.fill?.brain === 'none'
    : LOCAL_CAPTURE_BEATS.has(node.screenId);
  const isVapiBeat =
    (node.meta ? node.meta.fill?.brain === 'vapi' : CHAT_VAPI_BEAT_SCREENS.has(node.screenId)) &&
    !isLocalCaptureBeat;

  // MP3 opener: metadata-authored beats play a pre-encoded clip at beat mount
  // instead of calling Cartesia or waiting for Vapi to speak the opener. The
  // progress fraction (0..1) drives the karaoke reveal in sync with the real
  // audio. For hybrid beats the MP3 is the opener only, then Vapi continues.
  const openerMp3Src =
    node.meta?.voiceOut?.engine === 'mp3'
      ? (node.meta.voiceOut.mp3Assets?.[0]?.file ?? null)
      : null;
  const hasOpenerMp3 = !!openerMp3Src;
  const mp3Audio = useBeatOpenerMp3(openerMp3Src, active && hasOpenerMp3);
  // Variable lines (engine 'cartesia', e.g. the name-greeting profile beat) get
  // live TTS: same state shape, so downstream karaoke gating is engine-agnostic.
  const isCartesiaOpener = node.meta?.voiceOut?.engine === 'cartesia' && !!opener;
  const cartesiaAudio = useBeatOpenerCartesia(
    isCartesiaOpener ? opener : null,
    active && isCartesiaOpener,
  );
  const mp3 = isCartesiaOpener ? cartesiaAudio : mp3Audio;
  const hasOpenerAudio = hasOpenerMp3 || isCartesiaOpener;
  const setScreenContextDeferred = session?.setScreenContextDeferred;
  const isHybridOpenerBeat = node.meta?.toggles?.continueVapiAfterMp3 === true;
  useLayoutEffect(() => {
    if (!setScreenContextDeferred || !active || !hasOpenerMp3 || !isHybridOpenerBeat) return;
    setScreenContextDeferred(node.screenId, !mp3.done);
    return () => setScreenContextDeferred(node.screenId, false);
  }, [
    active,
    hasOpenerMp3,
    isHybridOpenerBeat,
    mp3.done,
    node.screenId,
    setScreenContextDeferred,
  ]);
  // Map 0..1 progress fraction to a word count so Karaoke can light words in sync.
  // Falls back to null when the MP3 hasn't started (karaoke runs its own timer).
  const openerWordCount = opener
    ? mp3.progress !== null
      ? Math.round(mp3.progress * opener.trim().split(/\s+/).filter(Boolean).length)
      : null
    : null;

  const handleReveal = useCallback(() => onReveal?.(), [onReveal]);

  // Active Vapi beat with an MP3 opener: play the opener MP3 at mount, then show
  // the BeatConversation (Vapi continues). For hybrid beats the MP3 is the opener
  // only; for non-hybrid Vapi beats the MP3 replaces the Vapi-spoken opener but
  // Vapi still handles follow-up dialogue.
  if (active && Adapter && isVapiBeat && hasOpenerAudio) {
    // Render the opener bubble driven by MP3 progress, then the card + dialogue.
    return (
      <div className="flex flex-col gap-3">
        {opener && (
          <div className={`animate-fade-in ${COACH_BUBBLE_CLASS}`}>
            <Karaoke text={opener} active revealCount={openerWordCount} />
          </div>
        )}
        <BeatConversation
          key={node.id}
          screenId={node.screenId}
          active
          // Already rendered the opener bubble above; suppress the
          // BeatConversation's own opener so it doesn't double-render it.
          fallbackOpener={null}
          connecting={!isHybridOpenerBeat}
          cardReadyOverride={isHybridOpenerBeat ? mp3.done : undefined}
          card={<Adapter node={node} answers={answers} onCapture={onCapture} />}
          onText={handleReveal}
        />
      </div>
    );
  }

  // Active Vapi beat (no MP3 override): opener → the beat component (IN the
  // timeline) → dialogue, all from the transcript store as one ordered feed.
  if (active && Adapter && isVapiBeat) {
    return (
      <BeatConversation
        key={node.id}
        screenId={node.screenId}
        active
        fallbackOpener={opener}
        card={<Adapter node={node} answers={answers} onCapture={onCapture} />}
        onText={handleReveal}
      />
    );
  }

  // Active non-Vapi beat with an audio opener (MP3 clip or live Cartesia): the
  // audio plays for the opener bubble, then the card reveals; dialogue (if any)
  // streams below.
  if (active && Adapter && hasOpenerAudio) {
    const steps: BeatStep[] = [];
    if (opener) {
      steps.push({ id: `${node.id}-coach`, kind: 'coach', say: opener });
    }
    steps.push({
      id: `${node.id}-card`,
      kind: 'card',
      body: <Adapter node={node} answers={answers} onCapture={onCapture} />,
    });
    return (
      <div className="flex flex-col gap-3">
        {/* overrideRevealCount feeds the MP3 playback progress into the karaoke
            reveal so the word highlight tracks the pre-encoded clip. */}
        <BeatPlayer steps={steps} onReveal={handleReveal} overrideRevealCount={openerWordCount} />
        <BeatConversation
          key={node.id}
          screenId={node.screenId}
          active
          connecting={false}
          onText={handleReveal}
        />
      </div>
    );
  }

  // Active non-Vapi beat (text / Path-3): the authored coach line karaokes, then
  // the live card reveals beneath it; dialogue (if any) streams below.
  if (active && Adapter) {
    const steps: BeatStep[] = [];
    if (opener) steps.push({ id: `${node.id}-coach`, kind: 'coach', say: opener });
    steps.push({
      id: `${node.id}-card`,
      kind: 'card',
      body: <Adapter node={node} answers={answers} onCapture={onCapture} />,
    });
    return (
      <div className="flex flex-col gap-3">
        <BeatPlayer steps={steps} onReveal={handleReveal} />
        <BeatConversation
          key={node.id}
          screenId={node.screenId}
          active
          connecting={false}
          onText={handleReveal}
        />
      </div>
    );
  }

  // The mic-permission beat is a transient gate: once granted it collapses
  // ENTIRELY (no big dial, no opener bubble, no receipt) so the bottom orb is
  // the only voice affordance left — it must not linger in the scrollback.
  if (node.componentType === 'mic-permission') return null;

  // Past beat with a real conversation: replay the persisted turns (opener +
  // dialogue) so the completed beat keeps its whole conversation on screen and
  // rehydrates after a refresh. Data beats also keep their frozen card receipt.
  if (!active && hasBeatConversation) {
    const frozenCard =
      Adapter && FROZEN_CARD_TYPES.has(node.componentType) ? (
        <Adapter node={node} answers={answers} onCapture={onCapture} readOnly />
      ) : undefined;
    return <BeatConversation screenId={node.screenId} active={false} card={frozenCard} />;
  }

  // Past data beat with no captured conversation: the coach line, then the SAME
  // card re-rendered frozen in its captured state (inert under readOnly).
  if (Adapter && FROZEN_CARD_TYPES.has(node.componentType)) {
    return (
      <div className="flex flex-col gap-3">
        {opener && <div className={COACH_BUBBLE_CLASS}>{opener}</div>}
        <Adapter node={node} answers={answers} onCapture={onCapture} readOnly />
      </div>
    );
  }

  // Other past beats (auth, mic, brain-dump, say-only): the coach line, then the
  // user's captured answer as a short reply bubble — no frozen form.
  return (
    <div className="flex flex-col">
      <PastBeatBubbles coach={opener} reply={summary} />
    </div>
  );
}
