import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const documentPath = path.join(root, 'GLOBAL-RULES-FULL.md');
const auditPath = path.join(root, 'ENFORCEMENT-AUDIT.md');
const oldBiblePath =
  '/home/ggvoice/gg-ground/render-rich/src/components/flow-designer/flowBible.ts';

const documentText = fs.readFileSync(documentPath, 'utf8');
const auditText = fs.readFileSync(auditPath, 'utf8');
const oldBibleText = fs.readFileSync(oldBiblePath, 'utf8');

function section(startAnchor, endAnchor) {
  const start = documentText.indexOf(`<a id="${startAnchor}"></a>`);
  const end = documentText.indexOf(`<a id="${endAnchor}"></a>`);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Missing or misordered anchors: ${startAnchor}, ${endAnchor}`);
  }
  return documentText.slice(start, end);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const inventory = section('old-rich-inventory', 'traceability');
const traceability = section('traceability', 'gaps');
const proposed = section('proposed-global-set', 'supporting-layer');
const supporting = section('supporting-layer', 'acceptance');

const inventoryEntries = [
  ...inventory.matchAll(/^### (\d+)\. (.+)$/gm),
].map((match) => ({ number: Number(match[1]), title: match[2], index: match.index }));
assert(inventoryEntries.length === 132, `Expected 132 inventory entries, found ${inventoryEntries.length}`);
inventoryEntries.forEach((entry, index) => {
  assert(entry.number === index + 1, `Inventory is not sequential at ${entry.number}`);
  const nextIndex = inventoryEntries[index + 1]?.index ?? inventory.length;
  const entryText = inventory.slice(entry.index, nextIndex);
  const verdicts = [...entryText.matchAll(/\*\*Verdict: (KEEP|KEEP-AMENDED|RETIRE)\.\*\*/g)];
  assert(verdicts.length === 1, `Inventory ${entry.number} must have exactly one normalized verdict`);
});

const coveredEntries = new Set();
for (const match of traceability.matchAll(/^\| (\d+)(?:–(\d+))? \| (KEEP|KEEP-AMENDED|RETIRE) \| ([^|]+) \|$/gm)) {
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  assert(start <= end, `Invalid traceability range ${start}–${end}`);
  for (let number = start; number <= end; number += 1) {
    assert(!coveredEntries.has(number), `Traceability duplicates inventory ${number}`);
    coveredEntries.add(number);
  }
}
assert(coveredEntries.size === 132, `Traceability covers ${coveredEntries.size} of 132 entries`);
for (let number = 1; number <= 132; number += 1) {
  assert(coveredEntries.has(number), `Traceability omits inventory ${number}`);
}

const rules = [...proposed.matchAll(/^### (GR-(\d{2})) — (MUST|SHOULD) — (.+)$/gm)];
assert(rules.length === 26, `Expected 26 proposed rules, found ${rules.length}`);
rules.forEach((rule, index) => {
  assert(Number(rule[2]) === index + 1, `Proposed rule sequence breaks at ${rule[1]}`);
});
assert(new Set(rules.map((rule) => rule[1])).size === 26, 'Proposed rule IDs are not unique');

const expectedSlots = [
  'off-topic',
  'tool failure',
  're-ask',
  'empty',
  'narrow',
  'create own',
  'nudge',
  'gender',
];
const slotRules = rules
  .filter((rule) => rule[4].startsWith('Slot '))
  .map((rule) => rule[4].replace(/^Slot \d+: /, ''));
assert(JSON.stringify(slotRules) === JSON.stringify(expectedSlots), `Unexpected slot set: ${slotRules.join(', ')}`);

const knownEnforcers = new Set([
  ...oldBibleText.matchAll(/^\s+id: '([^']+)',$/gm),
].map((match) => match[1]));
for (const match of proposed.matchAll(/`([^`]+)` — \*\*(REAL|PARTIAL|NOT-IMPLEMENTED)(?:[^*]*)\*\*/g)) {
  assert(knownEnforcers.has(match[1]), `Unknown enforcedBy ID: ${match[1]}`);
}
assert(!proposed.includes('ASPIRATIONAL'), 'Use NOT-IMPLEMENTED, not ASPIRATIONAL');
assert(auditText.includes('1 is REAL today, 6 are PARTIAL, and 8 are aspirational names'), 'Enforcement audit headline changed; re-review statuses');

const contractRows = [...supporting.matchAll(/^\| `([A-Z_]+)` \|/gm)];
assert(contractRows.length === 5, `Expected 5 defined supporting contracts, found ${contractRows.length}`);

const fenceCount = (documentText.match(/^```/gm) ?? []).length;
assert(fenceCount % 2 === 0, `Unbalanced Markdown fences: ${fenceCount}`);
assert(!documentText.includes('GREEN as a minimal migration recommendation'), 'Document must not claim GREEN readiness');
assert(!documentText.includes('verbatim inventory'), 'Inventory must not be described as file-verbatim');

console.log(JSON.stringify({
  inventoryEntries: inventoryEntries.length,
  tracedEntries: coveredEntries.size,
  proposedRules: rules.length,
  reactiveSlots: slotRules.length,
  supportingContracts: contractRows.length,
  markdownFences: fenceCount,
}, null, 2));
