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

// Reversible provider flag. Default 'openai' means zero behavior change until
// LLM_PROVIDER=azure is set — flip point is a single env var, no redeploy of
// call-site code needed since it's read at request time via process.env.
export type LLMProvider = 'openai' | 'azure';

export function getLLMProvider(): LLMProvider {
  return process.env.LLM_PROVIDER === 'azure' ? 'azure' : 'openai';
}

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  // Deployment names, keyed by the same two logical tiers the app already
  // uses ('gpt-4o' for onboarding, 'gpt-4o-mini' for everything else) — see
  // resolveAzureDeployment() in openai-responses.ts.
  onboardingDeployment: string;
  defaultDeployment: string;
}

export function getAzureConfig(): AzureConfig {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  if (!endpoint || !apiKey) {
    throw new OpenAIError('AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_KEY not configured', 500);
  }
  const onboardingDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_ONBOARDING;
  const defaultDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_DEFAULT;
  if (!onboardingDeployment || !defaultDeployment) {
    throw new OpenAIError(
      'AZURE_OPENAI_DEPLOYMENT_ONBOARDING/AZURE_OPENAI_DEPLOYMENT_DEFAULT not configured',
      500,
    );
  }
  return {
    endpoint,
    apiKey,
    // 'preview' is the unified v1 surface (POST {endpoint}/openai/v1/responses
    // ?api-version=preview) — validated live against the Responses API,
    // streaming, function-calling, and previous_response_id chaining. The
    // classic /openai/deployments/{d}/responses path 404s; api-version
    // 2025-01-01-preview 400s on this API. Do not change without re-validating.
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? 'preview',
    onboardingDeployment,
    defaultDeployment,
  };
}
