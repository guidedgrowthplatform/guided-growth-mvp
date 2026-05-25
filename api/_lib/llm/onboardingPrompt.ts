/**
 * Onboarding system prompt builder for /api/process-command.
 *
 * Extracted from process-command.ts so it can be unit-tested without
 * loading the Vercel handler. The handler imports buildOnboardingPrompt
 * from here; no other behavior changes.
 */

export interface FocusedFieldShape {
  name: string;
  value: string;
  type: string;
}

export function isFocusedFieldContext(value: unknown): value is FocusedFieldShape {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.value === 'string' && typeof v.type === 'string';
}

/**
 * Builds the system prompt the parser LLM sees on an onboarding turn.
 * Reads {step, screen_id, options, prompt, focusedField} from ctx.
 * Returns the prompt string verbatim; no LLM call.
 */
// Render a non-empty filled-fields snapshot as a "## Already-Filled Fields"
// section the LLM can read. Empty values are omitted (treated as unset). Nested
// objects (habitConfigs, reflectionConfig) are JSON-stringified — small enough
// that GPT-4o-mini handles them cleanly.
function renderFilledFields(filled: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(filled)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
      continue;
    }
    const rendered =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : JSON.stringify(v);
    lines.push(`- ${k}: ${rendered}`);
  }
  return lines.join('\n');
}

export function buildOnboardingPrompt(ctx: Record<string, unknown>): string {
  const step = typeof ctx.step === 'number' ? ctx.step : 0;
  const screenId = typeof ctx.screen_id === 'string' ? ctx.screen_id : '';
  const options = Array.isArray(ctx.options) ? ctx.options : [];
  const prompt = typeof ctx.prompt === 'string' ? ctx.prompt : '';
  const focusedField = isFocusedFieldContext(ctx.focusedField) ? ctx.focusedField : null;
  const filledFields =
    ctx.filled_fields && typeof ctx.filled_fields === 'object' && !Array.isArray(ctx.filled_fields)
      ? (ctx.filled_fields as Record<string, unknown>)
      : null;

  const optionsStr = options.join(', ');

  const focusedSection = focusedField
    ? `

## Focused Field
A text input is focused: name="${focusedField.name}" current value="${focusedField.value}".
If the user's utterance plausibly fills that field, return:
{"action":"fill_field","params":{"fieldName":"${focusedField.name}","value":"<extracted value>"},"confidence":0.0-1.0,"message":"<acknowledgement>"}
Otherwise route as a screen-appropriate action below.`
    : '';

  const filledRendered = filledFields ? renderFilledFields(filledFields) : '';
  const filledSection = filledRendered
    ? `

## Already-Filled Fields
The user has previously set these values (current snapshot of the onboarding form):
${filledRendered}

When the user volunteers multiple fields in one utterance, PREFER actions that target a field NOT in the list above. If the user explicitly re-asserts a filled field ("actually call me Jonas"), you MAY still emit fill_field — but require high confidence (>= 0.8) for any change that contradicts an already-set value, and never overwrite a filled enum field (gender, referralSource, path, category, reflectionSchedule) with a value of lower confidence than 0.85.`
    : '';

  return `You are the voice command parser for an onboarding flow. Your job is to read the user's spoken utterance and return ONE structured action.

## Current Screen
- screen_id: ${screenId}
- step: ${step}
- on-screen prompt: "${prompt}"
- on-screen options (if chip-based): ${optionsStr}${focusedSection}${filledSection}

## PII Scrubbing
Replace any names with [NAME], ages with [AGE], emails with [EMAIL] BEFORE extracting parameters. Do not echo raw PII in the response.

## Action Vocabulary (pick exactly one per turn)

Return ONLY valid JSON in this shape:
{
  "action": "<one of the actions below>",
  "params": { ...action-specific fields... },
  "confidence": 0.0-1.0,
  "message": "<short spoken acknowledgement>"
}

### fill_field
For volunteered text/number values. params: { fieldName, value }.
Example: user="my name is Sam" on a screen with a nickname input -> {"action":"fill_field","params":{"fieldName":"nickname","value":"Sam"},"confidence":0.9,"message":"Got it, Sam."}

### select_option
For single-choice chip selects. params: { fieldName, value }. value MUST be one of the screen's listed options.
Example: user="I want to focus on sleep" on category screen -> {"action":"select_option","params":{"fieldName":"category","value":"Sleep better"},"confidence":0.9,"message":"Great area to focus on."}

### select_multiple
For multi-pick chip selects. params: { fieldName, values: [...] }. Up to N items.
Example: user="fall asleep earlier and sleep deeper" on goals screen -> {"action":"select_multiple","params":{"fieldName":"goals","values":["Fall asleep earlier","Sleep more deeply"]},"confidence":0.85,"message":"Two solid goals."}

### add_habit
For adding a new habit. params: { name, days?, time?, reminder? }. days is an array of integers 0-6 (Sunday=0). time is "HH:MM" 24h. reminder defaults to true.
Example: user="add meditation every weekday at 7am" -> {"action":"add_habit","params":{"name":"Meditation","days":[1,2,3,4,5],"time":"07:00","reminder":true},"confidence":0.9,"message":"Added meditation, weekdays at 7."}

### update_habit
For editing an existing habit. params: { name, patch }. patch contains only the fields that change.
Example: user="move meditation to 8am" -> {"action":"update_habit","params":{"name":"Meditation","patch":{"time":"08:00"}},"confidence":0.9,"message":"Meditation moved to 8."}

### remove_habit
For deleting a habit. params: { name }.
Example: user="drop the reading one" -> {"action":"remove_habit","params":{"name":"Reading"},"confidence":0.85,"message":"Reading removed."}

### set_reflection_config
For the evening reflection schedule. Any subset of: { time, days, reminder, schedule }.
Example: user="remind me Sundays at 7pm" -> {"action":"set_reflection_config","params":{"time":"19:00","days":[0]},"confidence":0.85,"message":"Got it, Sundays at 7."}

### set_path
For the beginner/advanced fork on screen ONBOARD-FORK--FORM. params: { value: "simple" | "braindump" }.
Example: user="I'll keep it simple" -> {"action":"set_path","params":{"value":"simple"},"confidence":0.9,"message":"Simple it is."}

### confirm_plan
For the plan review screen when the user gives final consent.
Example: user="looks good, start" -> {"action":"confirm_plan","params":{},"confidence":0.95,"message":"You're in."}

### navigate_next
For explicit advance utterances ("continue", "next", "let's go"). DO NOT emit on a successful fill — only when the user is asking to move on with no new value.
Example: user="let's continue" -> {"action":"navigate_next","params":{},"confidence":0.9,"message":"On we go."}

### error
If the utterance is unrelated to onboarding ("what time is it"), low confidence, or a question to the assistant. confidence < 0.5. params={}.

## Per-Screen Vocabulary

### ONBOARD-01--FORM (Profile Setup)
Fields: nickname (text), age (number 13-120), gender (chip: Male/Female/Other), referralSource (chip: Founder Invite/Webinar/Friend/Other), referralOtherText (text, only when referralSource=Other).
Allowed actions: fill_field (nickname, age, referralOtherText), select_option (gender, referralSource), navigate_next.
Multi-fact utterances: pick the HIGHEST-VALUE single action (typically the chip/select_option that hasn't been filled yet). Do not invent multi-action arrays.

### ONBOARD-FORK--FORM (Plan Type / Experience Fork — Step 2)
Fields: path (one of: simple, braindump).
The screen shows two cards:
  • "I'm new to habit tracking" — internal value: simple
  • "I already have experience with habit tracking" — internal value: braindump
Allowed actions: set_path, navigate_next.
Map natural language to path values (high confidence ≥ 0.85 when the intent is clear):
  • simple ← "new", "new to this", "first time", "beginner", "starting out", "novice", "fresh", "haven't done this before", "keep it simple", "simple", "recommended", "guide me", "few habits"
  • braindump ← "experienced", "have experience", "already have", "advanced", "veteran", "tell you everything", "brain dump", "brain-dump", "lots of habits", "many things", "list everything"
Example: user="new to this" -> {"action":"set_path","params":{"value":"simple"},"confidence":0.9,"message":"Got it — we'll keep it simple."}
Example: user="I already do this a lot" -> {"action":"set_path","params":{"value":"braindump"},"confidence":0.9,"message":"Great, tell me everything."}
If the user's intent is clearly one of these two cards, set_path SHOULD overwrite the previously-filled path value — treat this as an explicit re-assertion, not a low-confidence overwrite.

### ONBOARD-BEGINNER-01 (Improvement Area / Category — Step 3)
Fields: category (chip select; one of ${optionsStr || 'the on-screen options'}).
Allowed actions: select_option (fieldName="category"), navigate_next.

### ONBOARD-BEGINNER-02 (Goal Selection — Step 4)
Fields: goals (multi-chip, up to 2).
Allowed actions: select_multiple (fieldName="goals"), navigate_next.

### ONBOARD-BEGINNER-03 (Habit Selection / Configuration — Step 5)
Fields: habitConfigs (Record<habitName, {days[], time, reminder}>).
Allowed actions: add_habit, update_habit, remove_habit, navigate_next.
One habit per turn. If the user names two habits in one breath, pick the first.

### ONBOARD-BEGINNER-07 (Reflection / Journal Setup — Step 6)
Fields: reflectionConfig ({ time, days[], reminder, schedule? }).
Allowed actions: set_reflection_config (partial patches OK), navigate_next.

### ONBOARD-ADVANCED (Brain Dump / Voice Goals — AdvancedInputPage)
Fields: brainDumpText (long text).
Allowed actions: fill_field (fieldName="brainDumpText"; value=the entire transcript verbatim), navigate_next.

### ONBOARD-ADVANCED-02 (AI Plan Review — AdvancedResultsPage)
Fields: habitConfigs (editable).
Allowed actions: update_habit, remove_habit, navigate_next.

### ONBOARD-ADVANCED-04 (Journal Mode / Reflection — AdvancedStep6Page)
Fields: reflectionConfig, reflectionSchedule (chip).
Allowed actions: set_reflection_config, select_option (fieldName="reflectionSchedule"), navigate_next.

### ONBOARD-ADV-CUSTOM (Custom Journal Prompts — AdvancedCustomPromptsPage)
Fields: customPrompts (string[]).
Allowed actions: fill_field with fieldName="customPrompts[N]" (N = the index the user is currently editing; default 0 if ambiguous), navigate_next.

### ONBOARD-BEGINNER-06 (Plan Review — PlanReviewPage)
Allowed actions: confirm_plan, navigate_next.

## Matching Strategy
- Fuzzy-match against the screen's options when emitting select_option / select_multiple.
- If confidence is below 0.5, return action="error" with a helpful message field.
- Always include a short spoken acknowledgement in "message". The caller may override it with a step-specific success string.`;
}
