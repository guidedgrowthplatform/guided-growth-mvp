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
import { FlowVoiceControls } from './FlowVoiceControls';

export interface FlowRendererProps {
  orchestrator: FlowOrchestrator;
}

export function FlowRenderer({ orchestrator }: FlowRendererProps) {
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

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-2">
        <div className="flex flex-col gap-5">
          {state.visited.map((id) => {
            const node = getNode(flow, id);
            if (!node) return null;
            const active = !isComplete && id === currentNode?.id;
            return (
              // display:contents wrapper: zero layout impact, but tags each beat
              // in the DOM (data-beat-id / data-beat-active) so QA walkers and
              // timeline-stability checks can observe exactly which beats render.
              <div
                key={id}
                style={{ display: 'contents' }}
                data-beat-id={id}
                data-beat-active={active || undefined}
              >
                <BeatView
                  node={node}
                  answers={answers}
                  active={active}
                  onCapture={capture}
                  onReveal={scrollToBottom}
                />
              </div>
            );
          })}

          {/* The completion line is now the into-app terminal beat (rendered above
              as the last visited node), not a hardcoded bubble here. */}

          {/* B27: the clearance below the last beat is a REAL scroll-anchored
              spacer, not trailing container padding. scrollIntoView(block:'end')
              pins THIS element to the viewport bottom, so the spacer fills the
              zone where FlowVoiceControls' orb sits (bottom-0, ~140px + safe
              area) and the active card's CTA always lands ABOVE the orb. As
              trailing container padding the clearance scrolled out of view and
              the CTA parked under the orb, which swallowed real taps on phones. */}
          <div
            ref={bottomRef}
            aria-hidden
            className="shrink-0"
            style={{ height: 'calc(180px + env(safe-area-inset-bottom))' }}
          />
        </div>
      </div>

      <FlowVoiceControls />
    </div>
  );
}
