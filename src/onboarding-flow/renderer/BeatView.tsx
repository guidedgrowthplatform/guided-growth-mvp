/**
 * One beat in the continuous chat: the coach's line, then either the
 * interactive card (active beat) or the user's captured answer (past beat).
 */
import { ChatBubble } from '@/components/voice/ChatBubble';
import type { BeatCapture, FlowAnswers, FlowNode } from '../types';
import { getAdapter, summarizeBeat } from './componentRegistry';

export interface BeatViewProps {
  node: FlowNode;
  answers: FlowAnswers;
  active: boolean;
  onCapture: (capture: BeatCapture) => void;
}

export function BeatView({ node, answers, active, onCapture }: BeatViewProps) {
  // getAdapter returns a module-stable component reference per componentType, so
  // identity only changes when the beat (and thus the card) changes — which is
  // exactly when a state reset is correct. Safe despite the static-components rule.

  const Adapter = getAdapter(node.componentType);
  const opener = node.voice.openerText;
  const summary = !active ? summarizeBeat(node, answers) : null;

  return (
    <div className="flex flex-col">
      {opener && <ChatBubble role="ai" text={opener} compact />}
      {active && Adapter ? (
        <Adapter node={node} answers={answers} onCapture={onCapture} />
      ) : (
        summary && <ChatBubble role="user" text={summary} compact />
      )}
    </div>
  );
}
