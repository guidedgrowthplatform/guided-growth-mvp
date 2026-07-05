/**
 * The pure flow state machine — no React, no side effects, no persistence.
 *
 * This is the engine that fixes the original bug: answers are accumulated in one
 * place and carried across every beat, never reset per screen. The React hook
 * (useFlowOrchestrator) wraps this and layers on persistence; the machine itself
 * is fully unit-testable in isolation.
 */
import type { BeatCapture, BranchNode, FlowAnswers, FlowDocument, FlowNode } from './types';

export interface FlowMachineState {
  /** Current node being shown. null once the flow is complete. */
  currentNodeId: string | null;
  /** Ordered list of node ids that have been entered (the chat history). */
  visited: string[];
  /** Accumulated user answers, held across the whole conversation. */
  answers: FlowAnswers;
  status: 'running' | 'complete';
}

/** Build a fast id -> node lookup for a flow. */
export function indexNodes(flow: FlowDocument): Map<string, FlowNode> {
  const map = new Map<string, FlowNode>();
  for (const node of flow.nodes) map.set(node.id, node);
  return map;
}

export function getNode(flow: FlowDocument, id: string | null): FlowNode | undefined {
  if (!id) return undefined;
  return flow.nodes.find((n) => n.id === id);
}

/**
 * The tool a TAP capture on this beat should fire through the persistence
 * adapter (mined from feat/checkin-mp3-openers eed60219). Coach-driven saves
 * (save=false) already wrote server-side; the adapter owns which tools it
 * handles (onboarding omits saveTool, so this is a no-op there).
 */
export function toolSaveFor(
  node: FlowNode | undefined,
  save: boolean,
): { toolName: string } | null {
  if (!node || node.type !== 'beat' || !node.tool || !save) return null;
  return { toolName: node.tool.toolName };
}

/** Read a dot-path like "answers.path" out of the answers object. */
function readConditionValue(answers: FlowAnswers, source: string): unknown {
  const key = source.split('.').pop();
  if (!key) return undefined;
  return (answers as Record<string, unknown>)[key];
}

/**
 * Advance options. The default (live) contract treats an unanswered branch as
 * UNRESOLVABLE: the machine holds position instead of falling through to the
 * merge node. The fallthrough is opt-in for QA walks only (fastForwardToNode's
 * ?startAt targets on the merge side of a fork), never for a user-facing
 * advance: the old always-on fallthrough let a stale current_step climb push
 * an EMPTY capture through the fork, skipping the whole beginner/advanced lane
 * and running the flow to the end with path=null.
 */
export interface AdvanceOptions {
  branchFallthrough?: boolean;
}

/**
 * Given the node just captured and the merged answers, compute the next node id.
 * - beat: follow nextId (null = end of flow).
 * - branch: evaluate the condition against answers, enter the matching lane.
 *   No lane matched (the fork is unanswered): `undefined` = unresolvable, the
 *   caller holds position — unless options.branchFallthrough routes it to the
 *   merge node (QA walks only, see AdvanceOptions).
 */
export function resolveNextNodeId(
  _flow: FlowDocument,
  node: FlowNode,
  answers: FlowAnswers,
  options?: AdvanceOptions,
): string | null | undefined {
  if (node.type === 'branch') {
    const branch = node as BranchNode;
    const value = readConditionValue(answers, branch.condition.source);
    const lane = branch.lanes.find((l) => l.value === value);
    if (lane) return lane.entryNodeId;
    return options?.branchFallthrough ? branch.mergeNodeId : undefined;
  }
  return node.nextId;
}

export function initFlowMachine(flow: FlowDocument): FlowMachineState {
  return {
    currentNodeId: flow.entryNodeId,
    visited: [flow.entryNodeId],
    answers: {},
    status: 'running',
  };
}

/**
 * Apply a beat's captured answer to the machine: merge answers, then advance.
 * Pure — returns a new state, no mutation. `data` is the partial answer payload;
 * `path` (fork only) is folded into answers as `answers.path`.
 */
export function applyCapture(
  flow: FlowDocument,
  state: FlowMachineState,
  capture: BeatCapture,
  options?: AdvanceOptions,
): FlowMachineState {
  const current = getNode(flow, state.currentNodeId);
  if (!current || state.status === 'complete') return state;

  const answers: FlowAnswers = {
    ...state.answers,
    ...capture.data,
    ...(capture.path ? { path: capture.path } : {}),
  };

  const nextId = resolveNextNodeId(flow, current, answers, options);

  if (nextId === undefined) {
    // Unanswered branch = HARD STOP: merge the answers (a partial capture may
    // still carry data) but hold at the fork. The live path must never traverse
    // a branch the user has not answered.
    return { ...state, answers };
  }

  if (nextId === null) {
    return { currentNodeId: null, visited: state.visited, answers, status: 'complete' };
  }

  return {
    currentNodeId: nextId,
    visited: state.visited.includes(nextId) ? state.visited : [...state.visited, nextId],
    answers,
    status: 'running',
  };
}

/**
 * Jump back to a node (the back action). Pure; trims visited to that node. Only
 * goes back to a beat actually visited this session, so the entry beat (whose
 * backId may point at a node owned by a prior route) has no in-engine back.
 */
export function goBack(flow: FlowDocument, state: FlowMachineState): FlowMachineState {
  const current = getNode(flow, state.currentNodeId);
  const backId = current && current.type !== 'branch' ? current.backId : null;
  const idx = backId ? state.visited.lastIndexOf(backId) : -1;
  if (idx < 0) return state;
  return {
    currentNodeId: backId,
    visited: state.visited.slice(0, idx + 1),
    answers: state.answers,
    status: 'running',
  };
}

/** Can the back action fire from the current node (a visited, non-branch backId)? */
export function canGoBack(state: FlowMachineState, flow: FlowDocument): boolean {
  const current = getNode(flow, state.currentNodeId);
  if (!current || current.type === 'branch' || !current.backId) return false;
  return state.visited.includes(current.backId);
}

/**
 * Static integrity check: every referenced node id resolves. Returns a list of
 * human-readable problems (empty = valid). Run at load to catch authoring slips
 * before they reach a user mid-flow.
 */
export function validateFlow(flow: FlowDocument): string[] {
  const problems: string[] = [];
  const ids = new Set(flow.nodes.map((n) => n.id));
  const ref = (id: string | null, where: string) => {
    if (id && !ids.has(id)) problems.push(`${where} -> unknown node "${id}"`);
  };

  if (!ids.has(flow.entryNodeId))
    problems.push(`entryNodeId -> unknown node "${flow.entryNodeId}"`);

  for (const node of flow.nodes) {
    if (node.type === 'beat') {
      ref(node.nextId, `${node.id}.nextId`);
      ref(node.backId, `${node.id}.backId`);
    } else {
      ref(node.mergeNodeId, `${node.id}.mergeNodeId`);
      for (const lane of node.lanes) {
        ref(lane.entryNodeId, `${node.id}.lane[${lane.value}].entryNodeId`);
        ref(lane.exitNodeId, `${node.id}.lane[${lane.value}].exitNodeId`);
      }
    }
  }
  return problems;
}

/** One full walk through the flow: the lane label ('' = linear) + nodes in order. */
export interface WalkPath {
  label: string;
  nodes: FlowNode[];
}

/**
 * Every enumerable walk through the flow: one path per branch lane (lane chain,
 * then the merge-side spine), or the single linear chain for branchless flows.
 */
export function enumerateWalkPaths(flow: FlowDocument): WalkPath[] {
  const walkFrom = (startId: string | null, into: FlowNode[]): BranchNode | null => {
    // Walk beats from startId, appending to `into`; stop at a branch (returned) or end.
    let id = startId;
    for (let guard = 0; guard < flow.nodes.length + 1 && id; guard++) {
      const node = getNode(flow, id);
      if (!node) return null;
      if (node.type === 'branch') return node;
      into.push(node);
      id = node.nextId;
    }
    return null;
  };

  const spine: FlowNode[] = [];
  const branch = walkFrom(flow.entryNodeId, spine);
  if (!branch) return [{ label: '', nodes: spine }];

  return branch.lanes.map((lane) => {
    const nodes = [...spine, branch];
    const laneNodes: FlowNode[] = [];
    walkFrom(lane.entryNodeId, laneNodes);
    // Lane chains end at the exit node; the merge-side spine continues after it.
    const exitIdx = laneNodes.findIndex((n) => n.id === lane.exitNodeId);
    nodes.push(...(exitIdx >= 0 ? laneNodes.slice(0, exitIdx + 1) : laneNodes));
    walkFrom(branch.mergeNodeId, nodes);
    return { label: lane.value, nodes };
  });
}

/**
 * Authoring-time validation, run post-transform by flow:sync. NOT run at load:
 * runtime keeps validateFlow + the TS fallback. Persist steps are non-monotonic
 * vs flow order BY DESIGN (see useFlowOrchestrator's ENTRY_SERVER_STEP note);
 * what resume actually needs is checked here:
 *   - every node carries runtime meta (resolveMeta output);
 *   - on any walk path a persist.step never recurs after a different step
 *     intervened (steps are identity labels; A..B..A corrupts resume);
 *   - inside a branch lane (the steps-2..5 back-nav window, where numeric steps
 *     still mean position) steps are non-decreasing.
 */
export function validateFlowAuthoring(flow: FlowDocument): string[] {
  const problems = validateFlow(flow);
  if (problems.length > 0) return problems; // graph is broken; walks below would lie

  for (const node of flow.nodes) {
    if (!node.meta) problems.push(`${node.id}.meta -> missing runtime meta`);
  }

  for (const path of enumerateWalkPaths(flow)) {
    const persisting = path.nodes.filter((n) => n.persist != null);
    const lastIndexOfStep = new Map<number, number>();
    persisting.forEach((node, i) => {
      const step = node.persist!.step;
      const last = lastIndexOfStep.get(step);
      if (last !== undefined && last !== i - 1) {
        problems.push(
          `persist.step ${step} recurs at "${node.id}" after other steps intervened` +
            `${path.label ? ` (lane "${path.label}")` : ''}`,
        );
      }
      lastIndexOfStep.set(step, i);
    });
  }

  for (const node of flow.nodes) {
    if (node.type !== 'branch') continue;
    for (const lane of node.lanes) {
      let prev = node.persist?.step ?? Number.NEGATIVE_INFINITY;
      let prevId = node.id;
      let id: string | null = lane.entryNodeId;
      for (let guard = 0; guard < flow.nodes.length + 1 && id; guard++) {
        const laneNode = getNode(flow, id);
        if (!laneNode || laneNode.type === 'branch') break;
        if (laneNode.persist) {
          if (laneNode.persist.step < prev) {
            problems.push(
              `persist.step not monotonic in lane "${lane.value}": ` +
                `"${laneNode.id}" (${laneNode.persist.step}) follows "${prevId}" (${prev})`,
            );
          }
          prev = laneNode.persist.step;
          prevId = laneNode.id;
        }
        if (id === lane.exitNodeId) break;
        id = laneNode.nextId;
      }
    }
  }

  return problems;
}
