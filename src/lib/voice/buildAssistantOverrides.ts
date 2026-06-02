import { buildContextMessage } from '@/lib/context/buildContextMessage';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';

// Per-call Vapi overrides for the cold-start contextual opening. Two pieces:
//
// 1. `firstMessageMode: assistant-speaks-first-with-model-generated-message`
//    tells Vapi to skip the static dashboard `firstMessage` string and have
//    the LLM produce turn 0 from the system prompt.
//
// 2. `variableValues.initial_screen_context` — the screen's context block +
//    recent session_log events, formatted by `buildContextMessage`. The
//    Vapi assistant dashboard prompt MUST include the placeholder
//    `{{initial_screen_context}}` at the position where this should land
//    (typically just below CORE_IDENTITY / CRISIS_BOUNDARY / RESPONSE_RULES,
//    matching the position pushScreenContext targets mid-session). Without
//    the placeholder Vapi silently drops the substitution and falls back to
//    the static firstMessage — same behavior as before this change.
//
// Why this path and not `assistantOverrides.model.messages`:
// Vapi rejects `model` overrides that omit `provider`/`model` (HTTP 400,
// "model.provider must be one of …"). variableValues already works today
// for anon_id/screen/coaching_style; adding one more variable is the
// minimal-blast-radius change.
export interface VapiContextOverrides {
  firstMessageMode: 'assistant-speaks-first-with-model-generated-message';
  variableValues: {
    initial_screen_context: string;
  };
}

export interface BuildAssistantOverridesInput {
  screenId: string;
  contextBlock: string;
  stateDelta: readonly SessionStateDeltaEntry[];
  // Optional snapshot of already-filled form fields (merged persisted +
  // in-flight). Renders into the same initial_screen_context message so
  // Vapi sees it in turn 0 — no race with the opening greeting.
  filledFormState?: Record<string, unknown>;
}

// Builds the per-call Vapi override payload so the assistant's first
// utterance is generated from the current screen + recent session_log,
// instead of speaking the static dashboard `firstMessage`.
export function buildAssistantOverrides(input: BuildAssistantOverridesInput): VapiContextOverrides {
  const initialScreenContext = buildContextMessage({
    screen_id: input.screenId,
    context_block: input.contextBlock,
    state_delta: input.stateDelta,
    filled_form_state: input.filledFormState,
  });
  return {
    firstMessageMode: 'assistant-speaks-first-with-model-generated-message',
    variableValues: { initial_screen_context: initialScreenContext },
  };
}
