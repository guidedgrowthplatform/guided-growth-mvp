/**
 * WeeklySessionPage — QA-only surface that runs The Weekly as a LIVE Vapi voice
 * session. A signed-in tester starts the session, the dedicated weekly coach
 * speaks first with their real week data, and the 5 beats advance as the coach
 * calls weekly_advance. The session ends after weekly_complete.
 *
 * Mounts the flow exactly like FlowCheckinPreview (published flow + in-memory
 * persistence + FlowRenderer) and adds the live voice seam on top. This page
 * deliberately bypasses the day + reflection trigger rule; the info chips are
 * informational only and never block starting.
 *
 * Gated behind QA_SCREEN_ENABLED, the same flag the /onboarding/qa route uses.
 *
 * NO EM DASHES.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLocalPersistence } from '@/onboarding-flow/persistence';
import { FlowRenderer } from '@/onboarding-flow/renderer/FlowRenderer';
import type { FlowDocument } from '@/onboarding-flow/types';
import { getPublishedFlow } from '@/onboarding-flow/useFlow';
import { useFlowOrchestrator } from '@/onboarding-flow/useFlowOrchestrator';
import { useWeeklyVoiceSession } from '@/weekly/useWeeklyVoiceSession';

const QA_SCREEN_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

// Grace after weekly_complete so the coach's closing line can finish before the
// call is cut.
const WEEKLY_COMPLETE_GRACE_MS = 4000;

export function WeeklySessionPage() {
  if (!QA_SCREEN_ENABLED) return <Navigate to="/" replace />;
  return <WeeklySessionGate />;
}

function WeeklySessionGate() {
  const flow = getPublishedFlow('weekly-checkin');
  if (!flow) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-content-secondary">The weekly-checkin flow is not registered.</p>
      </div>
    );
  }
  return <WeeklySessionRunner flow={flow} />;
}

function Chip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        on ? 'bg-warning/15 text-warning' : 'bg-surface-secondary text-content-tertiary'
      }`}
    >
      {label}: {on ? 'yes' : 'no'}
    </span>
  );
}

function WeeklySessionRunner({ flow }: { flow: FlowDocument }) {
  const persistence = useLocalPersistence();
  const orchestrator = useFlowOrchestrator(flow, persistence);
  const [recorded, setRecorded] = useState(false);

  // Latest orchestrator for the stable voice callbacks.
  const orchestratorRef = useRef(orchestrator);
  useEffect(() => {
    orchestratorRef.current = orchestrator;
  });

  const stopRef = useRef<() => void>(() => {});

  const handleAdvance = useCallback(() => {
    orchestratorRef.current.capture({ data: {} });
  }, []);

  const handleComplete = useCallback(() => {
    setRecorded(true);
    window.setTimeout(() => stopRef.current(), WEEKLY_COMPLETE_GRACE_MS);
  }, []);

  const { start, stop, pushBeatContext, isActive, isSpeaking, error, weekContext, loading } =
    useWeeklyVoiceSession({ onAdvance: handleAdvance, onComplete: handleComplete });

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // Push each non-entry beat's context to the live coach as the flow advances.
  // The entry beat's context rode initial_screen_context at cold start.
  const currentNode = orchestrator.currentNode;
  const currentNodeId = orchestrator.state.currentNodeId;
  const pushedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive || !currentNode) return;
    if (currentNodeId === flow.entryNodeId) return;
    if (pushedForRef.current === currentNodeId) return;
    pushedForRef.current = currentNodeId;
    pushBeatContext(currentNode.context.contextBlock);
  }, [isActive, currentNode, currentNodeId, flow.entryNodeId, pushBeatContext]);

  let status: string;
  if (error) status = `Something went wrong: ${error}`;
  else if (recorded) status = 'Session recorded';
  else if (loading) status = 'Loading week data';
  else if (isActive) status = isSpeaking ? 'Live, coach is speaking' : 'Live, listening';
  else if (weekContext) status = 'Ready to begin';
  else status = 'Loading week data';

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-content">The Weekly (QA)</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
              QA
            </span>
          </div>

          <p className={`text-sm ${error ? 'text-danger' : 'text-content-secondary'}`}>{status}</p>

          {weekContext && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip label="thin data" on={weekContext.thinData} />
              <Chip label="already ran this week" on={weekContext.alreadyRanThisWeek} />
            </div>
          )}

          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void start()}
              disabled={!weekContext || loading || isActive || recorded}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Start session
            </button>
            {isActive && (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-full bg-surface-secondary px-5 py-2 text-sm font-semibold text-content"
              >
                End session
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <FlowRenderer orchestrator={orchestrator} />
      </div>
    </div>
  );
}
