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
import { useCallback } from 'react';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { CHAT_VAPI_BEAT_SCREENS } from '@/lib/onboarding/onboardingStepBeats';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { applyName } from './applyName';
import {
  BeatConversation,
  BeatPlayer,
  COACH_BUBBLE_CLASS,
  PastBeatBubbles,
  type BeatStep,
} from './BeatPlayer';
import { FROZEN_CARD_TYPES, getAdapter, summarizeBeat } from './componentRegistry';

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
  const isVapiBeat = CHAT_VAPI_BEAT_SCREENS.has(node.screenId);

  const handleReveal = useCallback(() => onReveal?.(), [onReveal]);

  // Active Vapi beat: opener → the beat component (IN the timeline) → dialogue,
  // all from the transcript store as one ordered feed.
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
