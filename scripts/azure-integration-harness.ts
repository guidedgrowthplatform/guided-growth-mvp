// Azure cutover integration harness — NOT a vitest test, run manually via tsx.
//
// Proves the app's real LLM chokepoint (api/_lib/llm/openai-responses.ts +
// openai.ts) actually routes to Azure OpenAI end to end when LLM_PROVIDER=azure
// is set: one coach turn that emits a tool call (submit_profile, the real
// onboarding tool schema), then a second chained turn (previous_response_id)
// that submits the tool's output and gets back real coach text. Streaming
// (SSE event parsing) is exercised on both turns since openResponsesStream
// always streams.
//
// Usage:
//   set -a; . ~/.config/guided-growth/azure-openai-prod.env; set +a
//   LLM_PROVIDER=azure npx tsx scripts/azure-integration-harness.ts
//
// Tokens kept tiny (max_output_tokens capped, one short user message) to keep
// this a near-zero-spend smoke test, not a load test.

import { openResponsesStream, type ResponseInputItem } from '../api/_lib/llm/openai-responses.js';
import { ONBOARDING_TOOLS } from '../api/_lib/llm/tools.onboarding.js';
import { getLLMProvider } from '../api/_lib/llm/openai.js';

async function main() {
  const provider = getLLMProvider();
  console.log(`[harness] LLM_PROVIDER resolved to: ${provider}`);
  if (provider !== 'azure') {
    console.error('[harness] LLM_PROVIDER is not "azure" — set it before running this harness.');
    process.exit(1);
  }
  for (const v of [
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT_ONBOARDING',
    'AZURE_OPENAI_DEPLOYMENT_DEFAULT',
  ]) {
    console.log(`[harness] ${v}=${process.env[v] ?? '(unset)'}`);
  }
  console.log(`[harness] AZURE_OPENAI_KEY present: ${Boolean(process.env.AZURE_OPENAI_KEY)}`);

  const submitProfile = ONBOARDING_TOOLS.find((t) => t.name === 'submit_profile');
  if (!submitProfile) throw new Error('submit_profile tool schema not found in ONBOARDING_TOOLS');

  const instructions =
    'You are a brief onboarding coach. When the user states their name and age, ' +
    'call submit_profile with those fields. Keep any spoken reply to one short sentence.';

  // ── Turn 1: user message that should trigger a tool call ──────────────────
  const turn1Input: ResponseInputItem[] = [
    { type: 'message', role: 'user', content: "Hi, I'm Jordan and I'm 34 years old." },
  ];

  console.log('\n[harness] Turn 1: streaming a coach turn with submit_profile offered...');
  const turn1Events: string[] = [];
  let turn1ResponseId: string | null = null;
  let toolCallId: string | null = null;
  let toolArgsRaw: string | null = null;
  let sawDelta = false;

  const stream1 = await openResponsesStream({
    model: 'gpt-4o', // logical onboarding model — resolved to the Azure onboarding deployment
    instructions,
    input: turn1Input,
    tools: [submitProfile],
    toolChoice: 'auto',
    maxOutputTokens: 200,
  });

  for await (const evt of stream1) {
    turn1Events.push(evt.type);
    if (evt.type === 'delta') sawDelta = true;
    if (evt.type === 'tool_call' && evt.name === 'submit_profile') {
      toolCallId = evt.callId;
      toolArgsRaw = evt.argumentsRaw;
    }
    if (evt.type === 'completed') turn1ResponseId = evt.responseId;
    if (evt.type === 'error') throw new Error(`Turn 1 upstream error: ${evt.code} ${evt.message}`);
    if (evt.type === 'incomplete') throw new Error(`Turn 1 incomplete: ${evt.reason}`);
  }

  console.log(`[harness] Turn 1 event types: ${turn1Events.join(', ')}`);
  console.log(`[harness] Turn 1 responseId: ${turn1ResponseId}`);
  console.log(`[harness] Turn 1 tool call: ${toolCallId ? `yes (${toolArgsRaw})` : 'NO'}`);

  if (!toolCallId || !turn1ResponseId) {
    throw new Error('FAIL: turn 1 did not produce a submit_profile function_call + responseId');
  }

  // ── Turn 2: submit the tool output, chained via previous_response_id ──────
  console.log(
    '\n[harness] Turn 2: submitting function_call_output, chained via previous_response_id...',
  );
  const turn2Input: ResponseInputItem[] = [
    {
      type: 'function_call_output',
      call_id: toolCallId,
      output: JSON.stringify({ ok: true, saved: { nickname: 'Jordan', age: '34' } }),
    },
  ];

  const turn2Events: string[] = [];
  let turn2Text = '';
  let turn2ResponseId: string | null = null;

  const stream2 = await openResponsesStream({
    model: 'gpt-4o',
    instructions,
    input: turn2Input,
    previousResponseId: turn1ResponseId,
    maxOutputTokens: 200,
  });

  for await (const evt of stream2) {
    turn2Events.push(evt.type);
    if (evt.type === 'delta') turn2Text += evt.content;
    if (evt.type === 'completed') turn2ResponseId = evt.responseId;
    if (evt.type === 'error') throw new Error(`Turn 2 upstream error: ${evt.code} ${evt.message}`);
    if (evt.type === 'incomplete') throw new Error(`Turn 2 incomplete: ${evt.reason}`);
  }

  console.log(`[harness] Turn 2 event types: ${turn2Events.join(', ')}`);
  console.log(`[harness] Turn 2 responseId: ${turn2ResponseId}`);
  console.log(`[harness] Turn 2 text: ${JSON.stringify(turn2Text)}`);

  if (!turn2ResponseId || turn2Text.trim().length === 0) {
    throw new Error('FAIL: turn 2 (chained) did not complete with real coach text');
  }
  if (!sawDelta && turn2Events.filter((e) => e === 'delta').length === 0) {
    throw new Error('FAIL: no streaming delta events observed across either turn');
  }

  console.log(
    '\n[harness] PASS — Azure served: function-call turn 1, previous_response_id chaining,',
  );
  console.log(
    '[harness] tool-output turn 2 with real text, SSE streaming events parsed throughout.',
  );
}

main().catch((err) => {
  console.error('\n[harness] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
