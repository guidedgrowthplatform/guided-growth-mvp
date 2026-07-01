/**
 * Adapter: read the flow-builder Export JSON (the real source of truth) and shape
 * it into the DesignerBeat[] the transform already consumes.
 *
 * The builder Export (flows/designer-source.json) and the app's DesignerBeat shape
 * differ in two field names and one field the app never carried:
 *   - Export `componentType`  -> DesignerBeat `type`   (via componentType, 1:1).
 *   - Export `showOnPath`      -> carried onto DesignerBeat.showOnPath (lane hint).
 *   - `meta` / `props` / `background` / `sheetStage` / `beat` pass through as-is.
 *
 * FORK LANES. The Export has NO split blocks. It expresses the fork by tagging each
 * lane beat with `showOnPath`: 'new' (beginner lane), 'exp' (advanced lane), or
 * null (shared spine). The transform (designerToFlow.ts) does NOT read showOnPath:
 * it builds the fork STRUCTURALLY, keyed by engine component type (FORK_LANES +
 * ADVANCED_LANE_COMPONENTS). So the beginner lane is category-grid -> goals-list ->
 * habit-picker -> habit-schedule and the advanced lane is advanced-capture ->
 * advanced-frequency, regardless of order in the array. Carrying showOnPath keeps
 * the data faithful (and lets a future transform read it) without changing today's
 * structural lane build. This adapter therefore preserves showOnPath but does not
 * reorder or filter on it; the transform's existing passes do the lane assembly.
 *
 * The Export's beat 0 (qa-control) has no TYPE_TO_COMPONENT entry, so the transform
 * skips it (null-mapped), exactly as the hand-typed mirror omitted it.
 *
 * NO EM DASHES. Pure module, no IO beyond the static JSON import.
 */
import designerSourceJson from '../flows/designer-source.json';
import type { DesignerBeat, DesignerBeatMeta } from './designerSource';

/** One raw beat as authored in the builder Export. */
interface ExportBeat {
  beat?: string;
  name?: string;
  componentType?: string;
  variant?: string | null;
  showOnPath?: string | null;
  background?: string;
  sheetStage?: string;
  transition?: string | null;
  context?: string;
  props?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

interface ExportDocument {
  flowId?: string;
  source?: string;
  beats?: ExportBeat[];
}

/** Coerce the Export props (unknown values) into the string map the transform reads. */
function coerceProps(props: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

/**
 * Map an Export beat's meta onto the app's DesignerBeatMeta. Only the fields the
 * transform's resolveMeta reads are typed here; the rest of the Export meta
 * (openerMode, perElement, expectedResponse, variable, ...) is authoring context
 * the transform does not consume, so it is not carried into the engine flow.
 */
function mapMeta(meta: Record<string, unknown> | undefined): DesignerBeatMeta | undefined {
  if (!meta || Object.keys(meta).length === 0) return undefined;
  const engineRaw = meta.engine as Record<string, unknown> | undefined;
  const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  // Export authors numeric-ish engine fields (persistStep, maxSelections) as
  // strings already; keep them as strings so the transform's parseNumber handles them.
  const engineNum = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

  const engine = engineRaw
    ? {
        ...(asString(engineRaw.nodeId) ? { nodeId: asString(engineRaw.nodeId) } : {}),
        ...(asString(engineRaw.backId) ? { backId: asString(engineRaw.backId) } : {}),
        ...(engineNum(engineRaw.persistStep) ? { persistStep: engineNum(engineRaw.persistStep) } : {}),
        ...(asBool(engineRaw.pathField) != null ? { pathField: asBool(engineRaw.pathField) } : {}),
        ...(asString(engineRaw.captureFields) ? { captureFields: asString(engineRaw.captureFields) } : {}),
        ...(asString(engineRaw.toolName) ? { toolName: asString(engineRaw.toolName) } : {}),
        ...(asBool(engineRaw.toolAdvancesStep) != null
          ? { toolAdvancesStep: asBool(engineRaw.toolAdvancesStep) }
          : {}),
        ...(asString(engineRaw.toolPersistsFields)
          ? { toolPersistsFields: asString(engineRaw.toolPersistsFields) }
          : {}),
        ...(asBool(engineRaw.voiceExpectsInput) != null
          ? { voiceExpectsInput: asBool(engineRaw.voiceExpectsInput) }
          : {}),
        ...(asBool(engineRaw.voiceDirectLlmAllowed) != null
          ? { voiceDirectLlmAllowed: asBool(engineRaw.voiceDirectLlmAllowed) }
          : {}),
        ...(engineNum(engineRaw.maxSelections) ? { maxSelections: engineNum(engineRaw.maxSelections) } : {}),
        ...(asString(engineRaw.optionSource) ? { optionSource: asString(engineRaw.optionSource) } : {}),
      }
    : undefined;

  return {
    ...(asString(meta.voiceEngine) ? { voiceEngine: asString(meta.voiceEngine) } : {}),
    ...(asString(meta.voiceMode) ? { voiceMode: asString(meta.voiceMode) } : {}),
    ...(asString(meta.voiceId) ? { voiceId: asString(meta.voiceId) } : {}),
    ...(asString(meta.spokenContent) ? { spokenContent: asString(meta.spokenContent) } : {}),
    ...(asString(meta.path) ? { path: asString(meta.path) } : {}),
    ...(asBool(meta.llmActive) != null ? { llmActive: asBool(meta.llmActive) } : {}),
    ...(asString(meta.allowedTools) ? { allowedTools: asString(meta.allowedTools) } : {}),
    ...(asString(meta.feedbackConfig) ? { feedbackConfig: asString(meta.feedbackConfig) } : {}),
    ...(asString(meta.animation) ? { animation: asString(meta.animation) } : {}),
    ...(asString(meta.figmaNode) ? { figmaNode: asString(meta.figmaNode) } : {}),
    ...(asString(meta.status) ? { status: asString(meta.status) } : {}),
    ...(asString(meta.voiceNotes) ? { voiceNotes: asString(meta.voiceNotes) } : {}),
    ...(Array.isArray(meta.mp3Assets) ? { mp3Assets: meta.mp3Assets as DesignerBeatMeta['mp3Assets'] } : {}),
    ...(meta.orb ? { orb: meta.orb as DesignerBeatMeta['orb'] } : {}),
    ...(engine ? { engine } : {}),
  };
}

/** Map one Export beat into a DesignerBeat (componentType -> type). */
function mapBeat(beat: ExportBeat): DesignerBeat {
  return {
    type: beat.componentType ?? '',
    ...(beat.beat != null ? { beat: beat.beat } : {}),
    ...(beat.sheetStage ? { sheetStage: beat.sheetStage } : {}),
    ...(coerceProps(beat.props) ? { props: coerceProps(beat.props) } : {}),
    ...(beat.background ? { background: beat.background } : {}),
    ...(beat.showOnPath !== undefined ? { showOnPath: beat.showOnPath } : {}),
    ...(mapMeta(beat.meta) ? { meta: mapMeta(beat.meta) } : {}),
  };
}

/**
 * The onboarding flow, sourced from the builder Export JSON. This drives flow:sync.
 * The hand-typed DESIGNER_ONBOARDING_FLOW mirror stays in designerSource.ts as a
 * fallback only.
 */
export const DESIGNER_ONBOARDING_FLOW_FROM_JSON: DesignerBeat[] = (
  (designerSourceJson as ExportDocument).beats ?? []
).map(mapBeat);
