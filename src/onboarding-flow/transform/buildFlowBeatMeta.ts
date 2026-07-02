// Build the server-consumable per-beat coach meta from the raw builder Export.
// Pure: raw doc + valid tool-name set -> keyed meta + warnings/errors. The coach
// prompt (api beatContexts) reads this so a new flow is an export, not code.
import { parseList, screenIdFromSheetStage } from './designerToFlow';

export interface FlowBeatPerElement {
  elementId: string;
  line: string;
  order: number;
}

export interface FlowBeatMetaEntry {
  context: string;
  spokenContent?: string;
  perElement: FlowBeatPerElement[];
  allowedTools: string[];
}

interface RawBeat {
  sheetStage?: string;
  context?: string;
  meta?: Record<string, unknown>;
}

interface RawDoc {
  beats?: RawBeat[];
}

export interface BuildFlowBeatMetaResult {
  meta: Record<string, FlowBeatMetaEntry>;
  warnings: string[];
  errors: string[];
}

function coercePerElement(raw: unknown): FlowBeatPerElement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      const el = e as Record<string, unknown>;
      const elementId = typeof el.elementId === 'string' ? el.elementId : '';
      const line = typeof el.line === 'string' ? el.line : '';
      const order = typeof el.order === 'number' ? el.order : 0;
      return { elementId, line, order };
    })
    .filter((e) => e.elementId && e.line)
    .sort((a, b) => a.order - b.order);
}

export function buildFlowBeatMeta(
  doc: RawDoc,
  validToolNames: ReadonlySet<string>,
): BuildFlowBeatMetaResult {
  const meta: Record<string, FlowBeatMetaEntry> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const beat of doc.beats ?? []) {
    const screenId = screenIdFromSheetStage(beat.sheetStage);
    if (!screenId) continue;

    const m = beat.meta ?? {};
    const allowedTools = parseList(typeof m.allowedTools === 'string' ? m.allowedTools : undefined);
    for (const name of allowedTools) {
      if (!validToolNames.has(name)) {
        errors.push(`${screenId}: unknown tool "${name}" in allowedTools`);
      }
    }

    const spokenContent = typeof m.spokenContent === 'string' ? m.spokenContent : undefined;
    const entry: FlowBeatMetaEntry = {
      context: typeof beat.context === 'string' ? beat.context : '',
      perElement: coercePerElement(m.perElement),
      allowedTools,
    };
    if (spokenContent) entry.spokenContent = spokenContent;

    if (meta[screenId]) warnings.push(`duplicate screenId "${screenId}"; last beat wins`);
    meta[screenId] = entry;
  }

  return { meta, warnings, errors };
}
