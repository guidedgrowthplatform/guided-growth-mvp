import { readFile } from 'node:fs/promises';
import { fail, readBeats, ruleEntries } from './render-contract-utils.mjs';

const CHECK_ID = 'decisions-coverage-check';
const ledgerPath = '/home/ggvoice/gg-spec/docs/onboarding-copy-decisions-2026-07-10.md';
const ledger = await readFile(ledgerPath, 'utf8');
const beats = await readBeats();
const problems = [];
const lockedDecisionNumbers = new Set(['1', '2', '3', '4', '5', '6', '7']);

function declaredDecisionNumbers(value) {
  const numbers = new Set();
  const heading = /^\s*([1-7])(?:\s*\/\s*([1-7])|\s*-\s*([1-7]))?\b/.exec(String(value));
  if (heading) {
    const match = heading;
    numbers.add(match[1]);
    if (match[2]) numbers.add(match[2]);
    if (match[3]) {
      for (let current = Number(match[1]) + 1; current <= Number(match[3]); current += 1) numbers.add(String(current));
    }
  }
  return numbers;
}

for (const beat of beats) {
  const rows = beat.bible?.applicableDecisions?.rows;
  if (!Array.isArray(rows)) continue;
  const inheritedFrom = beat.id.includes(':') ? beats.find((candidate) => candidate.id === beat.id.split(':')[0]) : null;
  const rules = [...ruleEntries(beat), ...ruleEntries(inheritedFrom ?? {})];
  for (const row of rows) {
    const decisionNumbers = declaredDecisionNumbers(row.decision);
    if (!decisionNumbers.size) continue;
    const isLocked = [...decisionNumbers].some((number) => lockedDecisionNumbers.has(number));
    if (row.binds === true) {
      for (const number of decisionNumbers) {
        if (!lockedDecisionNumbers.has(number)) {
          problems.push(fail({ id: CHECK_ID, ruleId: `decision-${number}`, beatId: beat.id, expected: 'locked decision', actual: 'pending or unknown decision asserted as locked' }));
        }
      }
      const referencedRuleIds = [...String(row.how).matchAll(/\b([a-z][a-z0-9-]+)\b/g)].map((match) => match[1]);
      const existingRuleIds = new Set(rules.map((rule) => rule.id));
      const matchingRuleId = referencedRuleIds.find((candidate) => existingRuleIds.has(candidate));
      if (!matchingRuleId) {
        problems.push(fail({ id: CHECK_ID, ruleId: `decision-${[...decisionNumbers].join('-')}`, beatId: beat.id, expected: 'applicable decision references an existing beat rule', actual: row.how }));
      }
    }
  }
}

if (!lockedDecisionNumbers.size) {
  problems.push(fail({ id: CHECK_ID, ruleId: 'ledger-format', beatId: 'ledger', expected: 'numbered LOCKED decisions', actual: 'none parsed' }));
}

if (problems.length) {
  console.error(`${CHECK_ID} failed.\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`${CHECK_ID} passed: ${lockedDecisionNumbers.size} locked ledger decision sections have rule-backed authored coverage.`);
