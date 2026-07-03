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
import { z } from 'zod';
import designerSourceJson from '../flows/designer-source.json';
import type { DesignerBeat, DesignerBeatMeta } from './designerSource';

// Strict schemas: every key the builder Export may carry is enumerated, so a
// typo'd or new field fails flow:sync loud instead of being silently dropped.
const ExportMp3AssetSchema = z.strictObject({
  id: z.string().optional(),
  label: z.string(),
  file: z.string(),
  transcript: z.string(),
  opener: z.string().optional(),
  elementId: z.string().optional(),
  timing: z.enum(['opener', 'element', 'full-beat']).optional(),
});

const ExportPerElementSchema = z.strictObject({
  elementId: z.string(),
  line: z.string(),
  order: z.number().optional(),
  showsAsBubble: z.boolean().optional(),
});

// persistStep / maxSelections: authored as strings, tolerate numbers (parseNumber downstream).
const numericish = z.union([z.string(), z.number()]);

const ExportEngineMetaSchema = z.strictObject({
  nodeId: z.string().optional(),
  backId: z.string().optional(),
  persistStep: numericish.optional(),
  pathField: z.boolean().optional(),
  captureFields: z.string().optional(),
  toolName: z.string().optional(),
  toolAdvancesStep: z.boolean().optional(),
  toolPersistsFields: z.string().optional(),
  voiceExpectsInput: z.boolean().optional(),
  voiceDirectLlmAllowed: z.boolean().optional(),
  maxSelections: numericish.optional(),
  optionSource: z.string().optional(),
});

const ExportOrbSchema = z.strictObject({
  voiceOn: z.boolean().optional(),
  micOn: z.boolean().optional(),
  micAsking: z.boolean().optional(),
  bloomed: z.boolean().optional(),
});

const ExportBeatMetaSchema = z.strictObject({
  // Consumed by mapMeta below.
  voiceEngine: z.string().optional(),
  voiceMode: z.string().optional(),
  voiceId: z.string().optional(),
  spokenContent: z.string().optional(),
  path: z.string().optional(),
  llmActive: z.boolean().optional(),
  allowedTools: z.string().optional(),
  feedbackConfig: z.string().optional(),
  animation: z.string().optional(),
  figmaNode: z.string().optional(),
  status: z.string().optional(),
  voiceNotes: z.string().optional(),
  mp3Assets: z.array(ExportMp3AssetSchema).optional(),
  orb: ExportOrbSchema.optional(),
  engine: ExportEngineMetaSchema.optional(),
  // Authoring context the transform does not consume (kept faithful, keys still strict).
  openerMode: z.string().optional(),
  openerShowsAsBubble: z.boolean().optional(),
  expectedResponse: z.string().optional(),
  variable: z.boolean().optional(),
  perElement: z.array(ExportPerElementSchema).optional(),
});

const ExportBeatSchema = z.strictObject({
  beat: z.string(),
  name: z.string(),
  componentType: z.string().min(1),
  variant: z.string().nullable().optional(),
  showOnPath: z.string().nullable().optional(),
  background: z.string().optional(),
  sheetStage: z.string().optional(),
  transition: z.string().nullable().optional(),
  context: z.string().optional(),
  // Component-specific data (reflection questions etc. are structured), so
  // values are free-form JSON; the KEY set stays whatever the component reads.
  props: z.record(z.string(), z.unknown()).optional(),
  meta: ExportBeatMetaSchema,
});

const ExportDocumentSchema = z.strictObject({
  flowId: z.string().min(1),
  name: z.string().optional(),
  version: z.number().optional(),
  publishedAt: z.string().optional(),
  source: z.string().optional(),
  beats: z.array(ExportBeatSchema).min(1),
});

type ExportBeat = z.infer<typeof ExportBeatSchema>;
export type ExportDocument = z.infer<typeof ExportDocumentSchema>;

/** Validate a raw builder Export. Throws with every offending path named. */
export function parseExportDocument(value: unknown): ExportDocument {
  const result = ExportDocumentSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`[designer-source] builder Export failed validation:\n${details}`);
  }
  return result.data;
}

/** Drop null/undefined prop values; everything else passes through untouched. */
function cleanProps(
  props: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    out[key] = value;
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
        ...(engineNum(engineRaw.persistStep)
          ? { persistStep: engineNum(engineRaw.persistStep) }
          : {}),
        ...(asBool(engineRaw.pathField) != null ? { pathField: asBool(engineRaw.pathField) } : {}),
        ...(asString(engineRaw.captureFields)
          ? { captureFields: asString(engineRaw.captureFields) }
          : {}),
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
        ...(engineNum(engineRaw.maxSelections)
          ? { maxSelections: engineNum(engineRaw.maxSelections) }
          : {}),
        ...(asString(engineRaw.optionSource)
          ? { optionSource: asString(engineRaw.optionSource) }
          : {}),
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
    ...(Array.isArray(meta.mp3Assets)
      ? { mp3Assets: meta.mp3Assets as DesignerBeatMeta['mp3Assets'] }
      : {}),
    ...(meta.orb ? { orb: meta.orb as DesignerBeatMeta['orb'] } : {}),
    ...(engine ? { engine } : {}),
  };
}

/** Map one Export beat into a DesignerBeat (componentType -> type). */
function mapBeat(beat: ExportBeat): DesignerBeat {
  const props = cleanProps(beat.props);
  const meta = mapMeta(beat.meta);
  return {
    type: beat.componentType,
    ...(beat.beat != null ? { beat: beat.beat } : {}),
    ...(beat.name ? { name: beat.name } : {}),
    ...(beat.sheetStage ? { sheetStage: beat.sheetStage } : {}),
    ...(beat.context ? { context: beat.context } : {}),
    ...(props ? { props } : {}),
    ...(beat.background ? { background: beat.background } : {}),
    ...(beat.showOnPath !== undefined ? { showOnPath: beat.showOnPath } : {}),
    ...(meta ? { meta } : {}),
  };
}

/** Map a whole parsed Export into the DesignerBeat[] the transform consumes. */
export function designerBeatsFromExport(doc: ExportDocument): DesignerBeat[] {
  return doc.beats.map(mapBeat);
}

/**
 * The onboarding flow, sourced from the builder Export JSON. This drives flow:sync.
 * Build-time module (flow:sync + tests): the parse throw fails the sync, never
 * a user session. No hand-typed mirror fallback exists anymore (L1-4).
 */
export const DESIGNER_ONBOARDING_FLOW_FROM_JSON: DesignerBeat[] = designerBeatsFromExport(
  parseExportDocument(designerSourceJson),
);
