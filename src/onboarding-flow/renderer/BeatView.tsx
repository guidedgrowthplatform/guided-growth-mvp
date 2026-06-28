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
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { applyName } from './applyName';
import {
  BeatPlayer,
  COACH_BUBBLE_CLASS,
  CoachThinkingIndicator,
  LiveCoachBubble,
  LiveUserBubble,
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
  // getAdapter returns a module-stable component reference per componentType, so
  // identity only changes when the beat (and thus the card) changes — which is
  // exactly when a state reset is correct. Safe despite the static-components rule.
  const Adapter = getAdapter(node.componentType);
  const opener = node.voice.openerText ? applyName(node.voice.openerText, answers.nickname) : null;
  const summary = !active ? summarizeBeat(node, answers) : null;

  const handleReveal = useCallback(() => onReveal?.(), [onReveal]);

  // Active beat: coach line karaokes, then the live card reveals beneath it, and
  // the user's spoken words land live as a blue bubble below (voice turns only).
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
        {/* keyed per beat so a stale partial never carries across beats. */}
        <LiveUserBubble key={`u-${node.id}`} onText={handleReveal} />
        <LiveCoachBubble key={`c-${node.id}`} onText={handleReveal} />
        <CoachThinkingIndicator />
      </div>
    );
  }

  // Past data beat: the coach line, then the SAME card re-rendered frozen in its
  // captured state — so a completed beat stays on screen as a filled receipt
  // instead of collapsing to one line. The adapter seeds its selection from
  // `answers` and renders inert (no CTA, no taps) under readOnly.
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
