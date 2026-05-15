import type { TOOL_DEFINITIONS } from './tools.js';

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

export interface OpenAIStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant' | 'tool';
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface StreamChatCompletionOpts {
  messages: ChatCompletionMessage[];
  tools?: typeof TOOL_DEFINITIONS;
  signal?: AbortSignal;
  temperature?: number;
  max_tokens?: number;
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'OpenAIError';
  }
}

function toOpenAITools(
  tools: typeof TOOL_DEFINITIONS,
): Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }> {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError('OPENAI_API_KEY not configured', 500);
  return apiKey;
}

// Fetch eagerly so 429/5xx surface before SSE opens (caller can retry).
export async function openChatCompletionStream(
  opts: StreamChatCompletionOpts,
): Promise<AsyncIterable<OpenAIStreamChunk>> {
  const apiKey = getOpenAIKey();

  const timeoutSignal = AbortSignal.timeout(60_000);
  const signal =
    opts.signal && typeof (AbortSignal as unknown as { any?: unknown }).any === 'function'
      ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([
          opts.signal,
          timeoutSignal,
        ])
      : opts.signal ?? timeoutSignal;

  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    stream: true,
    // Required for usage on streamed responses.
    stream_options: { include_usage: true },
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.max_tokens ?? 600,
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = toOpenAITools(opts.tools);
    body.tool_choice = 'auto';
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new OpenAIError(`OpenAI API error ${response.status}: ${text}`, response.status);
  }
  if (!response.body) {
    throw new OpenAIError('OpenAI response has no body', 502);
  }

  return iterateChunks(response.body.getReader());
}

async function* iterateChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<OpenAIStreamChunk> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        const line = rawLine.replace(/\r$/, '');
        if (line === '') continue;
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trimStart();
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data) as OpenAIStreamChunk;
        } catch {
          // skip malformed
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
      const data = tail.slice(5).trimStart();
      if (data && data !== '[DONE]') {
        try {
          yield JSON.parse(data) as OpenAIStreamChunk;
        } catch {
          // skip
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
