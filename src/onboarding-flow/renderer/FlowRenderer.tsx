/**
 * FlowRenderer — the data-driven, continuous-chat renderer.
 *
 * Reads the running orchestrator state and renders every visited beat in order
 * as one scrolling conversation: each beat is a coach line plus its card (active
 * beat) or the user's captured answer (past beats). It holds no onboarding state
 * of its own — the orchestrator owns answers, advancing, the fork, and saving.
 *
 * Scrolling is the shared chat behaviour (useStickToBottom): new content pushes
 * the feed up like a real chat while the user is near the bottom, and the feed
 * ends with a cutoff of padding ABOVE the orb so cards never slide under it.
 */
import { Icon } from '@iconify/react';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { getNode } from '../flowMachine';
import type { FlowOrchestrator } from '../useFlowOrchestrator';
import { PastBeatBubbles } from './BeatPlayer';
import { BeatView } from './BeatView';
import { FlowVoiceControls } from './FlowVoiceControls';

export interface FlowRendererProps {
  orchestrator: FlowOrchestrator;
  // The floating voice orb. Surfaces that render their own bottom controls
  // (the sim's Listen bar) pass false so the orb does not overlap them.
  showVoiceControls?: boolean;
}

export function FlowRenderer({ orchestrator, showVoiceControls = true }: FlowRendererProps) {
  const { flow, state, currentNode, answers, capture, back, canGoBack, isComplete } = orchestrator;

  // Re-pin to the bottom whenever a beat advances or the flow completes; per-step
  // reveals inside a beat pin via onReveal below.
  const contentKey = `${state.currentNodeId}:${state.visited.length}:${isComplete ? 1 : 0}`;
  const { scrollRef, onScroll, scrollToBottom } = useStickToBottom(contentKey);

  return (
    <div className="bg-background relative mx-auto flex h-full w-full max-w-[480px] flex-col">
      {/* The only gradient is the dynamic voice one painted by FlowVoiceControls at
          the bottom (blue idle, yellow listening). No static background layer. */}
      {canGoBack && (
        <div className="relative z-10 px-4 pt-4">
          <button
            type="button"
            aria-label="Back"
            onClick={back}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-content shadow-card"
          >
            <Icon icon="ic:round-arrow-back" width={20} height={20} />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`relative z-10 flex-1 overflow-y-auto px-4 pt-2 ${
          showVoiceControls ? 'pb-[184px]' : 'pb-6'
        }`}
      >
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
                onReveal={scrollToBottom}
              />
            );
          })}

          {isComplete && (
            <PastBeatBubbles coach="You're all set. Let's get started." reply={null} />
          )}
        </div>
      </div>

      {showVoiceControls && <FlowVoiceControls />}
    </div>
  );
}
