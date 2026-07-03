/**
 * Flow loader + version pinning.
 *
 * STORAGE DECISION (MVP): the flow document is the GENERATED static JSON
 * (./flows/onboarding-beginner-v1.generated.json), produced from the designer's
 * source of truth by the transform (npm run flow:sync). This makes a design
 * change a data edit, not a code build, and is the spec's sanctioned
 * migration-period path ("the flow JSON can be a static file ... replaced with a
 * Supabase fetch once the admin builder is live", spec section 5.2).
 *
 * SAFE FALLBACK: the JSON load is additive. If the generated JSON is missing,
 * structurally wrong, or fails the flow-machine validation, the loader falls back
 * to the hand-authored TS flow (onboardingBeginnerV1). The engine NEVER breaks on
 * a bad generated file; the worst case is it runs the proven TS flow.
 *
 * SWAP SEAM: to move to the recommended Supabase `flow_versions` table, replace
 * the body of `loadPublishedFlow` with a React Query fetch of the published
 * `nodes` blob (cached once at onboarding entry). Nothing else changes; the
 * orchestrator and renderer only ever see a FlowDocument. This is the clear
 * follow-up once the admin builder publishes flows.
 *
 * VERSION PINNING: a user is pinned to the flow version they STARTED on, so a
 * mid-flow publish never migrates them. The pin tag (`flowId@vN`) is read from
 * `onboarding_states.data.flowVersion` (passed in as `pinnedTag`) and written
 * back on the first beat save (see useFlowOrchestrator). Until a returning user
 * has a pin, they get the latest published flow.
 */
import { useMemo } from 'react';
import { validateFlow } from './flowMachine';
import eveningGeneratedJson from './flows/evening-checkin-v1.generated.json';
import homeTourGeneratedJson from './flows/home-tour-v1.generated.json';
import morningGeneratedJson from './flows/morning-checkin-v1.generated.json';
import generatedJson from './flows/onboarding-beginner-v1.generated.json';
import type { FlowDocument, FlowNode } from './types';

/**
 * Emergency sentinel only (L1-4: the diverged hand-authored fallback flow is a
 * test fixture now). The generated JSON is gated in CI by the zod Export parse,
 * the transform throws, authoring validation, and byte-parity tests, so an
 * invalid file here means a broken BUILD. An empty flow keeps the app shell
 * alive (beatEngineMeta imports this module app-wide) and makes the breakage
 * unmissable in QA instead of silently serving a stale fork of the flow.
 */
const FALLBACK_FLOW: FlowDocument = {
  flowId: 'onboarding-beginner-v1',
  name: 'Beginner Onboarding (unavailable)',
  version: 0,
  publishedAt: '',
  entryNodeId: 'auth',
  nodes: [],
};

/**
 * Minimal structural guard before trusting the imported JSON as a FlowDocument.
 * resolveJsonModule types the import loosely, so this confirms the runtime shape
 * (header fields present, a non-empty nodes array) before validateFlow runs the
 * graph-integrity check. A failure here means we fall back to the TS flow.
 */
function isFlowDocumentShape(value: unknown): value is FlowDocument {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.flowId === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'number' &&
    typeof v.entryNodeId === 'string' &&
    Array.isArray(v.nodes) &&
    v.nodes.length > 0 &&
    (v.nodes as FlowNode[]).every((n) => n && typeof n.id === 'string')
  );
}

/**
 * The generated JSON, accepted only if it is shaped like a FlowDocument AND passes
 * the flow-machine validation (no dangling node references). Otherwise null, and
 * the loader uses the TS fallback.
 */
const GENERATED_FLOW: FlowDocument | null = (() => {
  if (!isFlowDocumentShape(generatedJson)) {
    if (import.meta.env.DEV) {
      console.warn('[flow] generated JSON has the wrong shape; using TS fallback flow.');
    }
    return null;
  }
  const problems = validateFlow(generatedJson);
  if (problems.length > 0) {
    if (import.meta.env.DEV) {
      console.warn('[flow] generated JSON failed validation; using TS fallback flow:', problems);
    }
    return null;
  }
  return generatedJson;
})();

/** The published latest flow: the generated JSON if usable, else the TS fallback. */
const LATEST_FLOW: FlowDocument = GENERATED_FLOW ?? FALLBACK_FLOW;

/** flowId minus its trailing version suffix: the stable route slug ("morning-checkin"). */
function flowSlug(flowId: string): string {
  return flowId.replace(/-v\d+$/, '');
}

/**
 * A generated LINEAR flow (builder Export -> flow:sync). No TS fallback: three
 * build-time gates (zod Export parse, authoring validation, equivalence tests)
 * make a bad file unshippable, and these flows back QA preview surfaces. An
 * invalid file is logged and left unregistered (the preview 404s honestly).
 */
function acceptGeneratedFlow(raw: unknown, label: string): FlowDocument | null {
  if (!isFlowDocumentShape(raw)) {
    console.error(`[flow] generated ${label} flow has the wrong shape; not registered.`);
    return null;
  }
  const problems = validateFlow(raw);
  if (problems.length > 0) {
    console.error(`[flow] generated ${label} flow failed validation; not registered:`, problems);
    return null;
  }
  return raw;
}

const MORNING_CHECKIN_FLOW = acceptGeneratedFlow(morningGeneratedJson, 'morning-checkin');
const EVENING_CHECKIN_FLOW = acceptGeneratedFlow(eveningGeneratedJson, 'evening-checkin');
const HOME_TOUR_FLOW = acceptGeneratedFlow(homeTourGeneratedJson, 'home-tour');

// The flow registry (L1-5). Each flow resolves three ways: flowId, versionTag
// (the pin format flowId@vN), and the version-less slug (the /flow-preview/:flowId
// route + QA tile URLs). Onboarding registers last so it wins any key collision.
const PUBLISHED_FLOWS: Record<string, FlowDocument> = {};
function registerFlow(flow: FlowDocument): void {
  PUBLISHED_FLOWS[flow.flowId] = flow;
  PUBLISHED_FLOWS[versionTag(flow)] = flow;
  PUBLISHED_FLOWS[flowSlug(flow.flowId)] = flow;
}
if (MORNING_CHECKIN_FLOW) registerFlow(MORNING_CHECKIN_FLOW);
if (EVENING_CHECKIN_FLOW) registerFlow(EVENING_CHECKIN_FLOW);
if (HOME_TOUR_FLOW) registerFlow(HOME_TOUR_FLOW);
registerFlow(LATEST_FLOW);

/** The stable pin identifier for a flow document, e.g. "onboarding-beginner-v1@v1". */
export function versionTag(flow: FlowDocument): string {
  return `${flow.flowId}@v${flow.version}`;
}

/**
 * Resolve the published ONBOARDING flow for a pin tag, or the latest if
 * unpinned/unknown (the original loader contract; beatEngineMeta and the
 * onboarding engine key off the no-arg call).
 */
export function loadPublishedFlow(pinnedTag?: string | null): FlowDocument {
  if (pinnedTag && PUBLISHED_FLOWS[pinnedTag]) return PUBLISHED_FLOWS[pinnedTag];
  return LATEST_FLOW;
}

/** Registry lookup by flowId / slug / pin tag. No onboarding fallback: unknown = undefined. */
export function getPublishedFlow(idOrTag: string): FlowDocument | undefined {
  return PUBLISHED_FLOWS[idOrTag];
}

/** Every distinct registered flow (for the preview route's not-found listing). */
export function listPublishedFlows(): FlowDocument[] {
  return [...new Set(Object.values(PUBLISHED_FLOWS))];
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
