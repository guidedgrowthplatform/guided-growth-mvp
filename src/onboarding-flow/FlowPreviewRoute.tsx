/**
 * Generic auth-free QA preview: /flow-preview/:flowId renders any registered
 * flow through the engine (L1-5; replaces the bespoke per-flow lazy wrappers).
 * Accepts a flowId ("morning-checkin-v1"), a version-less slug
 * ("morning-checkin"), or a flowId@vN pin tag.
 *
 * NO EM DASHES.
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useCheckinFlowPersistence } from './checkinPersistence';
import { FlowCheckinPreview } from './FlowCheckinPreview';
import type { FlowDocument } from './types';
import { getPublishedFlow, listPublishedFlows } from './useFlow';

// ?persist=real routes taps through the real check-in save path (requires a
// signed-in QA user; saves land in staging Supabase). Default stays in-memory.
function RealCheckinPreview({ flow }: { flow: FlowDocument }) {
  const type = flow.flowId.startsWith('evening') ? 'evening' : 'morning';
  const persistence = useCheckinFlowPersistence(undefined, type);
  return <FlowCheckinPreview flow={flow} persistence={persistence} />;
}

export function FlowPreviewRoute() {
  const { flowId = '' } = useParams();
  const [search] = useSearchParams();
  const flow = getPublishedFlow(flowId);

  if (!flow) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-content-secondary">
          No published flow named &ldquo;{flowId}&rdquo;.
        </p>
        <p className="text-xs text-content-tertiary">
          Registered:{' '}
          {listPublishedFlows()
            .map((f) => f.flowId)
            .join(', ')}
        </p>
      </div>
    );
  }

  const wantsRealPersistence =
    search.get('persist') === 'real' &&
    (flow.flowId.startsWith('morning-checkin') || flow.flowId.startsWith('evening-checkin'));
  if (wantsRealPersistence) return <RealCheckinPreview flow={flow} />;

  return <FlowCheckinPreview flow={flow} />;
}
