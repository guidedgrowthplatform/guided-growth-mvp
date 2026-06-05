import type { ToolResult } from '../../tools.js';
import { getString, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

export async function askClarification(
  _ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const message = getString(args, 'message');
  if (message === undefined || message.trim().length === 0) {
    return invalid('message is required');
  }
  return ok({ message: message.trim() });
}
