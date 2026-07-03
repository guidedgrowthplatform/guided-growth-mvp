/**
 * Derive every step map from the flow document, so a builder reorder + flow:sync
 * updates all consumers with zero hand edits (L1-3).
 *
 * The V3 step scale has two regimes (see useFlowOrchestrator's resume notes):
 *   - POSITIONAL window: the fork + its lanes, plus pre-fork beats whose step is
 *     below the fork's (profile). Numeric steps mean position here; advance_step
 *     bare-sets restore meaning (the steps-2..5 back-nav window).
 *   - IDENTITY beats: pre-fork beats whose step is at/above the fork's (state-check
 *     6, morning 7, reflection 8). Their number is a label, not a position; their
 *     data tool saves AND advances, so the LLM must never call advance_step there.
 *
 * The advance ladder the LLM is taught runs one AHEAD from the second of two
 * consecutive same-step beats (habit-select 5, habit-schedule displayed 6): the
 * first bare-set already moved the server past the shared step.
 *
 * NO EM DASHES. Pure module: FlowDocument in, plain data out.
 */
import { enumerateWalkPaths } from '../flowMachine';
import type { BranchNode, FlowComponentType, FlowDocument, FlowNode } from '../types';

/** Which componentType owns a step, per fork lane (pre-fork beats own it on both). */
export interface StepOwners {
  [step: number]: Partial<Record<string, FlowComponentType>>;
}

/** Screen per step, per lane, first owner in walk order (beatForStep's shape). */
export interface StepScreens {
  [step: number]: Partial<Record<string, string>>;
}

export interface AdvanceLadderRung {
  /** Prompt label, e.g. "profile", "path". */
  label: string;
  /** The server-visible step while ON this beat (one-ahead after a shared step). */
  display: number;
  /** advance_step target the LLM is taught (display + 1). */
  target: number;
}

export interface DerivedStepMaps {
  /** Canonical screenId -> persist step (no legacy aliases). */
  screenToStep: Record<string, number>;
  /** Step -> session-log label (screenId with its "--SUFFIX" stripped). */
  stepToScreenLabel: Record<number, string>;
  /** ScreenId -> entry step, positional-window beats only (the back-nav table). */
  entryServerStep: Record<string, number>;
  /** toolName -> its beat's screenId, for tools owned by exactly one beat. */
  toolScreen: Record<string, string>;
  /** Identity beats: the data tool self-advances; no advance_step. Walk order. */
  selfAdvancingScreens: string[];
  /** The advance_step ladder for the beginner path's positional window. */
  advanceLadder: AdvanceLadderRung[];
  stepOwners: StepOwners;
  stepScreens: StepScreens;
  /** Highest identity step (the scale's end; legacy ids map past it by hand). */
  maxStep: number;
}

/** Prompt label per ladder node id; anything unlisted uses the node id itself. */
const LADDER_LABELS: Record<string, string> = { 'path-fork': 'path' };

const hasPersist = (n: FlowNode): n is FlowNode & { persist: { step: number } } =>
  n.persist != null;

export function deriveStepMaps(flow: FlowDocument): DerivedStepMaps {
  const fork = flow.nodes.find((n): n is BranchNode => n.type === 'branch');
  const forkStep = fork?.persist?.step ?? Number.POSITIVE_INFINITY;
  const paths = enumerateWalkPaths(flow);

  // Lane node ids (nodes reachable only inside a lane: on some path, after the fork,
  // before the merge). Everything else persisting is spine (owned by both lanes).
  const laneIdsByValue = new Map<string, Set<string>>();
  if (fork) {
    for (const lane of fork.lanes) {
      const ids = new Set<string>();
      let id: string | null = lane.entryNodeId;
      for (let guard = 0; guard < flow.nodes.length + 1 && id; guard++) {
        const node = flow.nodes.find((n) => n.id === id);
        if (!node || node.type === 'branch') break;
        ids.add(node.id);
        if (id === lane.exitNodeId) break;
        id = node.nextId;
      }
      laneIdsByValue.set(lane.value, ids);
    }
  }
  const laneOf = (nodeId: string): string | null => {
    for (const [value, ids] of laneIdsByValue) if (ids.has(nodeId)) return value;
    return null;
  };
  const laneValues = fork ? fork.lanes.map((l) => l.value) : [''];

  // Positional window: fork + lane nodes + pre/post-fork spine beats below the fork step.
  const inWindow = (n: FlowNode & { persist: { step: number } }): boolean =>
    n.id === fork?.id || laneOf(n.id) != null || n.persist.step < forkStep;

  const screenToStep: Record<string, number> = {};
  const entryServerStep: Record<string, number> = {};
  const stepOwners: StepOwners = {};
  const stepScreens: StepScreens = {};
  const selfAdvancingScreens: string[] = [];
  let maxStep = 0;

  // Walk order for stable first-owner semantics: use the first path that contains
  // each node (spine nodes appear on every path in the same order).
  const seen = new Set<string>();
  const walkOrdered: FlowNode[] = [];
  for (const path of paths) {
    for (const n of path.nodes) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        walkOrdered.push(n);
      }
    }
  }

  for (const n of walkOrdered) {
    if (!hasPersist(n)) continue;
    const step = n.persist.step;
    screenToStep[n.screenId] = step;
    maxStep = Math.max(maxStep, step);
    const owningLanes = laneOf(n.id) ? [laneOf(n.id) as string] : laneValues;
    for (const lane of owningLanes) {
      stepOwners[step] = stepOwners[step] ?? {};
      stepScreens[step] = stepScreens[step] ?? {};
      // First owner in walk order wins (habit-select over habit-schedule on 5).
      if (stepOwners[step][lane] == null) {
        stepOwners[step][lane] = n.componentType;
        stepScreens[step][lane] = n.screenId;
      }
    }
    if (inWindow(n)) {
      entryServerStep[n.screenId] = step;
    } else if (!selfAdvancingScreens.includes(n.screenId)) {
      selfAdvancingScreens.push(n.screenId);
    }
  }

  // Session-log labels: first owner per step in walk order, "--SUFFIX" stripped.
  const stepToScreenLabel: Record<number, string> = {};
  for (const n of walkOrdered) {
    if (!hasPersist(n)) continue;
    if (stepToScreenLabel[n.persist.step] == null) {
      stepToScreenLabel[n.persist.step] = n.screenId.split('--')[0];
    }
  }

  // toolName -> screenId, only when unambiguous (update_habit lives on two beats).
  const toolCounts = new Map<string, number>();
  for (const n of flow.nodes) {
    if (n.tool) toolCounts.set(n.tool.toolName, (toolCounts.get(n.tool.toolName) ?? 0) + 1);
  }
  const toolScreen: Record<string, string> = {};
  for (const n of flow.nodes) {
    if (n.tool && toolCounts.get(n.tool.toolName) === 1) toolScreen[n.tool.toolName] = n.screenId;
  }

  // The beginner-path ladder (first lane), one-ahead across shared steps.
  const ladderPath = paths[0]?.nodes ?? [];
  const advanceLadder: AdvanceLadderRung[] = [];
  let prevDisplay = Number.NEGATIVE_INFINITY;
  for (const n of ladderPath) {
    if (!hasPersist(n) || !inWindow(n)) continue;
    const display = Math.max(n.persist.step, prevDisplay + 1);
    prevDisplay = display;
    advanceLadder.push({
      label: LADDER_LABELS[n.id] ?? n.id,
      display,
      target: display + 1,
    });
  }

  return {
    screenToStep,
    stepToScreenLabel,
    entryServerStep,
    toolScreen,
    selfAdvancingScreens,
    advanceLadder,
    stepOwners,
    stepScreens,
    maxStep,
  };
}
