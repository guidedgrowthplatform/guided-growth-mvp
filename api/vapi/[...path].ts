/**
 * Vapi webhook entrypoint.
 *
 * Receives tool-call webhooks from Vapi's realtime voice during onboarding.
 * Channel auth: `X-Vapi-Secret` header (constant-time compared to
 * VAPI_WEBHOOK_SECRET). Identity (`anon_id`) flows via tool arguments — Vapi
 * injects it server-side from `assistantOverrides.variableValues`, so it can't
 * be spoofed by the LLM. See CLAUDE.md "RLS Policies Are NOT Functional" and
 * api/_lib/vapi/verifySecret.ts for the full auth model.
 *
 * Routes:
 *   POST /api/vapi/tool   — Vapi tool-call webhook (this iteration)
 *   POST /api/vapi/event  — call-lifecycle webhook (NOT YET IMPLEMENTED)
 *
 * Response shape Vapi requires:
 *   { results: [{ toolCallId, result: "ok" }] }
 *   { results: [{ toolCallId, error: "validation_failed: ..." }] }
 *
 * Always HTTP 200 for tool-call responses (errors go inside `error` field).
 * HTTP 401 is reserved for channel-auth (secret) failures.
 *
 * Stays under Vercel's 12-function limit — this is the 9th top-level api/ file.
 * Future routes added as new branches in this catch-all, NOT new files.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyVapiSecret } from '../_lib/vapi/verifySecret.js';
import { dispatchVapiToolCall } from '../_lib/vapi/dispatch.js';

interface VapiToolCall {
  id: string;
  // Vapi sends tool calls in OpenAI-style shape: name + arguments nested under
  // `function`. Older / alternate shapes may put them at the top level. Read
  // both, prefer nested.
  name?: string;
  arguments?: Record<string, unknown> | string;
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
}

interface VapiToolCallMessage {
  type: 'tool-calls';
  toolCallList: VapiToolCall[];
  call?: { id?: string; type?: string };
}

interface VapiWebhookBody {
  message?: VapiToolCallMessage;
}

interface ToolCallResultEnvelope {
  toolCallId: string;
  result?: string;
  error?: string;
}

function parseArgs(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // Channel auth comes before routing. Anyone hitting this surface without
  // a valid secret gets 401, no further info leaked.
  const auth = verifyVapiSecret(req);
  if (!auth.ok) {
    console.log(`[vapi/tool] auth_failed reason=${auth.reason}`);
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (route === 'tool' && req.method === 'POST') {
    const body = (req.body ?? {}) as VapiWebhookBody;
    const message = body.message;
    if (!message || message.type !== 'tool-calls' || !Array.isArray(message.toolCallList)) {
      console.log('[vapi/tool] bad_request reason=missing_tool_calls');
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const callId = message.call?.id ?? 'unknown';
    const results: ToolCallResultEnvelope[] = [];

    for (const toolCall of message.toolCallList) {
      const toolCallId = toolCall.id;
      if (!toolCallId || typeof toolCallId !== 'string') {
        // Without an ID we can't ack — log and skip. Vapi will retry or surface.
        console.log('[vapi/tool] skipped reason=missing_tool_call_id');
        continue;
      }

      // Prefer OpenAI-style nested shape (`function.name`, `function.arguments`),
      // fall back to top-level for older payload shapes.
      const name =
        (typeof toolCall.function?.name === 'string' && toolCall.function.name) ||
        (typeof toolCall.name === 'string' && toolCall.name) ||
        '';
      const rawArgs = toolCall.function?.arguments ?? toolCall.arguments;
      const args = parseArgs(rawArgs);
      if (!args) {
        console.log(
          `[vapi/tool] validation_failed reason=args_not_object name=${name} raw=${typeof rawArgs}`,
        );
        results.push({ toolCallId, error: 'invalid_args' });
        continue;
      }

      const anonId = typeof args.anon_id === 'string' ? args.anon_id : 'missing';
      const sessionId = typeof args.session_id === 'string' ? args.session_id : 'missing';
      console.log(
        `[vapi/tool] received name=${name} anon_id=${anonId} session_id=${sessionId} call_id=${callId}`,
      );

      try {
        const outcome = await dispatchVapiToolCall(name, args);
        if ('result' in outcome) {
          results.push({ toolCallId, result: outcome.result });
        } else {
          results.push({ toolCallId, error: outcome.error });
        }
      } catch (err) {
        console.error(`[vapi/tool] handler_error name=${name}`, err);
        results.push({ toolCallId, error: 'handler_error' });
      }
    }

    return res.status(200).json({ results });
  }

  console.log(`[vapi/tool] not_found route=${route} method=${req.method}`);
  return res.status(404).json({ error: 'not_found' });
}
