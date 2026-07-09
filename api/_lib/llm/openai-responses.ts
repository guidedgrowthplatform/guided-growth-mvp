import OpenAI, { AzureOpenAI } from 'openai';
import { getOpenAIKey, getAzureConfig, getLLMProvider, OpenAIError } from './openai.js';

export type ResponseInputItem =
  | { type: 'message'; role: 'user' | 'assistant'; content: string }
  | { type: 'function_call_output'; call_id: string; output: string };

export type ResponsesStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; callId: string; name: string; argumentsRaw: string }
  | { type: 'completed'; responseId: string | null; totalTokens: number }
  // Terminal 'response.incomplete' (e.g. max_output_tokens hit mid-turn). The
  // turn is unusable as a normal finish — callers must surface a retryable
  // failure, never a silent empty turn (B11).
  | { type: 'incomplete'; reason: string; responseId: string | null; totalTokens: number }
  | { type: 'error'; code: string; message: string };

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
}

export interface OpenResponsesStreamOpts {
  model?: string;
  instructions: string;
  input: ResponseInputItem[];
  tools?: readonly ToolSchema[];
  previousResponseId?: string;
  store?: boolean;
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
  toolChoice?: 'auto' | 'required' | { type: 'function'; name: string };
}

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (!cachedClient) {
    if (getLLMProvider() === 'azure') {
      const cfg = getAzureConfig();
      // IMPORTANT, two live-validated gotchas:
      // 1. Do NOT pass `deployment` — the SDK rewrites the base URL to
      //    /openai/deployments/{deployment}/... for a fixed list of legacy
      //    endpoints, which 404s for Responses. Deployment is selected
      //    per-request via `model` in the body instead (see resolveModel).
      // 2. The SDK's default AzureOpenAI `endpoint` option builds baseURL as
      //    `{endpoint}/openai`, which hits `{endpoint}/openai/responses` —
      //    confirmed 404 even with apiVersion 'preview'. The Responses API
      //    only lives on the unified v1 surface, `{endpoint}/openai/v1/...`.
      //    Pass `baseURL` directly (not `endpoint`) to land on that path.
      cachedClient = new AzureOpenAI({
        baseURL: `${cfg.endpoint.replace(/\/$/, '')}/openai/v1`,
        apiKey: cfg.apiKey,
        apiVersion: cfg.apiVersion,
      });
    } else {
      cachedClient = new OpenAI({ apiKey: getOpenAIKey() });
    }
  }
  return cachedClient;
}

// Model selection ([...path].ts) is untouched by this flag — it still picks
// the logical model name ('gpt-4o' for onboarding, 'gpt-4o-mini' default).
// Under Azure, that logical name is remapped here to the actual deployment
// name, so the flag composes cleanly with any future model-tier policy
// change upstream (it never sees a deployment name, only 'gpt-4o'/'gpt-4o-mini').
function resolveModel(logicalModel: string): string {
  if (getLLMProvider() !== 'azure') return logicalModel;
  const cfg = getAzureConfig();
  if (logicalModel === 'gpt-4o') return cfg.onboardingDeployment;
  return cfg.defaultDeployment;
}

// Reasoning-tier model families (gpt-5*, o1*, o3*) reject `temperature` as an
// unsupported parameter. Only the classic chat-tier gpt-4o family accepts it.
// Matched by prefix against the deployment name since Azure deployment names
// are opaque strings, not the model catalog name.
const NO_TEMPERATURE_PREFIXES = ['gpt-5', 'o1', 'o3', 'o4'];
function modelRejectsTemperature(resolvedModel: string): boolean {
  return NO_TEMPERATURE_PREFIXES.some((p) => resolvedModel.startsWith(p));
}

// SDK APIError isn't an OpenAIError, so callers collapse it to a generic 500
// with no upstream signal. Log status/body and remap, preserving aborts.
function rethrowUpstream(err: unknown, context: string): never {
  if (
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === 'AbortError')
  ) {
    throw err;
  }
  if (err instanceof OpenAI.APIError) {
    console.error('[openai-responses] upstream error', {
      context,
      status: err.status,
      code: err.code,
      body: typeof err.message === 'string' ? err.message.slice(0, 500) : undefined,
    });
    throw new OpenAIError(err.message || 'openai api error', err.status ?? 502);
  }
  throw err;
}

function toResponsesTools(tools: readonly ToolSchema[]): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: unknown;
  strict: boolean;
}> {
  return tools.map((t) => ({
    type: 'function',
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: false,
  }));
}

export async function openResponsesStream(
  opts: OpenResponsesStreamOpts,
): Promise<AsyncIterable<ResponsesStreamEvent>> {
  const model = resolveModel(opts.model ?? 'gpt-4o-mini');
  const body: Record<string, unknown> = {
    model,
    instructions: opts.instructions,
    input: opts.input,
    stream: true,
    store: opts.store ?? true,
    max_output_tokens: opts.maxOutputTokens ?? 600,
  };
  if (!modelRejectsTemperature(model)) {
    body.temperature = opts.temperature ?? 0.6;
  }
  if (opts.previousResponseId) {
    body.previous_response_id = opts.previousResponseId;
  }
  if (opts.tools && opts.tools.length > 0) {
    body.tools = toResponsesTools(opts.tools);
    body.tool_choice = opts.toolChoice ?? 'auto';
  }

  let stream: AsyncIterable<unknown>;
  try {
    stream = (await client().responses.create(body as unknown as Parameters<typeof client>[0], {
      signal: opts.signal,
    })) as unknown as AsyncIterable<unknown>;
  } catch (err) {
    rethrowUpstream(err, 'stream');
  }

  return iterateEvents(stream);
}

export interface OpenResponsesJSONOpts {
  model?: string;
  instructions: string;
  input: ResponseInputItem[];
  tool: ToolSchema;
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
}

// Non-streaming single structured call. Forces one function tool and returns its parsed args.
export async function openResponsesJSON<T>(
  opts: OpenResponsesJSONOpts,
): Promise<{ data: T; totalTokens: number; responseId: string | null }> {
  const model = resolveModel(opts.model ?? 'gpt-4o-mini');
  const body: Record<string, unknown> = {
    model,
    instructions: opts.instructions,
    input: opts.input,
    stream: false,
    store: false,
    max_output_tokens: opts.maxOutputTokens ?? 800,
    tools: toResponsesTools([opts.tool]),
    tool_choice: { type: 'function', name: opts.tool.name },
  };
  if (!modelRejectsTemperature(model)) {
    body.temperature = opts.temperature ?? 0.2;
  }

  let response: {
    id?: unknown;
    usage?: { total_tokens?: unknown };
    output?: Array<{ type?: unknown; name?: unknown; arguments?: unknown }>;
  };
  try {
    response = (await client().responses.create(body as unknown as Parameters<typeof client>[0], {
      signal: opts.signal,
    })) as unknown as typeof response;
  } catch (err) {
    rethrowUpstream(err, 'json');
  }

  const call = response.output?.find(
    (item) => item?.type === 'function_call' && item?.name === opts.tool.name,
  );
  if (!call || typeof call.arguments !== 'string') {
    throw new OpenAIError('structured response missing function call', 502);
  }

  let data: T;
  try {
    data = JSON.parse(call.arguments) as T;
  } catch {
    throw new OpenAIError('structured response arguments not valid JSON', 502);
  }

  const totalTokens =
    typeof response.usage?.total_tokens === 'number' ? response.usage.total_tokens : 0;
  const responseId = typeof response.id === 'string' ? response.id : null;
  return { data, totalTokens, responseId };
}

async function* iterateEvents(raw: AsyncIterable<unknown>): AsyncGenerator<ResponsesStreamEvent> {
  try {
    for await (const evt of raw) {
      if (!evt || typeof evt !== 'object' || !('type' in evt)) continue;
      const type = (evt as { type: string }).type;
      switch (type) {
        case 'response.output_text.delta': {
          const e = evt as { delta?: unknown };
          if (typeof e.delta === 'string' && e.delta.length > 0) {
            yield { type: 'delta', content: e.delta };
          }
          break;
        }
        case 'response.output_item.done': {
          const e = evt as {
            item?: {
              type?: unknown;
              call_id?: unknown;
              name?: unknown;
              arguments?: unknown;
            };
          };
          const item = e.item;
          if (
            item &&
            item.type === 'function_call' &&
            typeof item.call_id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.arguments === 'string'
          ) {
            yield {
              type: 'tool_call',
              callId: item.call_id,
              name: item.name,
              argumentsRaw: item.arguments,
            };
          }
          break;
        }
        case 'response.completed': {
          const e = evt as {
            response?: { id?: unknown; usage?: { total_tokens?: unknown } };
          };
          const responseId = typeof e.response?.id === 'string' ? e.response.id : null;
          const totalTokens =
            typeof e.response?.usage?.total_tokens === 'number' ? e.response.usage.total_tokens : 0;
          yield { type: 'completed', responseId, totalTokens };
          return;
        }
        // Terminal truncation (max_output_tokens / content_filter). Previously
        // unhandled: the loop ended silently and callers treated the turn as a
        // clean finish with no responseId and (often) no content — the B11
        // "empty response" class. Surface it so the route can fail retryably.
        case 'response.incomplete': {
          const e = evt as {
            response?: {
              id?: unknown;
              usage?: { total_tokens?: unknown };
              incomplete_details?: { reason?: unknown };
            };
          };
          const reason =
            typeof e.response?.incomplete_details?.reason === 'string'
              ? e.response.incomplete_details.reason
              : 'unknown';
          const responseId = typeof e.response?.id === 'string' ? e.response.id : null;
          const totalTokens =
            typeof e.response?.usage?.total_tokens === 'number' ? e.response.usage.total_tokens : 0;
          yield { type: 'incomplete', reason, responseId, totalTokens };
          return;
        }
        // 'response.failed' carries the error under response.error; a raw
        // 'error' event carries code/message at the TOP level. The old shared
        // reader used evt.error for both, so every upstream failure collapsed
        // to "openai_error: Unknown error" (B11 — provider errors swallowed).
        case 'response.failed': {
          const e = evt as { response?: { error?: { code?: unknown; message?: unknown } } };
          const err = e.response?.error;
          const code = typeof err?.code === 'string' ? err.code : 'openai_error';
          const message = typeof err?.message === 'string' ? err.message : 'Unknown error';
          yield { type: 'error', code, message };
          return;
        }
        case 'error': {
          const e = evt as { code?: unknown; message?: unknown };
          const code = typeof e.code === 'string' ? e.code : 'openai_error';
          const message = typeof e.message === 'string' ? e.message : 'Unknown error';
          yield { type: 'error', code, message };
          return;
        }
        default:
          break;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    if (err instanceof OpenAIError) throw err;
    throw err;
  }
}
