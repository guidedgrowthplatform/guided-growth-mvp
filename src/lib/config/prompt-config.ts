/**
 * Model configuration for voice command processing.
 * Externalised from voice-command-system.ts per review feedback.
 *
 * Change the model, temperature, or token budget here without
 * touching the system prompt itself.
 */
export const VOICE_COMMAND_MODEL_CONFIG = {
  /** OpenAI model identifier */
  model: 'gpt-4o-mini' as const,

  /** Lower = more deterministic parsing; raise for creative responses */
  temperature: 0.1,

  /** Structured JSON responses are small, 200 tokens is plenty */
  max_tokens: 200,

  /** Guarantees valid JSON output from the model */
  response_format: { type: 'json_object' as const },
};
