import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRelativePath = 'src/components/flow-designer/beatsSource.ts';
const sourcePath = path.join(root, sourceRelativePath);
const outputPath = path.join(root, 'dist-flow/onboarding-contract.v1.json');
const headersPath = path.join(root, 'dist-flow/_headers');
const DEFAULT_SOURCE_GIT_SHA = '0c71ebb2';
const CONTRACT_SEQ = 1;
const declarationNames = new Set(['GLOBAL_CONTEXT', 'TOOL_ARGUMENT_SCHEMAS', 'VARIANT_SELECTIONS', 'LEGACY_ONBOARD_CROSSWALK', 'BEATS_SOURCE']);
const nullObject = () => Object.create(null);
const headers = `/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/onboarding-contract.v1.json
  Cache-Control: no-store
  Content-Type: application/json; charset=utf-8
/play/*
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

function define(object, key, value) {
  Object.defineProperty(object, key, { value, enumerable: true, configurable: true, writable: true });
}

function ownObject(entries = []) {
  const object = nullObject();
  for (const [key, value] of entries) define(object, key, value);
  return object;
}

function diagnostic(node, message) {
  const position = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  throw new Error(`${sourceRelativePath}:${position.line + 1}:${position.character + 1}: ${message}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  diagnostic(name, `unsupported property name: ${ts.SyntaxKind[name.kind]}`);
}

function unwrap(node) {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}

function parseDeclarations(sourceFile) {
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && declarationNames.has(node.name.text)) {
      if (!node.initializer) diagnostic(node, `missing initializer for ${node.name.text}`);
      if (declarations.has(node.name.text)) diagnostic(node, `duplicate declaration ${node.name.text}`);
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  for (const name of ['GLOBAL_CONTEXT', 'BEATS_SOURCE']) if (!declarations.has(name)) throw new Error(`${sourceRelativePath}: missing ${name} declaration`);
  return declarations;
}

function evaluateDeclarations(declarations) {
  const values = new Map();
  const visiting = new Set();
  function evaluate(node) {
    node = unwrap(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) diagnostic(element, 'spreads and omitted array entries are not supported');
      return evaluate(element);
    });
    if (ts.isObjectLiteralExpression(node)) {
      const result = nullObject();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) diagnostic(property, `unsupported object member: ${ts.SyntaxKind[property.kind]}`);
        const key = propertyName(property.name);
        if (Object.hasOwn(result, key)) diagnostic(property.name, `duplicate object key ${JSON.stringify(key)}`);
        define(result, key, evaluate(property.initializer));
      }
      return result;
    }
    if (ts.isIdentifier(node) && declarations.has(node.text)) return evaluateDeclaration(node.text, node);
    diagnostic(node, `unsupported source expression: ${ts.SyntaxKind[node.kind]}`);
  }
  function evaluateDeclaration(name, reference) {
    if (values.has(name)) return values.get(name);
    if (visiting.has(name)) diagnostic(reference, `reference cycle through ${name}`);
    visiting.add(name);
    const value = evaluate(declarations.get(name));
    visiting.delete(name);
    values.set(name, value);
    return value;
  }
  for (const name of declarations.keys()) evaluateDeclaration(name, declarations.get(name));
  return values;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return ownObject(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function stringify(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function expectedResponse(value) {
  return value == null ? null : ownObject([['kind', String(value)], ['schema', null]]);
}

function jsonObject(value) {
  return value == null ? nullObject() : stableValue(value);
}

function relativeClipPath(clipPath) {
  return clipPath == null ? null : String(clipPath).replace(/^\/+/, '');
}

function scriptLine(line) {
  return ownObject([
    ['seq', line.seq], ['words', line.words],
    ['bindsTo', ownObject([['kind', line.bindsTo?.kind ?? null], ['element', line.bindsTo?.element ?? null], ['screen', line.bindsTo?.screen ?? null]])],
    ['voice', line.voice ?? null], ['clip', line.clip ?? null], ['clipPath', relativeClipPath(line.clipPath)], ['expectedUser', expectedResponse(line.expectedUser)],
  ]);
}

function voiceLine(line) {
  if (line.clip !== null) return ownObject([['seq', line.seq], ['resolution', 'recorded'], ['liveAllowed', false]]);
  if (line.voice !== null) return ownObject([['seq', line.seq], ['resolution', 'live'], ['liveAllowed', true]]);
  return ownObject([['seq', line.seq], ['resolution', 'silent'], ['liveAllowed', false]]);
}

function rows(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

function sourceElementIds(beat, script) {
  const ids = new Set((beat.elements ?? []).map(String));
  for (const line of script) if (line.bindsTo.element !== null) ids.add(line.bindsTo.element);
  for (const entry of beat.perElement ?? []) ids.add(String(entry.elementId));
  return [...ids];
}

function deriveAdvance(beat) {
  const gate = rows(beat.bible?.flow).find((row) => row.label === 'gate')?.value ?? '';
  const manual = /none|next tap|proceeds|continues/i.test(gate);
  return ownObject([['mode', manual ? 'manual' : 'gated'], ['gateOwner', manual ? null : 'flow']]);
}

function deriveScriptMeta(beat, script) {
  const elements = new Set(sourceElementIds(beat, script));
  return ownObject([
    ['reveal', script.filter((line) => line.bindsTo.element !== null && elements.has(line.bindsTo.element)).map((line) => ownObject([['seq', line.seq], ['elementId', line.bindsTo.element], ['action', 'show']]))],
    ['timing', []],
  ]);
}

function persistence(value) {
  const text = String(value ?? '').toLowerCase();
  if (/account|auth/.test(text)) return 'account';
  if (/beat/.test(text)) return 'beat';
  return 'session';
}

function deriveDataContracts(entries) {
  return (entries ?? []).map((entry) => ownObject([
    ['key', String(entry.key)], ['persistence', persistence(entry.persistsTo)], ['required', true], ['schema', nullObject()],
  ]));
}

function deriveAcceptanceCriteria(beat) {
  return rows(beat.bible?.acceptance).map((row, index) => ownObject([
    ['id', `acceptance-${index + 1}`], ['description', String(row.check ?? row.criterion ?? row.value ?? '')],
  ]));
}

function deriveDecisions(beat) {
  return rows(beat.bible?.applicableDecisions).filter((row) => row.binds !== false).map((row) => row.decision ?? row.value).filter((value) => typeof value === 'string');
}

function deriveConversation(beat) {
  const source = beat.bible?.conversation;
  if (!source?.maxTurns) return null;
  return ownObject([['maxTurns', source.maxTurns], ['onMaxTurns', 'stop'], ['branches', []]]);
}

function deriveToolArgumentSchemas(sourceBeats) {
  const descriptions = new Map();
  for (const beat of sourceBeats) {
    for (const spec of beat.bible?.allowedTools?.specs ?? []) {
      if (typeof spec.tool !== 'string' || typeof spec.args !== 'string') continue;
      const existing = descriptions.get(spec.tool) ?? [];
      if (!existing.includes(spec.args)) existing.push(spec.args);
      descriptions.set(spec.tool, existing);
    }
  }
  return ownObject([...descriptions.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([tool, args]) => [tool, ownObject([
    ['type', 'object'], ['additionalProperties', true], ['description', args.join(' | ')],
  ])]));
}

function exportBeat(beat) {
  const script = beat.script.map(scriptLine).sort((left, right) => left.seq - right.seq);
  const opener = script.filter((line) => line.bindsTo.kind === 'bubble').at(0) ?? null;
  const ids = sourceElementIds(beat, script);
  return ownObject([
    ['id', beat.id], ['name', beat.name], ['order', beat.order], ['path', beat.path], ['type', beat.type], ['parent', beat.parent ?? null],
    ['advance', deriveAdvance(beat)], ['context', beat.context ?? ''], ['openerSeq', opener?.seq ?? null],
    ['allowedTools', beat.allowedTools == null ? [] : beat.allowedTools.split(',').map((tool) => tool.trim()).filter(Boolean)], ['expectedResponse', expectedResponse(beat.expectedResponse)],
    ['voice', ownObject([['engine', beat.voiceEngine], ['mode', beat.voiceMode ?? null], ['perLine', script.map(voiceLine)]])], ['hideOrb', Boolean(beat.hideOrb)],
    ['props', jsonObject(beat.props)], ['elements', ids.map((id) => ownObject([['id', id], ['type', 'component'], ['props', nullObject()]]))], ['script', script], ['scriptMeta', deriveScriptMeta(beat, script)],
    ['perElement', (beat.perElement ?? []).map((entry) => ownObject([['elementId', entry.elementId], ['line', entry.line], ['order', entry.order], ['showsAsBubble', Boolean(entry.showsAsBubble)]]))],
    ['beatIO', ownObject([['dataIn', deriveDataContracts(beat.io?.dataIn)], ['dataOut', deriveDataContracts(beat.io?.dataOut)]])], ['conversation', deriveConversation(beat)],
    ['acceptanceCriteria', deriveAcceptanceCriteria(beat)], ['applicableDecisions', deriveDecisions(beat)],
  ]);
}

function legacyCrosswalk(beats) {
  const entries = [];
  for (const beat of beats) {
    for (const alias of beat.bible?.identity?.aliases ?? []) {
      if (alias.surface !== 'screenId' || typeof alias.value !== 'string') continue;
      const legacyScreenId = alias.value.split(/[ :]/, 1)[0];
      if (/^ONBOARD-[A-Z0-9-]+$/.test(legacyScreenId)) entries.push(ownObject([['legacyScreenId', legacyScreenId], ['beatId', beat.id]]));
    }
  }
  const seen = new Set();
  return ownObject([['status', 'transitional-delete-after-migration'], ['entries', entries.filter((entry) => !seen.has(entry.legacyScreenId) && seen.add(entry.legacyScreenId))]]);
}

function variantSelections(beats) {
  const bases = new Map(beats.filter((beat) => beat.parent === null).map((beat) => [beat.id, beat]));
  return [...bases.values()].flatMap((base) => {
    const variants = beats.filter((beat) => beat.parent === base.id);
    if (variants.length === 0) return [];
    const decisionKey = base.applicableDecisions[0] ?? `variant:${base.id}`;
    return [ownObject([
      ['id', `${base.id}:selection`],
      ['baseBeatId', base.id],
      ['decisionKey', decisionKey],
      ['defaultBeatId', variants[0].id],
      ['cases', variants.slice(1).map((variant) => ownObject([
        ['equals', variant.id.split(':').at(-1)],
        ['beatId', variant.id],
      ]))],
    ])];
  });
}

function validateString(value, label) {
  if (typeof value !== 'string' || /[\0-\x1f\x7f]/.test(value) || /^\s|\s$/.test(value) || /[\\/]/.test(value)) throw new Error(`Invalid identifier ${label}`);
}

export function validateContract(contract) {
  const required = ['schemaId', 'schemaVersion', 'contractSeq', 'sourceGitSha', 'contractRevision', 'globalContext', 'toolArgumentSchemas', 'variantSelections', 'legacyCrosswalk', 'variantToBaseBeatId', 'beatIdToRollbackScreenId', 'renames', 'beats'];
  const known = new Set(required);
  for (const field of Object.keys(contract)) if (!known.has(field)) throw new Error(`Unknown contract field ${field}`);
  for (const field of required) if (!Object.hasOwn(contract, field)) throw new Error(`Missing contract field ${field}`);
  if (contract.schemaId !== 'guided-growth.onboarding-contract' || contract.schemaVersion !== 1 || contract.contractSeq !== CONTRACT_SEQ) throw new Error('Invalid contract envelope');
  if (!/^[0-9a-f]{8,64}$/.test(contract.sourceGitSha)) throw new Error('Invalid sourceGitSha');
  if (!/^sha256:[0-9a-f]{64};git:[0-9a-f]{8,64}$/.test(contract.contractRevision) && contract.contractRevision !== '') throw new Error('Invalid contractRevision');
  if (typeof contract.globalContext !== 'string' || !Array.isArray(contract.beats)) throw new Error('Invalid contract payload');
  for (const [tool, schema] of Object.entries(contract.toolArgumentSchemas)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(tool) || (schema !== true && schema !== false && (!schema || typeof schema !== 'object' || Array.isArray(schema)))) throw new Error(`Invalid tool argument schema ${tool}`);
  }
  const ids = new Set();
  const typeValues = new Set(['splash', 'get-started', 'splash-intro', 'auth-signup', 'mic-permission', 'profile-beat', 'state-check', 'morning-checkin-setup', 'reflection-card', 'path-selection', 'category-grid', 'goals-list', 'custom-entry', 'habit-picker', 'habit-schedule', 'advanced-capture', 'advanced-frequency', 'into-app', 'weekly-projection']);
  for (const [index, beat] of contract.beats.entries()) {
    if (beat.order !== index) throw new Error(`Beat ${beat.id} has non-dense order ${beat.order}`);
    if (!/^[a-z][a-z0-9-]*-beat-[0-9]+-[a-z0-9-]+(?::[a-z0-9-]+)?$/.test(beat.id) || ids.has(beat.id)) throw new Error(`Invalid or duplicate beat id ${beat.id}`);
    if (!typeValues.has(beat.type)) throw new Error(`Unknown beat type ${beat.type}`);
    ids.add(beat.id);
    for (const tool of beat.allowedTools) if (!Object.hasOwn(contract.toolArgumentSchemas, tool)) throw new Error(`Missing tool argument schema ${tool}`);
    const elements = new Set(beat.elements.map((element) => element.id));
    if (elements.size !== beat.elements.length) throw new Error(`Duplicate element in ${beat.id}`);
    const seqs = new Set();
    for (const line of beat.script) {
      if (!Number.isSafeInteger(line.seq) || seqs.has(line.seq)) throw new Error(`Invalid script sequence in ${beat.id}`);
      seqs.add(line.seq);
      if (line.bindsTo.element !== null && !elements.has(line.bindsTo.element)) throw new Error(`Unknown element in ${beat.id}`);
      if ((line.clip === null) !== (line.clipPath === null)) throw new Error(`Clip mismatch in ${beat.id} line ${line.seq}`);
      if (line.clipPath !== null && (/^(\/|.*\\)|(^|\/)\.{1,2}(\/|$)|\/\//.test(line.clipPath))) throw new Error(`Invalid clip path in ${beat.id}`);
    }
    if (beat.voice.perLine.length !== beat.script.length) throw new Error(`Voice-line mismatch in ${beat.id}`);
    for (const voice of beat.voice.perLine) {
      if (!seqs.has(voice.seq)) throw new Error(`Unknown voice sequence in ${beat.id}`);
      if (voice.resolution === 'recorded' && (!beat.script.find((line) => line.seq === voice.seq).clip || voice.liveAllowed)) throw new Error(`Invalid recorded voice line in ${beat.id}`);
      if (voice.resolution === 'live' && (!beat.script.find((line) => line.seq === voice.seq).voice || !voice.liveAllowed)) throw new Error(`Invalid live voice line in ${beat.id}`);
      if (voice.resolution === 'silent' && (beat.script.find((line) => line.seq === voice.seq).voice !== null || beat.script.find((line) => line.seq === voice.seq).clip !== null || voice.liveAllowed)) throw new Error(`Invalid silent voice line in ${beat.id}`);
    }
    for (const list of [beat.beatIO.dataIn, beat.beatIO.dataOut]) {
      const keys = new Set();
      for (const entry of list) if (!entry.key || keys.has(entry.key)) throw new Error(`Invalid IO key in ${beat.id}`); else keys.add(entry.key);
    }
    if (beat.conversation !== null && (!Number.isSafeInteger(beat.conversation.maxTurns) || beat.conversation.maxTurns < 1)) throw new Error(`Invalid conversation in ${beat.id}`);
  }
  for (const beat of contract.beats) if (beat.parent !== null && beat.parent === beat.id) throw new Error(`Self parent ${beat.parent}`);
  for (const entry of contract.legacyCrosswalk.entries) if (!ids.has(entry.beatId)) throw new Error(`Unknown legacy target ${entry.beatId}`);
  for (const [variant, base] of Object.entries(contract.variantToBaseBeatId)) if (!ids.has(variant) || typeof base !== 'string') throw new Error('Invalid variant collapse map');
  for (const [beatId, screenId] of Object.entries(contract.beatIdToRollbackScreenId)) if (!ids.has(beatId) || (screenId !== null && typeof screenId !== 'string')) throw new Error('Invalid rollback screen map');
  for (const [retiredId, tombstone] of Object.entries(contract.renames)) {
    validateString(retiredId, 'rename source');
    if (!tombstone || typeof tombstone.currentBeatId !== 'string' || !Number.isSafeInteger(tombstone.contractSeq)) throw new Error('Invalid rename tombstone');
  }
}

export function contentRevision(contract) {
  const content = ownObject(Object.entries(contract).filter(([key]) => key !== 'contractRevision' && key !== 'sourceGitSha'));
  return createHash('sha256').update(stringify(content), 'utf8').digest('hex');
}

export async function buildContract({ sourceGitSha = DEFAULT_SOURCE_GIT_SHA } = {}) {
  const sourceText = await readFile(sourcePath, { encoding: 'utf8' });
  const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = evaluateDeclarations(parseDeclarations(sourceFile));
  const sourceBeats = values.get('BEATS_SOURCE');
  const beats = sourceBeats.map(exportBeat).sort((left, right) => left.order - right.order);
  const legacy = legacyCrosswalk(sourceBeats);
  const rollback = ownObject(beats.map((beat) => [beat.id, legacy.entries.find((entry) => entry.beatId === beat.id)?.legacyScreenId ?? null]));
  const contract = ownObject([
    ['schemaId', 'guided-growth.onboarding-contract'], ['schemaVersion', 1], ['contractSeq', CONTRACT_SEQ], ['sourceGitSha', sourceGitSha], ['contractRevision', ''],
    ['globalContext', values.get('GLOBAL_CONTEXT')], ['toolArgumentSchemas', values.get('TOOL_ARGUMENT_SCHEMAS') ?? deriveToolArgumentSchemas(sourceBeats)], ['variantSelections', values.get('VARIANT_SELECTIONS') ?? variantSelections(beats)], ['legacyCrosswalk', values.get('LEGACY_ONBOARD_CROSSWALK') ?? legacy],
    ['variantToBaseBeatId', ownObject(beats.filter((beat) => beat.parent !== null).map((beat) => [beat.id, beat.parent]))], ['beatIdToRollbackScreenId', rollback], ['renames', nullObject()], ['beats', beats],
  ]);
  validateContract(contract);
  contract.contractRevision = `sha256:${contentRevision(contract)};git:${sourceGitSha}`;
  return contract;
}

function parseArgs(argv) {
  const result = { check: false, sourceGitSha: DEFAULT_SOURCE_GIT_SHA };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--check') result.check = true;
    else if (argv[index] === '--source-git-sha' && argv[index + 1]) result.sourceGitSha = argv[++index];
    else throw new Error(`Unknown argument ${argv[index]}`);
  }
  return result;
}

async function safeWrite(destination, bytes) {
  await mkdir(path.dirname(destination), { recursive: true });
  try { const status = await lstat(destination); if (!status.isFile()) throw new Error(`${destination} is not a regular file`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(bytes, 'utf8'); } finally { await handle.close(); }
  try {
    const written = await readFile(temporary, 'utf8');
    JSON.parse(written);
    if (written !== bytes) throw new Error('Temporary contract bytes changed during write');
    await rename(temporary, destination);
  } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let sourceGitSha = args.sourceGitSha;
  if (args.check) sourceGitSha = JSON.parse(await readFile(outputPath, 'utf8')).sourceGitSha;
  const contract = await buildContract({ sourceGitSha });
  const bytes = stringify(contract);
  if (args.check) {
    if (await readFile(outputPath, 'utf8') !== bytes) throw new Error(`${path.relative(root, outputPath)} is stale`);
    console.log(`Verified ${path.relative(root, outputPath)} with ${contract.beats.length} beats`);
    return;
  }
  await safeWrite(outputPath, bytes);
  await writeFile(headersPath, headers, 'utf8');
  console.log(`Wrote ${path.relative(root, outputPath)} with ${contract.beats.length} beats`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
