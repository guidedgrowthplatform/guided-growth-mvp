/**
 * MVP-04: Prompt Validation Script
 * Runs 30 test cases against the GPT-4o-mini system prompt
 * Usage: npx tsx scripts/validate-prompt.ts
 */

import { config } from 'dotenv';
import { VOICE_COMMAND_SYSTEM_PROMPT, VOICE_COMMAND_MODEL_CONFIG } from '../src/lib/prompts/voice-command-system';

config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found. Create .env.local with your key.');
  process.exit(1);
}

// ─── Test Case Definitions ───

interface TestCase {
  id: number;
  tier: 1 | 2 | 3;
  transcript: string;
  expectedAction: string;
  expectedEntity: string;
  /** Key params that MUST be present (subset check) */
  requiredParams: Record<string, unknown>;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // ═══ Tier 1 — Simple CRUD (5 from MVP-03) ═══
  { id: 1,  tier: 1, transcript: 'Create a habit called meditation',              expectedAction: 'create',   expectedEntity: 'habit',   requiredParams: { name: 'meditation' },     description: 'Basic create habit' },
  { id: 2,  tier: 1, transcript: 'Add a metric called sleep quality',              expectedAction: 'create',   expectedEntity: 'metric',  requiredParams: { name: 'sleep quality' },  description: 'Basic create metric' },
  { id: 3,  tier: 1, transcript: 'Mark meditation done for today',                 expectedAction: 'complete', expectedEntity: 'habit',   requiredParams: { name: 'meditation' },     description: 'Basic mark done' },
  { id: 4,  tier: 1, transcript: 'Delete the exercise habit',                      expectedAction: 'delete',   expectedEntity: 'habit',   requiredParams: { name: 'exercise' },       description: 'Basic delete' },
  { id: 5,  tier: 1, transcript: 'Show my habits',                                 expectedAction: 'query',    expectedEntity: 'habit',   requiredParams: {},                          description: 'Basic query' },

  // ═══ Tier 2 — Parameterized (5 from MVP-03) ═══
  { id: 6,  tier: 2, transcript: 'Create a habit called exercise, three times a week', expectedAction: 'create', expectedEntity: 'habit', requiredParams: { name: 'exercise' },       description: 'Create with frequency' },
  { id: 7,  tier: 2, transcript: 'Add a metric for mood, scale 1 to 10, tracked daily', expectedAction: 'create', expectedEntity: 'metric', requiredParams: { name: 'mood' },     description: 'Create scale metric' },
  { id: 8,  tier: 2, transcript: 'Log my sleep quality as 8 out of 10',            expectedAction: 'log',      expectedEntity: 'metric',  requiredParams: { name: 'sleep quality', value: 8 }, description: 'Log metric value' },
  { id: 9,  tier: 2, transcript: 'Mark reading done for Monday',                   expectedAction: 'complete', expectedEntity: 'habit',   requiredParams: { name: 'reading' },        description: 'Mark done specific day' },
  { id: 10, tier: 2, transcript: 'Rename my exercise habit to morning workout',    expectedAction: 'update',   expectedEntity: 'habit',   requiredParams: { name: 'exercise', newName: 'morning workout' }, description: 'Rename habit' },

  // ═══ Tier 3 — Contextual / Analytical (5 from MVP-03) ═══
  { id: 11, tier: 3, transcript: 'How am I doing with meditation this month?',     expectedAction: 'query',    expectedEntity: 'habit',   requiredParams: { name: 'meditation' },     description: 'Query with period' },
  { id: 12, tier: 3, transcript: "What's my longest streak?",                      expectedAction: 'query',    expectedEntity: 'habit',   requiredParams: {},                          description: 'Streak query' },
  { id: 13, tier: 3, transcript: "I slept terribly and I'm feeling stressed",      expectedAction: 'reflect',  expectedEntity: 'journal', requiredParams: {},                          description: 'Reflective statement' },
  { id: 14, tier: 3, transcript: 'Suggest a new habit for me',                     expectedAction: 'suggest',  expectedEntity: 'habit',   requiredParams: {},                          description: 'Suggestion request' },
  { id: 15, tier: 3, transcript: 'Give me a weekly summary',                       expectedAction: 'query',    expectedEntity: 'summary', requiredParams: { period: 'week' },         description: 'Weekly summary' },

  // ═══ Edge Cases — 15 additional ═══
  { id: 16, tier: 1, transcript: 'um create new habits playing guitar',            expectedAction: 'create',   expectedEntity: 'habit',   requiredParams: { name: 'playing guitar' }, description: 'Filler words + plural' },
  { id: 17, tier: 1, transcript: 'I did meditation',                               expectedAction: 'complete', expectedEntity: 'habit',   requiredParams: { name: 'meditation' },     description: 'Casual completion' },
  { id: 18, tier: 1, transcript: 'mark reading is done',                           expectedAction: 'complete', expectedEntity: 'habit',   requiredParams: { name: 'reading' },        description: 'Filler "is" in mark done' },
  { id: 19, tier: 2, transcript: 'my mood was 7 today',                            expectedAction: 'log',      expectedEntity: 'metric',  requiredParams: { name: 'mood', value: 7 }, description: 'Casual metric log' },
  { id: 20, tier: 1, transcript: 'creat a habbit called yoga',                     expectedAction: 'create',   expectedEntity: 'habit',   requiredParams: { name: 'yoga' },           description: 'Typos in command' },
  { id: 21, tier: 1, transcript: 'what habits do I have',                          expectedAction: 'query',    expectedEntity: 'habit',   requiredParams: {},                          description: 'Alternative query phrasing' },
  { id: 22, tier: 2, transcript: 'finished my exercise for today',                 expectedAction: 'complete', expectedEntity: 'habit',   requiredParams: { name: 'exercise' },       description: '"finished" as complete' },
  { id: 23, tier: 3, transcript: "I'm feeling really happy and energetic today",   expectedAction: 'reflect',  expectedEntity: 'journal', requiredParams: {},                          description: 'Positive mood reflect' },
  { id: 24, tier: 2, transcript: 'add a habit for running every morning',          expectedAction: 'create',   expectedEntity: 'habit',   requiredParams: { name: 'running' },        description: 'Create with description' },
  { id: 25, tier: 3, transcript: 'what should I focus on this week',               expectedAction: 'suggest',  expectedEntity: 'habit',   requiredParams: {},                          description: 'Implicit suggestion' },
  { id: 26, tier: 2, transcript: 'record my sleep quality as 6',                   expectedAction: 'log',      expectedEntity: 'metric',  requiredParams: { name: 'sleep quality', value: 6 }, description: '"record" as log' },
  { id: 27, tier: 1, transcript: 'remove the reading habit',                       expectedAction: 'delete',   expectedEntity: 'habit',   requiredParams: { name: 'reading' },        description: '"remove" as delete' },
  { id: 28, tier: 2, transcript: 'change exercise to afternoon jog',               expectedAction: 'update',   expectedEntity: 'habit',   requiredParams: { name: 'exercise' },       description: '"change" as update' },
  { id: 29, tier: 3, transcript: 'how many times did I meditate this week',        expectedAction: 'query',    expectedEntity: 'habit',   requiredParams: { name: 'meditation' },     description: 'Count query' },
  { id: 30, tier: 3, transcript: 'please can you like um suggest something for me', expectedAction: 'suggest', expectedEntity: 'habit',   requiredParams: {},                          description: 'Heavy filler words' },
];

// ─── API Call ───

interface GPTResult {
  action: string;
  entity: string;
  params: Record<string, unknown>;
  confidence: number;
}

async function callGPT(transcript: string): Promise<{ result: GPTResult; latency: number; tokens: number }> {
  const start = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...VOICE_COMMAND_MODEL_CONFIG,
      messages: [
        { role: 'system', content: VOICE_COMMAND_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokens = data.usage?.total_tokens ?? 0;
  const latency = Date.now() - start;

  return { result: JSON.parse(content), latency, tokens };
}

// ─── Validation Logic ───

interface TestResult {
  id: number;
  tier: number;
  transcript: string;
  description: string;
  passed: boolean;
  actionOk: boolean;
  entityOk: boolean;
  paramsOk: boolean;
  expected: { action: string; entity: string; params: Record<string, unknown> };
  actual: GPTResult;
  latency: number;
  tokens: number;
  issues: string[];
}

function validateResult(test: TestCase, actual: GPTResult): { passed: boolean; actionOk: boolean; entityOk: boolean; paramsOk: boolean; issues: string[] } {
  const issues: string[] = [];

  const actionOk = actual.action === test.expectedAction;
  if (!actionOk) issues.push(`action: expected "${test.expectedAction}", got "${actual.action}"`);

  const entityOk = actual.entity === test.expectedEntity;
  if (!entityOk) issues.push(`entity: expected "${test.expectedEntity}", got "${actual.entity}"`);

  let paramsOk = true;
  for (const [key, value] of Object.entries(test.requiredParams)) {
    const actualVal = actual.params?.[key];
    if (typeof value === 'number') {
      if (Number(actualVal) !== value) {
        paramsOk = false;
        issues.push(`params.${key}: expected ${value}, got ${actualVal}`);
      }
    } else if (typeof value === 'string') {
      const actualStr = String(actualVal || '').toLowerCase();
      const expectedStr = String(value).toLowerCase();
      if (!actualStr.includes(expectedStr)) {
        paramsOk = false;
        issues.push(`params.${key}: expected "${value}", got "${actualVal}"`);
      }
    }
  }

  return { passed: actionOk && entityOk && paramsOk, actionOk, entityOk, paramsOk, issues };
}

// ─── Main Runner ───

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  MVP-04: Voice Command Prompt Validation                    ║');
  console.log('║  Model: gpt-4o-mini | 30 test cases                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];
  let totalTokens = 0;
  let totalLatency = 0;

  for (const test of TEST_CASES) {
    process.stdout.write(`  [${String(test.id).padStart(2)}] T${test.tier} ${test.description.padEnd(30)} ... `);

    try {
      const { result, latency, tokens } = await callGPT(test.transcript);
      const { passed, actionOk, entityOk, paramsOk, issues } = validateResult(test, result);

      totalTokens += tokens;
      totalLatency += latency;

      results.push({
        id: test.id,
        tier: test.tier,
        transcript: test.transcript,
        description: test.description,
        passed,
        actionOk,
        entityOk,
        paramsOk,
        expected: { action: test.expectedAction, entity: test.expectedEntity, params: test.requiredParams },
        actual: result,
        latency,
        tokens,
        issues,
      });

      console.log(passed ? '✅ PASS' : `❌ FAIL ${issues.join(', ')}`);
    } catch (err) {
      console.log(`💥 ERROR: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        id: test.id,
        tier: test.tier,
        transcript: test.transcript,
        description: test.description,
        passed: false,
        actionOk: false,
        entityOk: false,
        paramsOk: false,
        expected: { action: test.expectedAction, entity: test.expectedEntity, params: test.requiredParams },
        actual: { action: 'ERROR', entity: 'ERROR', params: {}, confidence: 0 },
        latency: 0,
        tokens: 0,
        issues: [`Error: ${err instanceof Error ? err.message : String(err)}`],
      });
    }

    // Rate limiting — small delay between calls
    await new Promise((r) => setTimeout(r, 200));
  }

  // ─── Summary ───
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('══════════════════════════════════════════════════════════════\n');

  const tiers = [1, 2, 3] as const;
  const targets = { 1: 90, 2: 80, 3: 60 };

  for (const tier of tiers) {
    const tierResults = results.filter((r) => r.tier === tier);
    const passed = tierResults.filter((r) => r.passed).length;
    const total = tierResults.length;
    const pct = Math.round((passed / total) * 100);
    const target = targets[tier];
    const status = pct >= target ? '✅' : '❌';

    console.log(`  Tier ${tier}: ${passed}/${total} (${pct}%) — target ≥${target}% ${status}`);
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalPct = Math.round((totalPassed / results.length) * 100);
  const avgLatency = Math.round(totalLatency / results.length);
  const avgTokens = Math.round(totalTokens / results.length);

  console.log(`\n  Overall: ${totalPassed}/${results.length} (${totalPct}%)`);
  console.log(`  Avg latency: ${avgLatency}ms`);
  console.log(`  Avg tokens/call: ${avgTokens}`);
  console.log(`  Total tokens used: ${totalTokens}`);

  // ─── Cost Analysis ───
  const costPer1kTokens = 0.00015; // gpt-4o-mini input
  const costPer1kOutputTokens = 0.0006; // gpt-4o-mini output
  const avgCostPerCall = (avgTokens * (costPer1kTokens + costPer1kOutputTokens) / 2) / 1000;

  console.log('\n  ── Cost Projections ──');
  console.log(`  Cost per call: ~$${avgCostPerCall.toFixed(6)}`);
  console.log(`  100 daily users × 10 cmds: ~$${(100 * 10 * avgCostPerCall * 30).toFixed(2)}/month`);
  console.log(`  500 daily users × 10 cmds: ~$${(500 * 10 * avgCostPerCall * 30).toFixed(2)}/month`);
  console.log(`  1000 daily users × 10 cmds: ~$${(1000 * 10 * avgCostPerCall * 30).toFixed(2)}/month`);

  // ─── Failed Tests Detail ───
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log('\n  ── Failed Tests ──');
    for (const f of failures) {
      console.log(`  [${f.id}] "${f.transcript}"`);
      console.log(`    Expected: ${f.expected.action}/${f.expected.entity} ${JSON.stringify(f.expected.params)}`);
      console.log(`    Got:      ${f.actual.action}/${f.actual.entity} ${JSON.stringify(f.actual.params)} (conf: ${f.actual.confidence})`);
      console.log(`    Issues:   ${f.issues.join(', ')}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');

  // Exit with error code if any tier fails its target
  const allTiersPassed = tiers.every((tier) => {
    const tierResults = results.filter((r) => r.tier === tier);
    const pct = Math.round((tierResults.filter((r) => r.passed).length / tierResults.length) * 100);
    return pct >= targets[tier];
  });

  process.exit(allTiersPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
