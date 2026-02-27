import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './systemPrompt';
import type {
    CommandResult,
    ProcessCommandResult,
} from './commandTypes';

/**
 * Process a voice transcript using GPT-4o-mini.
 * Returns a structured intent object with action, entity, params, and confidence.
 */
export async function processCommand(
    transcript: string,
    apiKey?: string
): Promise<ProcessCommandResult> {
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
        return {
            result: {
                action: 'unknown',
                entity: 'unknown',
                params: {},
                confidence: 0,
                error: 'OPENAI_API_KEY not configured',
                rawResponse: '',
            },
            latencyMs: 0,
        };
    }

    const openai = new OpenAI({ apiKey: key });
    const startTime = performance.now();

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: transcript },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1, // Low temperature for consistent structured output
            max_tokens: 300,
        });

        const latencyMs = Math.round(performance.now() - startTime);
        const rawResponse = completion.choices[0]?.message?.content || '{}';

        try {
            const parsed = JSON.parse(rawResponse);

            // Validate required fields
            const result: CommandResult = {
                action: parsed.action || 'unknown',
                entity: parsed.entity || 'unknown',
                params: parsed.params || {},
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                rawResponse,
                ...(parsed.error ? { error: parsed.error } : {}),
            };

            return { result, latencyMs };
        } catch {
            return {
                result: {
                    action: 'unknown',
                    entity: 'unknown',
                    params: {},
                    confidence: 0,
                    error: 'Failed to parse GPT response as JSON',
                    rawResponse,
                },
                latencyMs,
            };
        }
    } catch (err) {
        const latencyMs = Math.round(performance.now() - startTime);
        return {
            result: {
                action: 'unknown',
                entity: 'unknown',
                params: {},
                confidence: 0,
                error: `OpenAI API error: ${err instanceof Error ? err.message : err}`,
                rawResponse: '',
            },
            latencyMs,
        };
    }
}
