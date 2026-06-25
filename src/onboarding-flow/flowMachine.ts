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

/** Read a dot-path like "answers.path" out of the answers object. */
function readConditionValue(answers: FlowAnswers, source: string): unknown {
  const key = source.split('.').pop();
  if (!key) return undefined;
  return (answers as Record<string, unknown>)[key];
}

/**
 * Given the node just captured and the merged answers, compute the next node id.
 * - beat: follow nextId (null = end of flow).
 * - branch: evaluate the condition against answers, enter the matching lane.
 *   Falls back to the merge node if no lane matches (never dead-ends mid-flow).
 */
export function resolveNextNodeId(
  _flow: FlowDocument,
  node: FlowNode,
  answers: FlowAnswers,
): string | null {
  if (node.type === 'branch') {
    const branch = node as BranchNode;
    const value = readConditionValue(answers, branch.condition.source);
    const lane = branch.lanes.find((l) => l.value === value);
    return lane?.entryNodeId ?? branch.mergeNodeId;
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
): FlowMachineState {
  const current = getNode(flow, state.currentNodeId);
  if (!current || state.status === 'complete') return state;

  const answers: FlowAnswers = {
    ...state.answers,
    ...capture.data,
    ...(capture.path ? { path: capture.path } : {}),
  };

  const nextId = resolveNextNodeId(flow, current, answers);

  if (nextId == null) {
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

  if (!ids.has(flow.entryNodeId)) problems.push(`entryNodeId -> unknown node "${flow.entryNodeId}"`);

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
