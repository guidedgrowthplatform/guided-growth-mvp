/** Strict reader for the Phase A onboarding contract. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse, printParseErrorCode, visit } from 'jsonc-parser';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type LocalJsonSchema = boolean | { [key: string]: JsonValue };

export interface ContractBeat {
  id: string;
  name: string;
  order: number;
  path: 'beginner' | 'advanced' | 'both';
  type: string;
  parent: string | null;
  advance: { mode: 'manual' | 'self' | 'gated'; gateOwner: string | null };
  context: string;
  openerSeq: number | null;
  allowedTools: string[];
  expectedResponse: { kind: string; schema: LocalJsonSchema | null } | null;
  voice: {
    engine: 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';
    mode: 'Verbatim' | 'Improvise' | null;
    perLine: Array<{ seq: number; resolution: 'recorded' | 'live' | 'silent'; liveAllowed: boolean }>;
  };
  hideOrb: boolean;
  props: { [key: string]: JsonValue };
  elements: Array<{ id: string; type: string; props: { [key: string]: JsonValue } }>;
  script: Array<{
    seq: number;
    words: string;
    bindsTo: { kind: string | null; element: string | null; screen: string | null };
    voice: string | null;
    clip: string | null;
    clipPath: string | null;
    expectedUser: { kind: string; schema: LocalJsonSchema | null } | null;
  }>;
  scriptMeta: {
    reveal: Array<{ seq: number; elementId: string; action: string }>;
    timing: Array<{ seq: number; offsetMs: number }>;
  };
  beatIO: {
    dataIn: Array<{ key: string; persistence: 'beat' | 'session' | 'account'; required: boolean; schema: LocalJsonSchema }>;
    dataOut: Array<{ key: string; persistence: 'beat' | 'session' | 'account'; required: boolean; schema: LocalJsonSchema }>;
  };
  conversation: {
    maxTurns: number;
    onMaxTurns: 'advance' | 'stop' | 'branch';
    branches: Array<{ id: string; when: LocalJsonSchema | null; targetBeatId: string }>;
  } | null;
  acceptanceCriteria: Array<{ id: string; description: string }>;
  applicableDecisions: string[];
}

export interface OnboardingContractV1 {
  schemaId: 'guided-growth.onboarding-contract';
  schemaVersion: 1;
  sourceGitSha: string;
  contractRevision: string;
  globalContext: string;
  toolArgumentSchemas: Record<string, LocalJsonSchema>;
  variantSelections: Array<{
    id: string;
    baseBeatId: string;
    decisionKey: string;
    defaultBeatId: string;
    cases: Array<{ equals: string; beatId: string }>;
  }>;
  legacyCrosswalk: { status: 'transitional-delete-after-migration'; entries: Array<{ legacyScreenId: string; beatId: string }> };
  /** Phase A tombstones. Supports the committed exporter shape once it lands. */
  renames: Record<string, { beatId: string; contractSeq: number }>;
  beats: ContractBeat[];
}

export interface ReadContractResult {
  contract: OnboardingContractV1;
  contractSha256: string;
}

const parseOptions = { disallowComments: true, allowTrailingComma: false } as const;
const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const fail = (path: string, message: string): never => { throw new Error(`[onboarding-contract] ${path}: ${message}`); };
const object = (value: unknown, path: string): Record<string, unknown> => {
  if (value == null || Array.isArray(value) || typeof value !== 'object') fail(path, 'must be an object');
  return value as Record<string, unknown>;
};
const array = (value: unknown, path: string): unknown[] => Array.isArray(value) ? value : fail(path, 'must be an array');
const string = (value: unknown, path: string): string => typeof value === 'string' ? value : fail(path, 'must be a string');
const boolean = (value: unknown, path: string): boolean => typeof value === 'boolean' ? value : fail(path, 'must be a boolean');
const integer = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : fail(path, 'must be a safe integer');
const nullableString = (value: unknown, path: string): string | null => value === null || typeof value === 'string' ? value : fail(path, 'must be a string or null');
const exact = (value: Record<string, unknown>, keys: readonly string[], path: string): void => {
  for (const key of keys) if (!hasOwn(value, key)) fail(path, `missing required property "${key}"`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(path, `unknown property "${key}"`);
};
const enumValue = <T extends string>(value: unknown, values: readonly T[], path: string): T =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? value as T : fail(path, `must be one of ${values.join(', ')}`);
const schema = (value: unknown, path: string): LocalJsonSchema =>
  typeof value === 'boolean' ? value : object(value, path) as LocalJsonSchema;
const jsonObject = (value: unknown, path: string): { [key: string]: JsonValue } => object(value, path) as { [key: string]: JsonValue };

function response(value: unknown, path: string): { kind: string; schema: LocalJsonSchema | null } | null {
  if (value === null) return null;
  const v = object(value, path); exact(v, ['kind', 'schema'], path);
  return { kind: string(v.kind, `${path}.kind`), schema: v.schema === null ? null : schema(v.schema, `${path}.schema`) };
}

function dataContracts(value: unknown, path: string): ContractBeat['beatIO']['dataIn'] {
  return array(value, path).map((item, i) => {
    const v = object(item, `${path}[${i}]`); exact(v, ['key', 'persistence', 'required', 'schema'], `${path}[${i}]`);
    return { key: string(v.key, `${path}[${i}].key`), persistence: enumValue(v.persistence, ['beat', 'session', 'account'], `${path}[${i}].persistence`), required: boolean(v.required, `${path}[${i}].required`), schema: schema(v.schema, `${path}[${i}].schema`) };
  });
}

function beat(value: unknown, path: string): ContractBeat {
  const v = object(value, path);
  exact(v, ['id', 'name', 'order', 'path', 'type', 'parent', 'advance', 'context', 'openerSeq', 'allowedTools', 'expectedResponse', 'voice', 'hideOrb', 'props', 'elements', 'script', 'scriptMeta', 'beatIO', 'conversation', 'acceptanceCriteria', 'applicableDecisions'], path);
  const advance = object(v.advance, `${path}.advance`); exact(advance, ['mode', 'gateOwner'], `${path}.advance`);
  const voice = object(v.voice, `${path}.voice`); exact(voice, ['engine', 'mode', 'perLine'], `${path}.voice`);
  const scriptMeta = object(v.scriptMeta, `${path}.scriptMeta`); exact(scriptMeta, ['reveal', 'timing'], `${path}.scriptMeta`);
  const beatIO = object(v.beatIO, `${path}.beatIO`); exact(beatIO, ['dataIn', 'dataOut'], `${path}.beatIO`);
  const conversationValue = v.conversation === null ? null : object(v.conversation, `${path}.conversation`);
  if (conversationValue) exact(conversationValue, ['maxTurns', 'onMaxTurns', 'branches'], `${path}.conversation`);
  return {
    id: string(v.id, `${path}.id`), name: string(v.name, `${path}.name`), order: integer(v.order, `${path}.order`), path: enumValue(v.path, ['beginner', 'advanced', 'both'], `${path}.path`), type: string(v.type, `${path}.type`), parent: nullableString(v.parent, `${path}.parent`),
    advance: { mode: enumValue(advance.mode, ['manual', 'self', 'gated'], `${path}.advance.mode`), gateOwner: nullableString(advance.gateOwner, `${path}.advance.gateOwner`) }, context: string(v.context, `${path}.context`), openerSeq: v.openerSeq === null ? null : integer(v.openerSeq, `${path}.openerSeq`), allowedTools: array(v.allowedTools, `${path}.allowedTools`).map((item, i) => string(item, `${path}.allowedTools[${i}]`)), expectedResponse: response(v.expectedResponse, `${path}.expectedResponse`),
    voice: { engine: enumValue(voice.engine, ['MP3', 'Cartesia', 'Vapi', 'Silent'] as const, `${path}.voice.engine`), mode: voice.mode === null ? null : enumValue(voice.mode, ['Verbatim', 'Improvise'] as const, `${path}.voice.mode`), perLine: array(voice.perLine, `${path}.voice.perLine`).map((item, i) => { const line = object(item, `${path}.voice.perLine[${i}]`); exact(line, ['seq', 'resolution', 'liveAllowed'], `${path}.voice.perLine[${i}]`); return { seq: integer(line.seq, `${path}.voice.perLine[${i}].seq`), resolution: enumValue(line.resolution, ['recorded', 'live', 'silent'] as const, `${path}.voice.perLine[${i}].resolution`), liveAllowed: boolean(line.liveAllowed, `${path}.voice.perLine[${i}].liveAllowed`) }; }) },
    hideOrb: boolean(v.hideOrb, `${path}.hideOrb`), props: jsonObject(v.props, `${path}.props`), elements: array(v.elements, `${path}.elements`).map((item, i) => { const e = object(item, `${path}.elements[${i}]`); exact(e, ['id', 'type', 'props'], `${path}.elements[${i}]`); return { id: string(e.id, `${path}.elements[${i}].id`), type: string(e.type, `${path}.elements[${i}].type`), props: jsonObject(e.props, `${path}.elements[${i}].props`) }; }),
    script: array(v.script, `${path}.script`).map((item, i) => { const s = object(item, `${path}.script[${i}]`); exact(s, ['seq', 'words', 'bindsTo', 'voice', 'clip', 'clipPath', 'expectedUser'], `${path}.script[${i}]`); const binds = object(s.bindsTo, `${path}.script[${i}].bindsTo`); exact(binds, ['kind', 'element', 'screen'], `${path}.script[${i}].bindsTo`); return { seq: integer(s.seq, `${path}.script[${i}].seq`), words: string(s.words, `${path}.script[${i}].words`), bindsTo: { kind: nullableString(binds.kind, `${path}.script[${i}].bindsTo.kind`), element: nullableString(binds.element, `${path}.script[${i}].bindsTo.element`), screen: nullableString(binds.screen, `${path}.script[${i}].bindsTo.screen`) }, voice: nullableString(s.voice, `${path}.script[${i}].voice`), clip: nullableString(s.clip, `${path}.script[${i}].clip`), clipPath: nullableString(s.clipPath, `${path}.script[${i}].clipPath`), expectedUser: response(s.expectedUser, `${path}.script[${i}].expectedUser`) }; }),
    scriptMeta: { reveal: array(scriptMeta.reveal, `${path}.scriptMeta.reveal`).map((item, i) => { const r = object(item, `${path}.scriptMeta.reveal[${i}]`); exact(r, ['seq', 'elementId', 'action'], `${path}.scriptMeta.reveal[${i}]`); return { seq: integer(r.seq, `${path}.scriptMeta.reveal[${i}].seq`), elementId: string(r.elementId, `${path}.scriptMeta.reveal[${i}].elementId`), action: string(r.action, `${path}.scriptMeta.reveal[${i}].action`) }; }), timing: array(scriptMeta.timing, `${path}.scriptMeta.timing`).map((item, i) => { const t = object(item, `${path}.scriptMeta.timing[${i}]`); exact(t, ['seq', 'offsetMs'], `${path}.scriptMeta.timing[${i}]`); return { seq: integer(t.seq, `${path}.scriptMeta.timing[${i}].seq`), offsetMs: integer(t.offsetMs, `${path}.scriptMeta.timing[${i}].offsetMs`) }; }) },
    beatIO: { dataIn: dataContracts(beatIO.dataIn, `${path}.beatIO.dataIn`), dataOut: dataContracts(beatIO.dataOut, `${path}.beatIO.dataOut`) },
    conversation: conversationValue ? { maxTurns: integer(conversationValue.maxTurns, `${path}.conversation.maxTurns`), onMaxTurns: enumValue(conversationValue.onMaxTurns, ['advance', 'stop', 'branch'], `${path}.conversation.onMaxTurns`), branches: array(conversationValue.branches, `${path}.conversation.branches`).map((item, i) => { const b = object(item, `${path}.conversation.branches[${i}]`); exact(b, ['id', 'when', 'targetBeatId'], `${path}.conversation.branches[${i}]`); return { id: string(b.id, `${path}.conversation.branches[${i}].id`), when: b.when === null ? null : schema(b.when, `${path}.conversation.branches[${i}].when`), targetBeatId: string(b.targetBeatId, `${path}.conversation.branches[${i}].targetBeatId`) }; }) } : null,
    acceptanceCriteria: array(v.acceptanceCriteria, `${path}.acceptanceCriteria`).map((item, i) => { const a = object(item, `${path}.acceptanceCriteria[${i}]`); exact(a, ['id', 'description'], `${path}.acceptanceCriteria[${i}]`); return { id: string(a.id, `${path}.acceptanceCriteria[${i}].id`), description: string(a.description, `${path}.acceptanceCriteria[${i}].description`) }; }), applicableDecisions: array(v.applicableDecisions, `${path}.applicableDecisions`).map((item, i) => string(item, `${path}.applicableDecisions[${i}]`)),
  };
}

function validateContract(value: unknown): OnboardingContractV1 {
  const v = object(value, '$');
  exact(v, ['schemaId', 'schemaVersion', 'sourceGitSha', 'contractRevision', 'globalContext', 'toolArgumentSchemas', 'variantSelections', 'legacyCrosswalk', 'renames', 'beats'], '$');
  const crosswalk = object(v.legacyCrosswalk, '$.legacyCrosswalk'); exact(crosswalk, ['status', 'entries'], '$.legacyCrosswalk');
  const toolSchemas = object(v.toolArgumentSchemas, '$.toolArgumentSchemas');
  const renames = object(v.renames, '$.renames');
  const validatedRenames: Record<string, { beatId: string; contractSeq: number }> = {};
  for (const [oldId, rename] of Object.entries(renames)) { const r = object(rename, `$.renames.${oldId}`); exact(r, ['beatId', 'contractSeq'], `$.renames.${oldId}`); validatedRenames[oldId] = { beatId: string(r.beatId, `$.renames.${oldId}.beatId`), contractSeq: integer(r.contractSeq, `$.renames.${oldId}.contractSeq`) }; }
  return {
    schemaId: enumValue(v.schemaId, ['guided-growth.onboarding-contract'], '$.schemaId'), schemaVersion: integer(v.schemaVersion, '$.schemaVersion') === 1 ? 1 : fail('$.schemaVersion', 'must be 1'), sourceGitSha: string(v.sourceGitSha, '$.sourceGitSha'), contractRevision: string(v.contractRevision, '$.contractRevision'), globalContext: string(v.globalContext, '$.globalContext'),
    toolArgumentSchemas: Object.fromEntries(Object.entries(toolSchemas).map(([key, value]) => [key, schema(value, `$.toolArgumentSchemas.${key}`)])),
    variantSelections: array(v.variantSelections, '$.variantSelections').map((item, i) => { const s = object(item, `$.variantSelections[${i}]`); exact(s, ['id', 'baseBeatId', 'decisionKey', 'defaultBeatId', 'cases'], `$.variantSelections[${i}]`); return { id: string(s.id, `$.variantSelections[${i}].id`), baseBeatId: string(s.baseBeatId, `$.variantSelections[${i}].baseBeatId`), decisionKey: string(s.decisionKey, `$.variantSelections[${i}].decisionKey`), defaultBeatId: string(s.defaultBeatId, `$.variantSelections[${i}].defaultBeatId`), cases: array(s.cases, `$.variantSelections[${i}].cases`).map((item, j) => { const c = object(item, `$.variantSelections[${i}].cases[${j}]`); exact(c, ['equals', 'beatId'], `$.variantSelections[${i}].cases[${j}]`); return { equals: string(c.equals, `$.variantSelections[${i}].cases[${j}].equals`), beatId: string(c.beatId, `$.variantSelections[${i}].cases[${j}].beatId`) }; }) }; }),
    legacyCrosswalk: { status: enumValue(crosswalk.status, ['transitional-delete-after-migration'], '$.legacyCrosswalk.status'), entries: array(crosswalk.entries, '$.legacyCrosswalk.entries').map((item, i) => { const e = object(item, `$.legacyCrosswalk.entries[${i}]`); exact(e, ['legacyScreenId', 'beatId'], `$.legacyCrosswalk.entries[${i}]`); return { legacyScreenId: string(e.legacyScreenId, `$.legacyCrosswalk.entries[${i}].legacyScreenId`), beatId: string(e.beatId, `$.legacyCrosswalk.entries[${i}].beatId`) }; }) },
    renames: validatedRenames, beats: array(v.beats, '$.beats').map((item, i) => beat(item, `$.beats[${i}]`)),
  };
}

export function parseOnboardingContract(bytes: string): ReadContractResult {
  const errors: string[] = [];
  const objectKeys = new Map<string, Set<string>>();
  visit(bytes, { onObjectProperty(property, offset, _length, _line, _column, path) { const objectPath = JSON.stringify(path()); const keys = objectKeys.get(objectPath) ?? new Set<string>(); if (keys.has(property)) errors.push(`duplicate key "${property}" at byte ${offset}`); keys.add(property); objectKeys.set(objectPath, keys); }, onError(error, offset) { errors.push(`${printParseErrorCode(error)} at byte ${offset}`); } }, parseOptions);
  if (errors.length > 0) throw new Error(`[onboarding-contract] invalid JSON: ${errors.join('; ')}`);
  const parsedErrors: Array<{ error: Parameters<typeof printParseErrorCode>[0]; offset: number; length: number }> = [];
  const raw = parse(bytes, parsedErrors, parseOptions);
  if (parsedErrors.length > 0) throw new Error(`[onboarding-contract] invalid JSON: ${parsedErrors.map((e) => `${printParseErrorCode(e.error)} at byte ${e.offset}`).join('; ')}`);
  const contract = validateContract(raw);
  validateContractReferences(contract);
  return { contract, contractSha256: createHash('sha256').update(bytes, 'utf8').digest('hex') };
}

export function readOnboardingContract(path: string): ReadContractResult {
  return parseOnboardingContract(readFileSync(path, 'utf8'));
}

/** Validate references the JSON schema cannot express without global context. */
function validateContractReferences(contract: OnboardingContractV1): void {
  const beatIds = new Set<string>();
  const orders = new Set<number>();
  for (const beat of contract.beats) {
    if (!beatIds.add(beat.id)) fail('$.beats', `duplicate beat id "${beat.id}"`);
    if (!orders.add(beat.order)) fail('$.beats', `duplicate beat order ${beat.order}`);
  }
  for (const beat of contract.beats) {
    if (beat.parent !== null && !beatIds.has(beat.parent)) fail(`$.beats[${beat.id}].parent`, `unknown beat id "${beat.parent}"`);
    for (const branch of beat.conversation?.branches ?? []) {
      if (!beatIds.has(branch.targetBeatId)) fail(`$.beats[${beat.id}].conversation.branches[${branch.id}]`, `unknown target beat id "${branch.targetBeatId}"`);
    }
  }
  for (const entry of contract.legacyCrosswalk.entries) {
    if (!beatIds.has(entry.beatId)) fail('$.legacyCrosswalk.entries', `unknown beat id "${entry.beatId}"`);
  }
  for (const selection of contract.variantSelections) {
    for (const id of [selection.baseBeatId, selection.defaultBeatId, ...selection.cases.map((entry) => entry.beatId)]) {
      if (!beatIds.has(id)) fail(`$.variantSelections[${selection.id}]`, `unknown beat id "${id}"`);
    }
  }
}
