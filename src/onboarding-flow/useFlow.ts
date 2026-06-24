/**
 * Flow loader + version pinning.
 *
 * STORAGE DECISION (MVP): the flow document is a committed static module
 * (./flows/*). This unblocks the engine with no DB migration and is the spec's
 * sanctioned migration-period path ("the flow JSON can be a static file ...
 * replaced with a Supabase fetch once the admin builder is live").
 *
 * SWAP SEAM: to move to the recommended Supabase `flow_versions` table, replace
 * the body of `loadPublishedFlow` with a React Query fetch of the published
 * `nodes` blob (cached once at onboarding entry). Nothing else changes — the
 * orchestrator and renderer only ever see a FlowDocument.
 *
 * VERSION PINNING: a user is pinned to the flow version they STARTED on, so a
 * mid-flow publish never migrates them. The pin tag (`flowId@vN`) is read from
 * `onboarding_states.data.flowVersion` (passed in as `pinnedTag`) and written
 * back on the first beat save (see useFlowOrchestrator). Until a returning user
 * has a pin, they get the latest published flow.
 */
import { useMemo } from 'react';
import { validateFlow } from './flowMachine';
import { onboardingBeginnerV1 } from './flows/onboarding-beginner-v1';
import type { FlowDocument } from './types';

const PUBLISHED_FLOWS: Record<string, FlowDocument> = {
  [versionTag(onboardingBeginnerV1)]: onboardingBeginnerV1,
};

const LATEST_FLOW = onboardingBeginnerV1;

/** The stable pin identifier for a flow document, e.g. "onboarding-beginner-v1@v1". */
export function versionTag(flow: FlowDocument): string {
  return `${flow.flowId}@v${flow.version}`;
}

/** Resolve the published flow for a pin tag, or the latest if unpinned/unknown. */
export function loadPublishedFlow(pinnedTag?: string | null): FlowDocument {
  if (pinnedTag && PUBLISHED_FLOWS[pinnedTag]) return PUBLISHED_FLOWS[pinnedTag];
  return LATEST_FLOW;
}

export interface LoadedFlow {
  flow: FlowDocument;
  /** Stable pin tag for the resolved flow; persist this on the user's first save. */
  tag: string;
  /** Authoring integrity problems (empty = valid). */
  problems: string[];
}

/**
 * Load the flow for this session. Pass the user's persisted pin tag (from
 * onboarding_states.data.flowVersion) to keep returning users on their version.
 */
export function useFlow(pinnedTag?: string | null): LoadedFlow {
  return useMemo(() => {
    const flow = loadPublishedFlow(pinnedTag);
    return { flow, tag: versionTag(flow), problems: validateFlow(flow) };
  }, [pinnedTag]);
}
