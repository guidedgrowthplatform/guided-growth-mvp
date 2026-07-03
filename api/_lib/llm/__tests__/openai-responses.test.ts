import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class {
    responses = { create: createMock };
  },
}));

const { openResponsesStream } = await import('../openai-responses.js');

async function* emptyStream() {
  yield { type: 'response.completed', response: { id: 'resp_1', usage: { total_tokens: 1 } } };
}

const TOOL = {
  name: 'submit_path_choice',
  description: 'pick a path',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

describe('openResponsesStream toolChoice + model passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    createMock.mockReturnValue(emptyStream());
  });

  it('forwards an explicit model and tool_choice to the API body', async () => {
    await openResponsesStream({
      model: 'gpt-4o',
      instructions: 'x',
      input: [{ type: 'message', role: 'user', content: 'hi' }],
      tools: [TOOL],
      toolChoice: 'required',
    });
    const body = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body.model).toBe('gpt-4o');
    expect(body.tool_choice).toBe('required');
  });

  it('defaults tool_choice to auto and model to gpt-4o-mini', async () => {
    await openResponsesStream({
      instructions: 'x',
      input: [{ type: 'message', role: 'user', content: 'hi' }],
      tools: [TOOL],
    });
    const body = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.tool_choice).toBe('auto');
  });

  it('forwards maxOutputTokens to the API body', async () => {
    await openResponsesStream({
      instructions: 'x',
      input: [{ type: 'message', role: 'user', content: 'hi' }],
      maxOutputTokens: 1000,
    });
    const body = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(body.max_output_tokens).toBe(1000);
  });
});

async function collect(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of stream) out.push(e);
  return out;
}

describe('iterateEvents terminal-event handling (B11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  const openWith = (raw: AsyncIterable<unknown>) => {
    createMock.mockReturnValue(raw);
    return openResponsesStream({
      instructions: 'x',
      input: [{ type: 'message', role: 'user', content: 'hi' }],
    });
  };

  it('surfaces response.incomplete as a retryable incomplete event (not a silent finish)', async () => {
    async function* raw() {
      yield { type: 'response.output_text.delta', delta: 'partial ' };
      yield {
        type: 'response.incomplete',
        response: {
          id: 'resp_trunc',
          usage: { total_tokens: 700 },
          incomplete_details: { reason: 'max_output_tokens' },
        },
      };
    }
    const events = await collect(await openWith(raw()));
    expect(events).toEqual([
      { type: 'delta', content: 'partial ' },
      {
        type: 'incomplete',
        reason: 'max_output_tokens',
        responseId: 'resp_trunc',
        totalTokens: 700,
      },
    ]);
  });

  it('reads response.failed error details from response.error (not evt.error)', async () => {
    async function* raw() {
      yield {
        type: 'response.failed',
        response: { error: { code: 'server_error', message: 'model crashed' } },
      };
    }
    const events = await collect(await openWith(raw()));
    expect(events).toEqual([{ type: 'error', code: 'server_error', message: 'model crashed' }]);
  });

  it('reads a raw error event from top-level code/message', async () => {
    async function* raw() {
      yield { type: 'error', code: 'rate_limit_exceeded', message: 'slow down', param: null };
    }
    const events = await collect(await openWith(raw()));
    expect(events).toEqual([
      { type: 'error', code: 'rate_limit_exceeded', message: 'slow down' },
    ]);
  });

  it('falls back to openai_error when a failed response carries no detail', async () => {
    async function* raw() {
      yield { type: 'response.failed', response: {} };
    }
    const events = await collect(await openWith(raw()));
    expect(events).toEqual([{ type: 'error', code: 'openai_error', message: 'Unknown error' }]);
  });
});
