/**
 * Generic auth-free QA preview: /flow-preview/:flowId renders any registered
 * flow through the engine (L1-5; replaces the bespoke per-flow lazy wrappers).
 * Accepts a flowId ("morning-checkin-v1"), a version-less slug
 * ("morning-checkin"), or a flowId@vN pin tag.
 *
 * NO EM DASHES.
 */
import { useParams } from 'react-router-dom';
import { FlowCheckinPreview } from './FlowCheckinPreview';
import { getPublishedFlow, listPublishedFlows } from './useFlow';

export function FlowPreviewRoute() {
  const { flowId = '' } = useParams();
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

  return <FlowCheckinPreview flow={flow} />;
}
