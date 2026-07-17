import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.dirname(new URL(import.meta.url).pathname);
const documentPath = path.join(root, 'GLOBAL-RULES-FULL.md');
const auditPath = path.join(root, 'ENFORCEMENT-AUDIT.md');
const oldBiblePath =
  '/home/ggvoice/gg-ground/render-rich/src/components/flow-designer/flowBible.ts';
const oldBeatsPath =
  '/home/ggvoice/gg-ground/render-rich/src/components/flow-designer/beatsSource.ts';

const documentText = fs.readFileSync(documentPath, 'utf8');
const auditText = fs.readFileSync(auditPath, 'utf8');
const oldBibleText = fs.readFileSync(oldBiblePath, 'utf8');
const oldBeatsText = fs.readFileSync(oldBeatsPath, 'utf8');
const oldBibleAst = ts.createSourceFile(
  oldBiblePath,
  oldBibleText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const oldBeatsAst = ts.createSourceFile(
  oldBeatsPath,
  oldBeatsText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const oldBibleModuleSource = ts.transpileModule(oldBibleText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const oldBible = await import(
  `data:text/javascript;base64,${Buffer.from(oldBibleModuleSource).toString('base64')}`
);

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

function exportedInitializer(name) {
  for (const statement of oldBibleAst.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration.initializer;
    }
  }
  throw new Error(`Missing old-source initializer: ${name}`);
}

function exportedString(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const initializer = declaration.initializer;
      assert(
        initializer && ts.isNoSubstitutionTemplateLiteral(initializer),
        `${name} is no longer a static template literal`,
      );
      return initializer.text;
    }
  }
  throw new Error(`Missing old-source string: ${name}`);
}

function parseInventoryObject(entryText, number) {
  const block = entryText.match(/```json\n([\s\S]*?)\n```/);
  assert(block, `Inventory ${number} lacks a JSON evidence block`);
  try {
    return Function(`"use strict"; return (${block[1]});`)();
  } catch (error) {
    throw new Error(`Inventory ${number} evidence is not parseable: ${error.message}`);
  }
}

function arrayCount(name) {
  const initializer = exportedInitializer(name);
  assert(ts.isArrayLiteralExpression(initializer), `${name} is no longer an array literal`);
  return initializer.elements.length;
}

function objectArrayCount(name, propertyName) {
  const initializer = exportedInitializer(name);
  assert(ts.isObjectLiteralExpression(initializer), `${name} is no longer an object literal`);
  const property = initializer.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText(oldBibleAst).replaceAll("'", '') === propertyName,
  );
  assert(
    property &&
      ts.isPropertyAssignment(property) &&
      ts.isArrayLiteralExpression(property.initializer),
    `${name}.${propertyName} is no longer an array literal`,
  );
  return property.initializer.elements.length;
}

const inventory = section('old-rich-inventory', 'traceability');
const traceability = section('traceability', 'gaps');
const proposed = section('proposed-global-set', 'supporting-layer');
const supporting = section('supporting-layer', 'acceptance');
const acceptance = documentText.slice(documentText.indexOf('<a id="acceptance"></a>'));

const inventoryEntries = [...inventory.matchAll(/^### (\d+)\. (.+)$/gm)].map((match) => ({
  number: Number(match[1]),
  title: match[2],
  index: match.index,
}));
assert(
  inventoryEntries.length === 132,
  `Expected 132 inventory entries, found ${inventoryEntries.length}`,
);
const inventoryVerdicts = new Map();
const inventoryObjects = [];
inventoryEntries.forEach((entry, index) => {
  assert(entry.number === index + 1, `Inventory is not sequential at ${entry.number}`);
  const nextIndex = inventoryEntries[index + 1]?.index ?? inventory.length;
  const entryText = inventory.slice(entry.index, nextIndex);
  const verdicts = [...entryText.matchAll(/\*\*Verdict: (KEEP|KEEP-AMENDED|RETIRE)\.\*\*/g)];
  assert(
    verdicts.length === 1,
    `Inventory ${entry.number} must have exactly one normalized verdict`,
  );
  inventoryVerdicts.set(entry.number, verdicts[0][1]);
  inventoryObjects.push(parseInventoryObject(entryText, entry.number));
});

const expectedInventoryObjects = [
  oldBible.IMPROVISATION,
  { precedence: oldBible.GLOBAL_RULES.precedence },
  ...oldBible.GLOBAL_RULES.rules,
  oldBible.TOOL_FAILURE,
  oldBible.CONVERSATION_MODEL,
  oldBible.VOICE_OWNERSHIP,
  ...oldBible.GLOBAL_VOICE_OWNERSHIP,
  ...oldBible.GLOBAL_RESPONSES,
  oldBible.DATA_PASSING,
  oldBible.COACH_IDENTITY,
  ...oldBible.CONSUMER_CONTRACT,
  ...oldBible.RENDER_COMPLETENESS,
  ...oldBible.ENFORCER_REGISTRY,
  ...Object.entries(oldBible.RETIRED_ENFORCER_IDS).map(([id, replacedBy]) => ({
    id,
    replacedBy,
  })),
  oldBible.CANONICAL_ENUMS.gender,
  oldBible.CANONICAL_ENUMS.categories,
  ...oldBible.RESOLVED_DATA_CONTRACTS,
  ...oldBible.APP_MIGRATION_SPECS,
  { text: exportedString(oldBeatsAst, 'GLOBAL_CONTEXT') },
];
assert(
  expectedInventoryObjects.length === 132,
  `Source extraction produced ${expectedInventoryObjects.length} entries`,
);
inventoryObjects.forEach((actual, index) => {
  const expected = expectedInventoryObjects[index];
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Inventory ${index + 1} evidence differs from its old-source value`,
  );
});

const coveredEntries = new Set();
const destinationKinds = new Map();
for (const match of traceability.matchAll(
  /^\|\s*(\d+)(?:–(\d+))?\s*\|\s*(KEEP|KEEP-AMENDED|RETIRE)\s*\|\s*([^|]+?)\s*\|$/gm,
)) {
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  const verdict = match[3];
  const destination = match[4].trim();
  assert(start <= end, `Invalid traceability range ${start}–${end}`);
  assert(
    /^(Runtime|Adjacent|Removed):/.test(destination),
    `Traceability ${start}–${end} lacks a normalized destination`,
  );
  for (let number = start; number <= end; number += 1) {
    assert(!coveredEntries.has(number), `Traceability duplicates inventory ${number}`);
    assert(
      inventoryVerdicts.get(number) === verdict,
      `Traceability verdict mismatch for inventory ${number}`,
    );
    coveredEntries.add(number);
    destinationKinds.set(number, destination.split(':', 1)[0]);
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

const provenanceRows = [...proposed.matchAll(/^\|\s*(GR-\d{2})\s*\|\s*([^|]+?)\s*\|$/gm)];
assert(
  provenanceRows.length === rules.length,
  `Expected ${rules.length} proposed-rule provenance rows, found ${provenanceRows.length}`,
);
const provenanceIds = provenanceRows.map((row) => row[1]);
assert(
  new Set(provenanceIds).size === rules.length,
  'Proposed-rule provenance contains duplicate IDs',
);
assert(
  JSON.stringify(provenanceIds) === JSON.stringify(rules.map((rule) => rule[1])),
  'Proposed-rule provenance must cover every rule once in rule order',
);
for (const row of provenanceRows) {
  assert(
    /Inventory|Gap from decision/.test(row[2]),
    `${row[1]} provenance lacks old inventory or a named decision gap`,
  );
}
assert(
  proposed.includes('If two MUST rules still conflict'),
  'Missing fail-closed conflict semantics',
);
assert(
  proposed.includes('A new slot or a cross-slot trigger requires a new copy decision'),
  'Missing slot overflow semantics',
);
assert(proposed.includes('not a generic capacity limit'), 'Missing non-capacity slot semantics');

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
assert(
  JSON.stringify(slotRules) === JSON.stringify(expectedSlots),
  `Unexpected slot set: ${slotRules.join(', ')}`,
);

const knownEnforcers = new Set(
  [...oldBibleText.matchAll(/^\s+id: '([^']+)',$/gm)].map((match) => match[1]),
);
for (const match of proposed.matchAll(
  /`([^`]+)` — \*\*(REAL|PARTIAL|NOT-IMPLEMENTED)(?:[^*]*)\*\*/g,
)) {
  assert(knownEnforcers.has(match[1]), `Unknown enforcedBy ID: ${match[1]}`);
}
assert(!proposed.includes('ASPIRATIONAL'), 'Use NOT-IMPLEMENTED, not ASPIRATIONAL');
assert(
  auditText.includes('1 is REAL today, 6 are PARTIAL, and 8 are aspirational names'),
  'Enforcement audit headline changed; re-review statuses',
);

const contractRows = [...supporting.matchAll(/^\|\s*`([A-Z_]+)`\s*\|/gm)];
assert(
  contractRows.length === 5,
  `Expected 5 defined supporting contracts, found ${contractRows.length}`,
);

const requiredOldExports = [
  'IMPROVISATION',
  'GLOBAL_RULES',
  'TOOL_FAILURE',
  'CONVERSATION_MODEL',
  'VOICE_OWNERSHIP',
  'GLOBAL_VOICE_OWNERSHIP',
  'GLOBAL_RESPONSES',
  'DATA_PASSING',
  'COACH_IDENTITY',
  'CONSUMER_CONTRACT',
  'RENDER_COMPLETENESS',
  'ENFORCER_REGISTRY',
  'RETIRED_ENFORCER_IDS',
  'CANONICAL_ENUMS',
  'RESOLVED_DATA_CONTRACTS',
  'APP_MIGRATION_SPECS',
];
for (const exportName of requiredOldExports) {
  assert(
    new RegExp(`export const ${exportName}\\b`).test(oldBibleText),
    `Old source no longer exports ${exportName}; re-extract inventory`,
  );
}

const oldSourceCounts = {
  globalRules: objectArrayCount('GLOBAL_RULES', 'rules'),
  globalVoiceOwners: arrayCount('GLOBAL_VOICE_OWNERSHIP'),
  globalResponses: arrayCount('GLOBAL_RESPONSES'),
  consumerContracts: arrayCount('CONSUMER_CONTRACT'),
  completenessContracts: arrayCount('RENDER_COMPLETENESS'),
  enforcers: arrayCount('ENFORCER_REGISTRY'),
  resolvedDataContracts: arrayCount('RESOLVED_DATA_CONTRACTS'),
  migrationSpecs: arrayCount('APP_MIGRATION_SPECS'),
};
assert(
  oldSourceCounts.globalRules === 15,
  `Old source global-rule count changed: ${oldSourceCounts.globalRules}`,
);
assert(
  oldSourceCounts.globalVoiceOwners === 8,
  `Old source voice-owner count changed: ${oldSourceCounts.globalVoiceOwners}`,
);
assert(
  oldSourceCounts.globalResponses === 8,
  `Old source response count changed: ${oldSourceCounts.globalResponses}`,
);
assert(
  oldSourceCounts.consumerContracts === 6,
  `Old source consumer-contract count changed: ${oldSourceCounts.consumerContracts}`,
);
assert(
  oldSourceCounts.completenessContracts === 21,
  `Old source completeness count changed: ${oldSourceCounts.completenessContracts}`,
);
assert(
  oldSourceCounts.enforcers === 33,
  `Old source enforcer count changed: ${oldSourceCounts.enforcers}`,
);
assert(
  oldSourceCounts.resolvedDataContracts === 10,
  `Old source data-contract count changed: ${oldSourceCounts.resolvedDataContracts}`,
);
assert(
  oldSourceCounts.migrationSpecs === 18,
  `Old source migration-spec count changed: ${oldSourceCounts.migrationSpecs}`,
);

assert(documentText.includes('not configuration'), 'Missing explicit non-configuration boundary');
assert(documentText.includes('it must not parse this Markdown'), 'Missing parser prohibition');
assert(documentText.includes('Change control and rollback'), 'Missing change-control boundary');
assert(acceptance.includes('What it does not prove'), 'Evidence commands must state their limits');
assert(acceptance.includes('Activation blockers and ownership'), 'Missing blocker ownership table');
const blockerRows = [
  ...acceptance.matchAll(
    /^\|\s*[^|]+?\s*\|\s*(Critical|High|Medium|Low)\s*\|\s*[^|]+?— unassigned\s*\|\s*[^|]+?\s*\|\s*`?[^|`]+`?[^|]*\s*\|\s*(Block|Block voice release)\s*\|$/gm,
  ),
];
assert(
  blockerRows.length === 8,
  `Expected 8 explicit activation blockers, found ${blockerRows.length}`,
);
assert(
  acceptance.includes('### Required behavioral test targets'),
  'Missing named behavioral test targets',
);
assert(
  acceptance.includes('### Validation execution record — 2026-07-17 GMT'),
  'Missing dated validation execution record',
);
assert(
  acceptance.includes('No behavioral target in the preceding table was run'),
  'Missing explicit behavioral-test non-execution disclosure',
);

const fenceCount = (documentText.match(/^```/gm) ?? []).length;
assert(fenceCount % 2 === 0, `Unbalanced Markdown fences: ${fenceCount}`);
assert(!/\bGREEN\b/.test(documentText), 'Document must not claim GREEN readiness');
assert(!/QA['’]d policy proposal/i.test(documentText), 'Document must not claim QA completion');
assert(
  !documentText.includes('verbatim inventory'),
  'Inventory must not be described as file-verbatim',
);

console.log(
  JSON.stringify(
    {
      scope: 'document/source validation only; not runtime validation',
      inventoryEntries: inventoryEntries.length,
      sourceValueMatches: inventoryObjects.length,
      tracedEntries: coveredEntries.size,
      traceabilityDestinations: Object.fromEntries(
        [...destinationKinds.values()].reduce(
          (counts, kind) => counts.set(kind, (counts.get(kind) ?? 0) + 1),
          new Map(),
        ),
      ),
      oldSourceCounts,
      proposedRules: rules.length,
      proposedRuleProvenance: provenanceRows.length,
      reactiveSlots: slotRules.length,
      supportingContracts: contractRows.length,
      markdownFences: fenceCount,
    },
    null,
    2,
  ),
);
