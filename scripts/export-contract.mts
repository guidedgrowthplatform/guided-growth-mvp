// export-contract.mts, Phase 3.1-3.4: the builder emits the versioned
// builder-to-engine contract (onboarding-contract.json).
//
// This is the generative layer's seam (docs/builder-engine-contract-design.md,
// P1). The contract is the FULL runnable projection of every beat, with variant
// inheritance RESOLVED FLAT at export (via resolveBeatStructure), so the engine
// consumes concrete beats and never re-runs inheritance. It carries RUNNABLE data
// only; spec-only material (applicable decisions, identity narrative, scriptMeta)
// stays builder-side. Acceptance rides in a separate top-level block for later
// test generation, clearly out of the runnable beats.
//
// The parity.json export (scripts/export-render-parity.mjs) stays as-is; this is
// a distinct, wider artifact. Both are published from dist-flow.
//
// Runs via tsx (same pattern as scripts/dump-resolved-beats.mts) because it
// imports the TypeScript resolver directly:
//   npx tsx scripts/export-contract.mts           # write dist-flow/onboarding-contract.json
//   npx tsx scripts/export-contract.mts --check    # validate + fail on drift/invalidity (guard 1)
//
// The field-by-field schema is docs/contract-schema.md; the machine schema is
// contract.schema.json (this script validates the export against it).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import {
  BEATS_SOURCE,
  resolveBeatStructure,
  type BeatEntry,
  type ScriptLine,
} from '../src/components/flow-designer/beatsSource.ts';

const ROOT = process.cwd();
const BEATS_SOURCE_REF = 'src/components/flow-designer/beatsSource.ts#BEATS_SOURCE';
const SCHEMA_PATH = path.join(ROOT, 'contract.schema.json');
const OUTPUT_PATH = path.join(ROOT, 'dist-flow/onboarding-contract.json');
const SCHEMA_VERSION = 1 as const;

const isCheck = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// generatedAt: deterministic provenance so a rebuild of the same source is
// byte-for-byte reproducible. Prefer an explicit override, else the git commit
// time of beatsSource.ts, else null. It never participates in the staleness
// comparison (--check strips it from both sides), so a git-less environment
// cannot cause a false drift failure.
// ---------------------------------------------------------------------------
function resolveGeneratedAt(): string | null {
  const override = process.env.CONTRACT_GENERATED_AT;
  if (override && override.trim()) return override.trim();
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', 'src/components/flow-designer/beatsSource.ts'],
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Field derivation helpers.
// ---------------------------------------------------------------------------

// The opener is the first coach-bubble line with words, else the first line with
// words. One source: script[] (mirrors export-render-parity.mjs).
function firstOpener(beat: BeatEntry): string | null {
  const bubble = beat.script.find((l) => l.bindsTo?.kind === 'bubble' && l.words);
  if (bubble) return bubble.words;
  const line = beat.script.find((l) => l.words);
  return line ? line.words : null;
}

// Every distinct clip a beat plays, in script order, deduped by clip id. Each
// entry carries the short id and the resolvable public path.
function distinctClips(beat: BeatEntry): { clip: string; clipPath: string | null }[] {
  const seen = new Set<string>();
  const out: { clip: string; clipPath: string | null }[] = [];
  for (const line of beat.script) {
    if (!line.clip || seen.has(line.clip)) continue;
    seen.add(line.clip);
    out.push({ clip: line.clip, clipPath: line.clipPath ?? null });
  }
  return out;
}

function scriptLine(line: ScriptLine) {
  // speaker is a constant 'coach': beatsSource has no per-line speaker field and
  // every script line is a coach utterance. clip is intentionally omitted from
  // the line (clipPath's basename is the clip id; the id<->path pairs live in
  // assets.clips and idMap.clips) so the line stays on the locked seam shape.
  return {
    seq: line.seq,
    speaker: 'coach' as const,
    words: line.words,
    bindsTo: {
      kind: line.bindsTo.kind,
      element: line.bindsTo.element,
      screen: line.bindsTo.screen,
    },
    voice: line.voice,
    clipPath: line.clipPath ?? null,
  };
}

// allowedTools as a string ("a, b, c") -> tool id array. Fallback only; the
// primary source is the resolved bible allowedTools.tools.
function parseToolString(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// A single flow row's value by fuzzy label match (the bible flow section is
// prose rows keyed by BibleKV.label).
function flowRowValue(
  rows: readonly { label: string; value: string }[] | undefined,
  labelIncludes: string[],
): string | null {
  if (!rows) return null;
  const row = rows.find((r) => labelIncludes.some((l) => r.label.toLowerCase().includes(l)));
  return row ? row.value : null;
}

// ---------------------------------------------------------------------------
// Divergence tracking: where a beat has two authored sources for the same field
// (top-level vs bible), report the disagreement as a Phase 3.3 reconciliation
// item rather than silently picking one.
// ---------------------------------------------------------------------------
const divergences: string[] = [];

function buildBeat(beat: BeatEntry) {
  const resolved = resolveBeatStructure(beat.id);
  const bible = resolved.bible;
  const io = resolved.io;

  // context: bible.contextProse is the only authoring source. It is resolved
  // through variant inheritance before export, so every concrete contract beat
  // carries the canonical prose without a second top-level copy that can drift.
  const contextProse = bible?.contextProse?.prose ?? null;
  const context = contextProse;

  // allowedTools: prefer resolved bible tools, else parse the top-level string.
  const bibleTools = bible?.allowedTools?.tools ? [...bible.allowedTools.tools] : null;
  const topTools = parseToolString(beat.allowedTools);
  const allowedTools = bibleTools ?? topTools;
  if (bibleTools) {
    const a = [...bibleTools].sort().join(',');
    const b = [...topTools].sort().join(',');
    if (topTools.length && a !== b) {
      divergences.push(
        `${beat.id}: allowedTools disagree, top-level "${beat.allowedTools}" vs bible [${bibleTools.join(', ')}]`,
      );
    }
  }
  if (contextProse && beat.context != null) {
    divergences.push(
      `${beat.id}: context has two authored sources (top-level context vs bible contextProse); remove top-level context`,
    );
  }

  // persistence from the resolved io (writes = dataOut, reads = dataIn).
  const writes = (io?.dataOut ?? []).map((d) => ({ key: d.key, writtenBy: d.writtenBy ?? null }));
  const reads = (io?.dataIn ?? []).map((d) => ({ key: d.key }));

  // flow: prose unions today (advanceWhen + branches). The schema already carries
  // the { kind:'structured', ... } target so 3.3 fills it without a schema break.
  const advanceText =
    flowRowValue(bible?.flow?.rows, ['advance condition', 'advance']) ?? null;
  const branchesText =
    flowRowValue(bible?.flow?.rows, ['downstream branch', 'downstream', 'branch (out']) ?? null;

  // edges: a prose union carrying the current semi-structured rows verbatim.
  const edgeRows = (bible?.edges?.rows ?? []).map((e) => ({
    edge: e.edge,
    behavior: e.behavior,
    voice: e.voice ?? null,
  }));

  const clips = distinctClips(beat);

  return {
    id: beat.id,
    order: beat.order,
    screenId: beat.screenId ?? null,
    variantOf: beat.variantOf ?? null,
    path: beat.path,
    component: {
      key: beat.type,
      props: beat.props ?? null,
      config: { hideOrb: beat.hideOrb },
      elements: beat.elements ? [...beat.elements] : [],
    },
    script: beat.script.map(scriptLine),
    opener: firstOpener(beat),
    voiceEngine: beat.voiceEngine,
    voiceMode: beat.voiceMode,
    context,
    allowedTools,
    persistence: { writes, reads },
    flow: {
      advanceWhen: { kind: 'prose' as const, text: advanceText },
      branches: { kind: 'prose' as const, text: branchesText },
    },
    edges: { kind: 'prose' as const, rows: edgeRows },
    assets: { clips },
  };
}

function buildAcceptance(beat: BeatEntry) {
  const resolved = resolveBeatStructure(beat.id);
  const rows = resolved.bible?.acceptance?.rows;
  if (!rows || rows.length === 0) return null;
  return {
    beatId: beat.id,
    rows: rows.map((r) => ({ criterion: r.criterion, check: r.check })),
  };
}

function buildContract() {
  const beats = BEATS_SOURCE.map(buildBeat);

  const screens: Record<string, string> = {};
  const clips: Record<string, string> = {};
  for (const b of beats) {
    if (b.screenId) screens[b.screenId] = b.id;
    for (const c of b.assets.clips) {
      if (c.clip && c.clipPath && !(c.clip in clips)) clips[c.clip] = c.clipPath;
    }
  }

  const acceptance = BEATS_SOURCE.map(buildAcceptance).filter(
    (a): a is NonNullable<typeof a> => a !== null,
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    source: { beats: BEATS_SOURCE_REF },
    generatedAt: resolveGeneratedAt(),
    idMap: { screens, clips },
    beats,
    acceptance,
  };
}

// ---------------------------------------------------------------------------
// Minimal draft-07 structural validator (no new dependency). Supports the
// keyword subset contract.schema.json uses: type (single or array), required,
// properties, additionalProperties (boolean or schema), items, enum, const,
// oneOf, and $ref into #/$defs. Collects every violation with a JSON path.
// ---------------------------------------------------------------------------
type JsonSchema = Record<string, unknown>;

function jsType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v; // 'number' | 'string' | 'boolean' | 'object'
}

function typeMatches(value: unknown, t: string): boolean {
  const actual = jsType(value);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'object') return actual === 'object';
  return actual === t;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  let node: unknown = root;
  for (const seg of ref.slice(2).split('/')) {
    node = (node as Record<string, unknown>)[seg];
    if (node === undefined) throw new Error(`Unresolved $ref: ${ref}`);
  }
  return node as JsonSchema;
}

function validate(
  value: unknown,
  schema: JsonSchema,
  root: JsonSchema,
  pathStr: string,
  errors: string[],
): void {
  if (typeof schema.$ref === 'string') {
    validate(value, resolveRef(root, schema.$ref), root, pathStr, errors);
    return;
  }

  if (Array.isArray(schema.oneOf)) {
    const branchErrors = (schema.oneOf as JsonSchema[]).map((sub) => {
      const local: string[] = [];
      validate(value, sub, root, pathStr, local);
      return local;
    });
    const passing = branchErrors.filter((e) => e.length === 0).length;
    if (passing !== 1) {
      errors.push(`${pathStr}: matched ${passing} of ${schema.oneOf.length} oneOf branches (need exactly 1)`);
    }
    return;
  }

  if ('const' in schema) {
    if (value !== schema.const) errors.push(`${pathStr}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((e) => e === value)) {
      errors.push(`${pathStr}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
    }
    return;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t as string))) {
      errors.push(`${pathStr}: expected type ${types.join('|')}, got ${jsType(value)}`);
      return;
    }
  }

  const actual = jsType(value);

  if (actual === 'object') {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties as Record<string, JsonSchema>) ?? {};
    for (const req of (schema.required as string[]) ?? []) {
      if (!(req in obj)) errors.push(`${pathStr}: missing required property "${req}"`);
    }
    const addl = schema.additionalProperties;
    for (const [k, v] of Object.entries(obj)) {
      if (k in props) {
        validate(v, props[k], root, `${pathStr}.${k}`, errors);
      } else if (addl === false) {
        errors.push(`${pathStr}: unexpected property "${k}"`);
      } else if (addl && typeof addl === 'object') {
        validate(v, addl as JsonSchema, root, `${pathStr}.${k}`, errors);
      }
    }
  } else if (actual === 'array' && schema.items) {
    (value as unknown[]).forEach((item, i) =>
      validate(item, schema.items as JsonSchema, root, `${pathStr}[${i}]`, errors),
    );
  }
}

// ---------------------------------------------------------------------------
// Drive.
// ---------------------------------------------------------------------------
function stableStringify(contract: unknown): string {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

function stripGeneratedAt(contract: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _drop, ...rest } = contract;
  return rest;
}

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as JsonSchema;
const contract = buildContract();

const errors: string[] = [];
validate(contract, schema, schema, '$', errors);

if (errors.length) {
  console.error(`export-contract: contract FAILED schema validation (guard 1): ${errors.length} error(s)\n`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  if (errors.length > 40) console.error(`... and ${errors.length - 40} more`);
  process.exit(1);
}

if (divergences.length) {
  console.error(`export-contract: ${divergences.length} field-source divergence(s):`);
  for (const d of divergences) console.error(`  - ${d}`);
  process.exit(1);
}

if (isCheck) {
  // Staleness guard: the committed artifact must reproduce from the current
  // source (content only; generatedAt is provenance, not content).
  let committedRaw: string;
  try {
    committedRaw = readFileSync(OUTPUT_PATH, 'utf8');
  } catch {
    console.error(
      `export-contract --check: ${path.relative(ROOT, OUTPUT_PATH)} is missing. Run \`npm run build:flow\` (or \`npm run export:contract\`) and commit it.`,
    );
    process.exit(1);
  }
  const committed = JSON.parse(committedRaw) as Record<string, unknown>;
  const freshContent = stableStringify(stripGeneratedAt(contract as unknown as Record<string, unknown>));
  const committedContent = stableStringify(stripGeneratedAt(committed));
  if (freshContent !== committedContent) {
    console.error(
      `export-contract --check: ${path.relative(ROOT, OUTPUT_PATH)} is STALE, it does not reproduce from beatsSource.ts. Run \`npm run build:flow\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log(
    `export-contract --check passed: ${contract.beats.length} beats, schema valid, artifact reproduces from source.`,
  );
  process.exit(0);
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, stableStringify(contract));
console.log(
  `Wrote ${path.relative(ROOT, OUTPUT_PATH)}: ${contract.beats.length} beats, ${Object.keys(contract.idMap.clips).length} clips, ${contract.acceptance.length} acceptance blocks (schema v${SCHEMA_VERSION}, valid).`,
);
