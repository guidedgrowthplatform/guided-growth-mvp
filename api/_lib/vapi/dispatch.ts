/**
 * Vapi tool-call dispatcher.
 *
 * Maps tool name → handler. Each handler is responsible for its own arg
 * validation (anon_id format, schema-required fields, etc.) and returns the
 * per-tool-call result shape Vapi expects: `{ result: string }` on success or
 * `{ error: string }` on failure. The HTTP entrypoint in api/vapi/[...path].ts
 * wraps these into the top-level `results: [{ toolCallId, ... }]` envelope.
 *
 * Adding a tool: add a case below and a handler in ./handlers/. The handler
 * must validate `args.anon_id` itself — there's no shared middleware for it
 * because Vapi has no JWT (see CLAUDE.md auth notes).
 */
import { submitProfile } from './handlers/submitProfile.js';
import { submitPathChoice } from './handlers/submitPathChoice.js';
import { submitCategory } from './handlers/submitCategory.js';
import { submitGoals } from './handlers/submitGoals.js';
import { addHabit } from './handlers/addHabit.js';
import { removeHabit } from './handlers/removeHabit.js';
import { updateHabit } from './handlers/updateHabit.js';
import { submitReflectionConfig } from './handlers/submitReflectionConfig.js';
import { submitCustomPrompts } from './handlers/submitCustomPrompts.js';
import { submitBrainDump } from './handlers/submitBrainDump.js';
import { navigateNext } from './handlers/navigateNext.js';
import { confirmPlan } from './handlers/confirmPlan.js';
import { logEntry } from './handlers/logEntry.js';

export type DispatchResult = { result: string } | { error: string };

export async function dispatchVapiToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<DispatchResult> {
  switch (name) {
    case 'submit_profile':
      return submitProfile(args);
    case 'submit_path_choice':
      return submitPathChoice(args);
    case 'submit_category':
      return submitCategory(args);
    case 'submit_goals':
      return submitGoals(args);
    case 'add_habit':
      return addHabit(args);
    case 'remove_habit':
      return removeHabit(args);
    case 'update_habit':
      return updateHabit(args);
    case 'submit_reflection_config':
      return submitReflectionConfig(args);
    case 'submit_custom_prompts':
      return submitCustomPrompts(args);
    case 'submit_brain_dump':
      return submitBrainDump(args);
    case 'navigate_next':
      return navigateNext(args);
    case 'confirm_plan':
      return confirmPlan(args);
    case 'log_entry':
      return logEntry(args);
    default:
      console.log(`[vapi/tool] unknown_tool name=${name}`);
      return { error: `unknown_tool: ${name}` };
  }
}
