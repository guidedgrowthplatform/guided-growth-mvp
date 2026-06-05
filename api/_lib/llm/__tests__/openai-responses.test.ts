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
});
