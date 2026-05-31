export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'OpenAIError';
  }
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError('OPENAI_API_KEY not configured', 500);
  return apiKey;
}
