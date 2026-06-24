/**
 * FlowRenderer — the data-driven, continuous-chat renderer.
 *
 * Reads the running orchestrator state and renders every visited beat in order
 * as one scrolling conversation: each beat is a coach line plus its card (active
 * beat) or the user's captured answer (past beats). It holds no onboarding state
 * of its own — the orchestrator owns answers, advancing, the fork, and saving.
 */
import { Icon } from '@iconify/react';
import { useEffect, useRef } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { getNode } from '../flowMachine';
import type { FlowOrchestrator } from '../useFlowOrchestrator';
import { BeatView } from './BeatView';

export interface FlowRendererProps {
  orchestrator: FlowOrchestrator;
}

export function FlowRenderer({ orchestrator }: FlowRendererProps) {
  const { flow, state, currentNode, answers, capture, back, canGoBack, isComplete } = orchestrator;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the latest beat in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.currentNodeId, isComplete]);

  return (
    <div className="bg-background mx-auto flex h-full w-full max-w-[480px] flex-col">
      {canGoBack && (
        <div className="px-4 pt-4">
          <button
            type="button"
            aria-label="Back"
            onClick={back}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-content"
          >
            <Icon icon="ic:round-arrow-back" width={20} height={20} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
        <div className="flex flex-col gap-5">
          {state.visited.map((id) => {
            const node = getNode(flow, id);
            if (!node) return null;
            return (
              <BeatView
                key={id}
                node={node}
                answers={answers}
                active={!isComplete && id === currentNode?.id}
                onCapture={capture}
              />
            );
          })}

          {isComplete && <ChatBubble role="ai" text="You're all set. Let's get started." compact />}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
