/**
 * Pure wrapper: maps a generic OnboardingTool definition to Vapi's tool
 * envelope shape. No I/O — unit-testable.
 *
 * The envelope has three layers worth understanding:
 *   - `function.parameters`: JSON Schema the LLM sees and fills in.
 *   - top-level `parameters` (the `[{key, value}]` array): server-trusted
 *     static params Vapi merges into the LLM args BEFORE posting to the
 *     webhook. The LLM cannot override these — that's where we inject
 *     `anon_id` / `session_id` via Vapi templates.
 *   - top-level `messages`: lifecycle audio Vapi speaks at fixed points
 *     around the webhook round-trip (request-start, request-complete,
 *     request-failed). These bridge silence so the LLM doesn't pad with
 *     generic filler ("just a sec") while the tool runs.
 */

import type { OnboardingTool } from '../../api/_lib/llm/tools.onboarding.js';

type VapiToolMessageType = 'request-start' | 'request-complete' | 'request-failed';

interface VapiToolMessage {
  readonly type: VapiToolMessageType;
  readonly content: string;
}

export interface VapiToolEnvelope {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: OnboardingTool['parameters'];
  };
  readonly parameters: ReadonlyArray<{ readonly key: string; readonly value: string }>;
  readonly messages?: ReadonlyArray<VapiToolMessage>;
  /**
   * Vapi `async` tool flag. When true, Vapi resumes the model the instant the
   * call fires and does NOT wait for the webhook response — the model never sees
   * the result. Set only for pure data-saves (tool.nonBlocking), which take the
   * tool round-trip off the spoken latency. Omitted (blocking) otherwise.
   */
  readonly async?: boolean;
  readonly server: {
    readonly url: string;
    readonly secret: string;
  };
}

function buildMessages(tool: OnboardingTool): VapiToolMessage[] | undefined {
  const m = tool.messages;
  if (!m) return undefined;
  const out: VapiToolMessage[] = [];
  // !== undefined (not truthy): an empty string is an EXPLICIT silence signal.
  // Truthy-stripping it makes Vapi fall back to its default ("Just a sec").
  if (m.requestStart !== undefined) out.push({ type: 'request-start', content: m.requestStart });
  if (m.requestComplete !== undefined)
    out.push({ type: 'request-complete', content: m.requestComplete });
  if (m.requestFailed !== undefined) out.push({ type: 'request-failed', content: m.requestFailed });
  return out.length > 0 ? out : undefined;
}

export function wrapTool(tool: OnboardingTool, baseUrl: string, secret: string): VapiToolEnvelope {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  // Async (non-blocking) tools never wait on the webhook, so there is no silence
  // to bridge and the model's own next line speaks immediately. Emitting a
  // request-start line here would double up with that line and re-introduce the
  // "OK" filler that rule R4 retired, so suppress lifecycle messages for them.
  // Blocking tools keep their messages — voice has no visual loading state, so
  // the line covers the real round-trip wait.
  const messages = tool.nonBlocking ? undefined : buildMessages(tool);
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
    parameters: [
      { key: 'anon_id', value: '{{ anon_id }}' },
      { key: 'session_id', value: '{{ session_id }}' },
    ],
    ...(messages ? { messages } : {}),
    ...(tool.nonBlocking ? { async: true } : {}),
    server: {
      url: `${trimmedBase}/api/vapi/tool`,
      secret,
    },
  };
}
