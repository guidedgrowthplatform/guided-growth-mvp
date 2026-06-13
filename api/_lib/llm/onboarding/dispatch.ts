import type { ToolResult } from '../tools.js';
import { addHabit } from './handlers/addHabit.js';
import { advanceStep } from './handlers/advanceStep.js';
import { askClarification } from './handlers/askClarification.js';
import { confirmPlan } from './handlers/confirmPlan.js';
import { removeHabit } from './handlers/removeHabit.js';
import { submitBrainDump } from './handlers/submitBrainDump.js';
import { submitCategory } from './handlers/submitCategory.js';
import { submitGoals } from './handlers/submitGoals.js';
import { submitPathChoice } from './handlers/submitPathChoice.js';
import { submitProfile } from './handlers/submitProfile.js';
import { submitReflectionConfig } from './handlers/submitReflectionConfig.js';
import { updateHabit } from './handlers/updateHabit.js';
import { submitCustomPrompts } from './handlers/submitCustomPrompts.js';
import type { OnboardingHandlerCtx } from './handlers/shared.js';
import { isOnboardingToolName, type OnboardingToolName } from './schemas.js';

type Handler = (ctx: OnboardingHandlerCtx, args: Record<string, unknown>) => Promise<ToolResult>;

const HANDLERS: Record<OnboardingToolName, Handler> = {
  submit_profile: submitProfile,
  submit_path_choice: submitPathChoice,
  submit_category: submitCategory,
  submit_goals: submitGoals,
  add_habit: addHabit,
  remove_habit: removeHabit,
  update_habit: updateHabit,
  submit_reflection_config: submitReflectionConfig,
  submit_custom_prompts: submitCustomPrompts,
  submit_brain_dump: submitBrainDump,
  advance_step: advanceStep,
  confirm_plan: confirmPlan,
  ask_clarification: askClarification,
};

export async function dispatchOnboardingToolCall(
  name: string,
  args: unknown,
  ctx: { anon_id: string | null | undefined; screen_id?: string | null },
): Promise<ToolResult> {
  if (!ctx.anon_id) {
    return { ok: false, error: 'invalid_args', message: 'missing anon_id' };
  }
  if (!isOnboardingToolName(name)) {
    return { ok: false, error: 'unknown_tool', message: `Unknown tool: ${name}` };
  }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { ok: false, error: 'invalid_args', message: 'args must be an object' };
  }
  const handler = HANDLERS[name];
  return handler(
    { anon_id: ctx.anon_id, screen_id: ctx.screen_id ?? undefined },
    args as Record<string, unknown>,
  );
}
