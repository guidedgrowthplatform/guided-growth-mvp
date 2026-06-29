/**
 * One beat in the continuous chat, in the LATEST flow-builder presentation model.
 *
 * Active beat: the coach line plays as a karaoke caption (a white coach bubble),
 * then the interactive card reveals beneath it (the BeatPlayer step timeline).
 * Past beats: the coach line, then the user's captured answer as a blue reply
 * bubble, so the scroll reads back as a real coach/user conversation.
 *
 * The card itself is unchanged: it is the same orchestrator-wired adapter, with
 * its own state, voice capture, and save path. This view only changes how the
 * beat is presented (reveal timing + karaoke + the user-reply bubble per beat).
 */
import { useCallback } from 'react';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { applyName } from './applyName';
import {
  BeatPlayer,
  LiveUserBubble,
  PastBeatBubbles,
  splitCoachLines,
  type BeatStep,
} from './BeatPlayer';
import { getAdapter, summarizeBeat } from './componentRegistry';

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
    if (opener)
      for (const [i, line] of splitCoachLines(opener).entries())
        steps.push({ id: `${node.id}-coach-${i}`, kind: 'coach', say: line });
    steps.push({
      id: `${node.id}-card`,
      kind: 'card',
      body: <Adapter node={node} answers={answers} onCapture={onCapture} />,
    });
    return (
      <div className="flex flex-col gap-3">
        <BeatPlayer steps={steps} onReveal={handleReveal} />
        {/* key per beat so a stale partial never carries across beats. */}
        <LiveUserBubble key={node.id} onText={handleReveal} />
      </div>
    );
  }

  // Past beat: the coach line, then the user's captured answer as a reply bubble,
  // replayed in the same chat language as the active beat (no karaoke timing).
  return (
    <div className="flex flex-col">
      <PastBeatBubbles coach={opener} reply={summary} />
    </div>
  );
}
