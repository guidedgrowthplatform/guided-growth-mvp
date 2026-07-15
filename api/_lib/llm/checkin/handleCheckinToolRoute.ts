import type { VercelRequest, VercelResponse } from '@vercel/node';
import { reportToolFailure } from '../../sentry.js';
import { validateTimezone } from '../../validation.js';
import type { ToolResult } from '../tools.js';
import { dispatchCheckinToolCall } from './dispatch.js';

// Tap-driven check-in writes from the flow engine + Siri App Intents quick-log
// (complete_habit / log_metric). Reuses the same handlers the coach fires by
// voice. Allowlisted so this is not a generic 15-tool gateway that bypasses
// per-screen tool gating.
const TAP_ALLOWED_TOOLS = new Set([
  'record_checkin',
  'complete_habit',
  'log_reflection',
  'log_metric',
]);

export async function handleCheckinTool(
  req: VercelRequest,
  res: VercelResponse,
  user: { anonId: string },
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const toolName = body.toolName;
  if (typeof toolName !== 'string' || !TAP_ALLOWED_TOOLS.has(toolName)) {
    res.status(400).json({ error: 'unsupported toolName' });
    return;
  }

  const args =
    typeof body.args === 'object' && body.args !== null && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};
  const timezone = validateTimezone(body.timezone) ?? 'UTC';

  let result: ToolResult;
  try {
    result = await dispatchCheckinToolCall(toolName, args, { anon_id: user.anonId, timezone });
  } catch (err) {
    reportToolFailure({
      tool: toolName,
      anonId: user.anonId,
      errorCode: 'handler_error',
      args,
      error: err,
    });
    res.status(500).json({ error: 'handler_error', message: (err as Error).message });
    return;
  }

  if (result.ok) {
    res.status(200).json(result);
    return;
  }
  // Client error (bad input) vs infra error, so the optimistic frontend can tell
  // a validation reject from a save outage.
  const status = result.error === 'handler_error' ? 500 : 400;
  res.status(status).json({ error: result.error, message: result.message });
}
