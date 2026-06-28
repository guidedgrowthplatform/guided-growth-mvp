/**
 * FlowRenderer — the data-driven, continuous-chat renderer.
 *
 * Reads the running orchestrator state and renders every visited beat in order
 * as one scrolling conversation: each beat is a coach line plus its card (active
 * beat) or the user's captured answer (past beats). It holds no onboarding state
 * of its own — the orchestrator owns answers, advancing, the fork, and saving.
 */
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef } from 'react';
import { getNode } from '../flowMachine';
import type { FlowOrchestrator } from '../useFlowOrchestrator';
import { BeatView } from './BeatView';
import { FlowSurfaceProvider } from './flowSurface';
import { FlowVoiceControls } from './FlowVoiceControls';

export interface FlowRendererProps {
  orchestrator: FlowOrchestrator;
  variant?: 'default' | 'overlay';
}

export function FlowRenderer({ orchestrator, variant = 'default' }: FlowRendererProps) {
  const overlay = variant === 'overlay';
  const { flow, state, currentNode, answers, capture, back, canGoBack, isComplete } = orchestrator;
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  // Keep the latest beat in view as the conversation grows.
  useEffect(() => {
    scrollToBottom();
  }, [state.currentNodeId, isComplete, scrollToBottom]);

  return (
    <FlowSurfaceProvider value={{ onColoredSurface: overlay }}>
      <div
        className={`${overlay ? 'bg-transparent' : 'bg-background'} relative mx-auto flex h-full w-full max-w-[480px] flex-col`}
      >
        {!overlay && canGoBack && (
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
          className={`relative z-10 flex-1 overflow-y-auto px-4 pb-[160px] ${
            overlay ? 'pt-[calc(env(safe-area-inset-top)+3.5rem)]' : 'pt-2'
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

            <div ref={bottomRef} />
          </div>
        </div>

        {!overlay && <FlowVoiceControls />}
      </div>
    </FlowSurfaceProvider>
  );
}
