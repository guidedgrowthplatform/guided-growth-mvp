import type { ToolResult } from '../../tools.js';
import { ok, type OnboardingHandlerCtx } from './shared.js';

// Completion side-effect is client-side (PlanReviewPage.complete()); this tool
// only signals the user confirmed the plan so the frontend fires it.
export async function confirmPlan(
  _ctx: OnboardingHandlerCtx,
  _args: Record<string, unknown>,
): Promise<ToolResult> {
  return ok({ confirmed: true });
}
