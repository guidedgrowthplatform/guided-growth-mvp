import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildContract, contentRevision, stringify, validateContract } from './export-render-parity.mjs';

const root = process.cwd();
const artifactPath = path.join(root, 'dist-flow/onboarding-contract.v1.json');
const sourceGitSha = '0c71ebb2';

function ownKeys(value) {
  return Object.keys(value).sort();
}

function assertExactFields(value, fields, label) {
  assert.deepEqual(ownKeys(value), [...fields].sort(), `${label} fields`);
}

function assertRequiredFields(value, fields, label) {
  for (const field of fields) assert.ok(Object.hasOwn(value, field), `${label} missing ${field}`);
}

async function readArtifact() {
  const bytes = await readFile(artifactPath, 'utf8');
  const contract = JSON.parse(bytes);
  validateContract(contract);
  return { bytes, contract };
}

async function roundTripByteIdentical() {
  const { bytes, contract } = await readArtifact();
  assert.equal(stringify(contract), bytes, 'JSON parse/stringify round-trip must preserve artifact bytes');
  const regenerated = await buildContract({ sourceGitSha: contract.sourceGitSha });
  assert.equal(stringify(regenerated), bytes, 'regenerated contract must be byte-identical');
  console.log('PASS round-trip byte-identical');
}

async function fieldCoverage() {
  const { contract } = await readArtifact();
  assertExactFields(contract, ['schemaId', 'schemaVersion', 'contractSeq', 'sourceGitSha', 'contractRevision', 'globalContext', 'toolArgumentSchemas', 'variantSelections', 'legacyCrosswalk', 'variantToBaseBeatId', 'beatIdToRollbackScreenId', 'renames', 'beats'], 'contract');
  assert.equal(contract.schemaId, 'guided-growth.onboarding-contract');
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.contractSeq, 1);
  assert.equal(contract.sourceGitSha, sourceGitSha);
  assert.equal(Object.keys(contract.renames).length, 0, 'v1 tombstones must be empty');
  assert.equal(contract.beatIdToRollbackScreenId && typeof contract.beatIdToRollbackScreenId, 'object');
  assert.ok(Object.keys(contract.toolArgumentSchemas).length > 0, 'tool argument schemas must be exported');
  assert.ok(contract.beats.length > 0, 'contract must export beats');

  const beatFields = ['id', 'name', 'order', 'path', 'type', 'parent', 'advance', 'context', 'openerSeq', 'allowedTools', 'expectedResponse', 'voice', 'hideOrb', 'props', 'elements', 'script', 'scriptMeta', 'perElement', 'beatIO', 'conversation', 'acceptanceCriteria', 'applicableDecisions'];
  const scriptFields = ['seq', 'words', 'bindsTo', 'voice', 'clip', 'clipPath', 'expectedUser'];
  const voiceFields = ['engine', 'mode', 'perLine'];
  const voiceLineFields = ['seq', 'resolution', 'liveAllowed'];
  const elementFields = ['id', 'type', 'props'];
  const dataFields = ['key', 'persistence', 'required', 'schema'];
  for (const beat of contract.beats) {
    assertExactFields(beat, beatFields, `beat ${beat.id}`);
    assertExactFields(beat.voice, voiceFields, `voice ${beat.id}`);
    assertRequiredFields(beat.beatIO, ['dataIn', 'dataOut'], `beatIO ${beat.id}`);
    assertRequiredFields(beat.scriptMeta, ['reveal', 'timing'], `scriptMeta ${beat.id}`);
    for (const line of beat.script) assertExactFields(line, scriptFields, `script ${beat.id}:${line.seq}`);
    for (const line of beat.voice.perLine) assertExactFields(line, voiceLineFields, `voice line ${beat.id}:${line.seq}`);
    for (const element of beat.elements) assertExactFields(element, elementFields, `element ${beat.id}:${element.id}`);
    for (const data of [...beat.beatIO.dataIn, ...beat.beatIO.dataOut]) assertExactFields(data, dataFields, `data contract ${beat.id}:${data.key}`);
    for (const tool of beat.allowedTools) assert.ok(Object.hasOwn(contract.toolArgumentSchemas, tool), `tool schema missing for ${tool}`);
  }
  console.log('PASS field coverage');
}

async function hashReproducibility() {
  const first = await buildContract({ sourceGitSha });
  const second = await buildContract({ sourceGitSha });
  const firstBytes = stringify(first);
  const secondBytes = stringify(second);
  assert.equal(firstBytes, secondBytes, 'two exports must have identical bytes');
  assert.equal(contentRevision(first), contentRevision(second), 'two exports must have identical content hashes');
  assert.match(first.contractRevision, new RegExp(`^sha256:${contentRevision(first)};git:${sourceGitSha}$`));
  console.log('PASS hash reproducibility (2 runs)');
}

await roundTripByteIdentical();
await fieldCoverage();
await hashReproducibility();
console.log('PASS render contract gates');
