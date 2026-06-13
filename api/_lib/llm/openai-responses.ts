import OpenAI from 'openai';
import { getOpenAIKey, OpenAIError, parseRetryAfterMs } from './openai.js';

export type ResponseInputItem =
  | { type: 'message'; role: 'user' | 'assistant'; content: string }
  | { type: 'function_call_output'; call_id: string; output: string };

export type ResponsesStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; callId: string; name: string; argumentsRaw: string }
  | { type: 'completed'; responseId: string | null; totalTokens: number }
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
    cachedClient = new OpenAI({ apiKey: getOpenAIKey() });
  }
  return cachedClient;
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
    const retryAfterMs = err.status === 429 ? parseRetryAfterMs(err.message) : undefined;
    throw new OpenAIError(err.message || 'openai api error', err.status ?? 502, retryAfterMs);
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
  const body: Record<string, unknown> = {
    model: opts.model ?? 'gpt-4o-mini',
    instructions: opts.instructions,
    input: opts.input,
    stream: true,
    store: opts.store ?? true,
    temperature: opts.temperature ?? 0.6,
    max_output_tokens: opts.maxOutputTokens ?? 600,
  };
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
  const body: Record<string, unknown> = {
    model: opts.model ?? 'gpt-4o-mini',
    instructions: opts.instructions,
    input: opts.input,
    stream: false,
    store: false,
    temperature: opts.temperature ?? 0.2,
    max_output_tokens: opts.maxOutputTokens ?? 800,
    tools: toResponsesTools([opts.tool]),
    tool_choice: { type: 'function', name: opts.tool.name },
  };

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
        case 'response.failed':
        case 'error': {
          const e = evt as { error?: { code?: unknown; message?: unknown } };
          const code = typeof e.error?.code === 'string' ? e.error.code : 'openai_error';
          const message = typeof e.error?.message === 'string' ? e.error.message : 'Unknown error';
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
