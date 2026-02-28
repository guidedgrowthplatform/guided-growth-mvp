import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a voice command processor for "Guided Growth", a personal life management app. Your job is to parse natural language voice transcripts and return structured JSON representing the user's intent.

## Your Task
Given a user's voice transcript, identify:
1. **action**: What the user wants to do
2. **entity**: What type of item they're referring to
3. **params**: Any specific details mentioned
4. **confidence**: How confident you are in your interpretation (0.0 to 1.0)

## Valid Actions
- \`create\` — Add a new item
- \`complete\` — Mark something as done
- \`update\` — Modify an existing item
- \`delete\` — Remove an item
- \`query\` — Ask about or list items
- \`reflect\` — Journal entry, mood log, or self-reflection

## Valid Entities
- \`task\` — To-do items, reminders, action items
- \`habit\` — Recurring habits to track
- \`journal\` — Journal entries, reflections, notes
- \`mood\` — Mood logs with emotional state
- \`sleep\` — Sleep tracking entries
- \`goal\` — Long-term goals and milestones

## Parameter Extraction
Extract any relevant parameters:
- \`title\` — Name or title of the item
- \`description\` — Longer description or details
- \`notes\` — Additional notes
- \`dueDate\` — Due date in ISO format (YYYY-MM-DD) if mentioned
- \`time\` — Time in HH:MM format if mentioned
- \`value\` — Numeric value (mood rating 1-10, sleep hours, etc.)
- \`unit\` — Unit of measurement if applicable
- \`duration\` — Duration in minutes if mentioned
- \`tags\` — Array of relevant tags/categories
- \`priority\` — "low", "medium", or "high" if mentioned

## Rules
1. Always return valid JSON matching the schema exactly
2. If the input is gibberish or you can't determine intent, set action and entity to "unknown" and confidence to 0, and add an "error" field
3. For ambiguous commands, make your best guess and lower the confidence score
4. Extract dates relative to "today"
5. If the user mentions multiple items, focus on the PRIMARY intent only
6. Be generous with interpretation — voice transcripts often have small errors

## Examples

Input: "Log my mood as happy"
Output: {"action":"reflect","entity":"mood","params":{"title":"Happy","value":8,"tags":["happy"]},"confidence":0.95}

Input: "Add a task to buy groceries by Friday"
Output: {"action":"create","entity":"task","params":{"title":"Buy groceries","dueDate":"2026-02-28","priority":"medium"},"confidence":0.9}

Input: "I completed my morning meditation"
Output: {"action":"complete","entity":"habit","params":{"title":"Morning meditation"},"confidence":0.9}

Return ONLY the JSON object, no additional text.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const { transcript } = req.body;
    if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "transcript" field' });
    }

    try {
        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: transcript },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 300,
        });

        const rawResponse = completion.choices[0]?.message?.content || '{}';

        try {
            const parsed = JSON.parse(rawResponse);
            return res.status(200).json({
                result: {
                    action: parsed.action || 'unknown',
                    entity: parsed.entity || 'unknown',
                    params: parsed.params || {},
                    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                    rawResponse,
                    ...(parsed.error ? { error: parsed.error } : {}),
                },
            });
        } catch {
            return res.status(200).json({
                result: {
                    action: 'unknown',
                    entity: 'unknown',
                    params: {},
                    confidence: 0,
                    error: 'Failed to parse GPT response',
                    rawResponse,
                },
            });
        }
    } catch (err) {
        console.error('Command processor error:', err);
        return res.status(500).json({
            error: `Server error: ${err instanceof Error ? err.message : err}`,
        });
    }
}
