import { buildOnboardingPrompt } from './onboardingPrompt.js';
import { getOpenAIKey } from './openai.js';

export interface OnboardingAction {
  action: string;
  params: Record<string, unknown>;
}

export interface OnboardingTurnResult {
  message: string;
  actions: OnboardingAction[];
}

// Field-extraction only; client owns navigation (nav/error dropped server-side).
const ALLOWED_ACTIONS = new Set([
  'select_option',
  'select_multiple',
  'fill_field',
  'add_habit',
  'update_habit',
  'remove_habit',
  'set_reflection_config',
  'set_path',
]);

// Multi-action override appended after the single-action prompt's vocabulary.
const MULTI_ACTION_OVERRIDE = `

## MULTI-ACTION OVERRIDE (this supersedes ALL conflicting rules above)
IGNORE any earlier instruction to "pick the single highest-value action", to "not invent multi-action arrays", or to return one action per turn. Those apply to the voice path, NOT here. On screens that collect more than one field, you collect them SEQUENTIALLY.

Return ONLY JSON: { "message": string, "actions": [ { "action": ..., "params": ... }, ... ] }.
Use ONLY field-extraction actions: fill_field, select_option, select_multiple, add_habit, update_habit, remove_habit, set_reflection_config, set_path (same params shapes defined above).

Rules:
1. Emit one action for EVERY field the user volunteered this turn (e.g. "Mintesnot, 25, male" → three actions). Never drop a field the user gave.
2. Never re-ask or overwrite a field already in Already-Filled Fields.
3. \`message\` is a short, warm coach line (≤ 2 sentences). After acknowledging what you captured, ask for the NEXT still-missing field BY NAME. Do not ask a combined/multi-field question — one field at a time. When nothing is left to collect, just give a brief warm confirmation.
4. NEVER ask the user to confirm, verify, double-check, or repeat back a value. Once captured, a value is final — do not add a confirmation step.
5. You do NOT control navigation. NEVER emit navigate_next or confirm_plan — the client decides when to advance. Just extract fields and ask for the next one.
6. ALWAYS map the input to the current screen's field FIRST. Short and yes/no answers ARE answers — e.g. on the experience fork ("have you tracked habits before?"): "yes" / "I have" / "I've done this" → set_path braindump; "no" / "I'm new" / "first time" → set_path simple. Only when the input maps to NO field (e.g. an off-topic question) do you return an empty actions array with a brief warm message that answers briefly and re-asks the next still-missing field. NEVER return an "error" action and never strand the user.
7. Use the user's REAL name and details in your message. NEVER output placeholders like [NAME], [AGE], or [EMAIL] — ignore any earlier instruction to scrub PII from the response.
8. ONLY ask for fields that belong to the CURRENT screen_id (see its Per-Screen Vocabulary entry above). NEVER ask about a field from a different screen — e.g. on ONBOARD-FORK--FORM the ONLY field is \`path\`; do not ask about name, age, gender, or referral there. If EVERY field for the current screen is already in Already-Filled Fields, ask for NOTHING — reply with one short sentence that names their current choice (read it from Already-Filled Fields; you CAN see it) and invite them to keep it or change it.
9. On the path fork, refer to the two choices to the user ONLY as "beginner" (internal: simple) and "advanced" (internal: braindump). NEVER say "simple", "braindump", or "brain dump" in a message — those are internal values.

Example (ONBOARD-01, nothing filled yet), user="Mintesnot, 25":
{"message":"Thanks, Mintesnot! And how do you identify — Male, Female, or Other?","actions":[{"action":"fill_field","params":{"fieldName":"nickname","value":"Mintesnot"}},{"action":"fill_field","params":{"fieldName":"age","value":"25"}}]}

Example (ONBOARD-01, nickname+age+gender already filled), user="founder invite":
{"message":"Perfect — that's everything!","actions":[{"action":"select_option","params":{"fieldName":"referralSource","value":"Founder Invite"}}]}`;

function sanitizeParams(raw: unknown): Record<string, unknown> {
  const safe = Object.create(null) as Record<string, unknown>;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        safe[k] = v;
      }
    }
  }
  return safe;
}

export async function runOnboardingTurn(input: {
  screenId: string;
  step?: number;
  text: string;
  options: string[];
  filledFields: Record<string, unknown>;
}): Promise<OnboardingTurnResult> {
  const apiKey = getOpenAIKey();

  const systemPrompt =
    buildOnboardingPrompt({
      screen_id: input.screenId,
      step: input.step,
      options: input.options,
      prompt: '',
      filled_fields: input.filledFields,
    }) + MULTI_ACTION_OVERRIDE;

  // Onboarding needs the real name — no PII scrub (mirrors process-command).
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.text },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from GPT');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('GPT returned invalid JSON response');
  }

  const message = typeof parsed.message === 'string' ? parsed.message : '';
  const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: OnboardingAction[] = [];
  for (const a of rawActions) {
    if (!a || typeof a !== 'object') continue;
    const action = String((a as Record<string, unknown>).action ?? '');
    if (!ALLOWED_ACTIONS.has(action)) continue;
    actions.push({ action, params: sanitizeParams((a as Record<string, unknown>).params) });
  }

  return { message, actions };
}
