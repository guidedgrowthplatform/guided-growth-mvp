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
import { waitUntil } from '@vercel/functions';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { verifyVapiSecret } from '../_lib/vapi/verifySecret.js';
import { dispatchVapiToolCall, type DispatchResult } from '../_lib/vapi/dispatch.js';
import { reportToolFailure, flushSentry } from '../_lib/sentry.js';
import { broadcastVapiToolEvent } from '../_lib/vapi/debugChannel.js';

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
    const broadcasts: Promise<void>[] = [];

    // Run the whole tool-call batch in ONE transaction so multiple writes to the
    // same onboarding_states row (e.g. submit_profile + navigate_next) coalesce
    // into a SINGLE Realtime event — eliminating the split-write clobber race on
    // the client (data echo reverting current_step). The dedup ledger
    // (vapi_tool_calls, keyed on toolCall.id) makes each handler idempotent under
    // Vapi's webhook retries. A handler that THROWS is rolled back to its own
    // savepoint so the rest of the batch still commits.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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
          reportToolFailure({ tool: name, errorCode: 'invalid_args' });
          results.push({ toolCallId, error: 'invalid_args' });
          continue;
        }

        const anonId = typeof args.anon_id === 'string' ? args.anon_id : 'missing';
        const sessionId = typeof args.session_id === 'string' ? args.session_id : 'missing';
        console.log(
          `[vapi/tool] received name=${name} anon_id=${anonId} session_id=${sessionId} call_id=${callId}`,
        );

        // Idempotency claim. ON CONFLICT DO NOTHING: a concurrent retry blocks on
        // the uncommitted PK row until this txn commits, then sees the stored
        // result. rowCount 0 → already handled → replay the prior envelope.
        const claim = await client.query(
          `INSERT INTO vapi_tool_calls (tool_call_id, anon_id, tool, result)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (tool_call_id) DO NOTHING
           RETURNING tool_call_id`,
          [toolCallId, typeof args.anon_id === 'string' ? args.anon_id : null, name],
        );
        if ((claim.rowCount ?? 0) === 0) {
          const prior = await client.query<{ result: DispatchResult | null }>(
            `SELECT result FROM vapi_tool_calls WHERE tool_call_id = $1`,
            [toolCallId],
          );
          const stored = prior.rows[0]?.result ?? null;
          console.log(`[vapi/tool] dedup_replay name=${name} tool_call_id=${toolCallId}`);
          results.push(stored ? { toolCallId, ...stored } : { toolCallId, result: 'ok' });
          continue;
        }

        // Run the handler inside a savepoint so a throw rolls back only its own
        // partial writes, not the whole batch.
        let outcome: DispatchResult;
        await client.query('SAVEPOINT tool_sp');
        try {
          outcome = await dispatchVapiToolCall(name, args, client);
          await client.query('RELEASE SAVEPOINT tool_sp');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT tool_sp');
          console.error(`[vapi/tool] handler_error name=${name}`, err);
          reportToolFailure({ tool: name, anonId, errorCode: 'handler_error', args, error: err });
          outcome = { error: 'handler_error' };
        }

        // Record the outcome on the claim row so a later replay returns it.
        await client.query(`UPDATE vapi_tool_calls SET result = $2 WHERE tool_call_id = $1`, [
          toolCallId,
          JSON.stringify(outcome),
        ]);

        if ('result' in outcome) {
          results.push({ toolCallId, result: outcome.result });
          broadcasts.push(broadcastVapiToolEvent({ anonId, callId, tool: name, ok: true, args }));
        } else {
          // Normalize 'unknown_tool: foo' → 'unknown_tool' so fingerprint/tag/sampling stay bounded.
          const code = outcome.error.split(':')[0].trim();
          if (code !== 'handler_error') {
            reportToolFailure({
              tool: name,
              anonId,
              errorCode: code,
              args: { ...args, vapi_error: outcome.error },
            });
          }
          results.push({ toolCallId, error: outcome.error });
          broadcasts.push(
            broadcastVapiToolEvent({
              anonId,
              callId,
              tool: name,
              ok: false,
              errorCode: code,
              args,
            }),
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection already gone */
      }
      console.error('[vapi/tool] transaction_failed', err);
      reportToolFailure({ tool: 'tool_batch', errorCode: 'tool_txn_failed', error: err });
      waitUntil(flushSentry());
      // Nothing committed — let Vapi retry the batch (the dedup claims rolled back).
      return res.status(500).json({ error: 'tool_txn_failed' });
    } finally {
      client.release();
    }

    // Telemetry off the voice critical path — deferred past the response, not awaited.
    waitUntil(Promise.all([...broadcasts, flushSentry()]));
    return res.status(200).json({ results });
  }

  console.log(`[vapi/tool] not_found route=${route} method=${req.method}`);
  return res.status(404).json({ error: 'not_found' });
}
