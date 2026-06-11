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
  const messages = buildMessages(tool);
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
    server: {
      url: `${trimmedBase}/api/vapi/tool`,
      secret,
    },
  };
}
