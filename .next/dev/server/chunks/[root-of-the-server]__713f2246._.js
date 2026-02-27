module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/systemPrompt.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * System prompt for GPT-4o-mini voice command processor.
 * Instructs the model to extract structured intents from voice transcripts.
 */ __turbopack_context__.s([
    "SYSTEM_PROMPT",
    ()=>SYSTEM_PROMPT
]);
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
2. If the input is gibberish, nonsensical, or you can't determine intent, set action and entity to "unknown" and confidence to 0, and add an "error" field explaining why
3. For ambiguous commands, make your best guess and lower the confidence score
4. Extract dates relative to "today" — if the user says "tomorrow", calculate the actual date
5. If the user mentions multiple items, focus on the PRIMARY intent only
6. Be generous with interpretation — voice transcripts often have small errors

## Examples

Input: "Log my mood as happy"
Output: {"action":"reflect","entity":"mood","params":{"title":"Happy","value":8,"tags":["happy"]},"confidence":0.95}

Input: "Add a task to buy groceries by Friday"
Output: {"action":"create","entity":"task","params":{"title":"Buy groceries","dueDate":"2026-02-28","priority":"medium"},"confidence":0.9}

Input: "I completed my morning meditation"  
Output: {"action":"complete","entity":"habit","params":{"title":"Morning meditation"},"confidence":0.9}

Input: "How did I sleep last week"
Output: {"action":"query","entity":"sleep","params":{"notes":"Last week overview"},"confidence":0.85}

Input: "asdfghjkl random noise"
Output: {"action":"unknown","entity":"unknown","params":{},"confidence":0,"error":"Could not determine intent from transcript"}

Return ONLY the JSON object, no additional text.`;
}),
"[project]/src/lib/processCommand.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "processCommand",
    ()=>processCommand
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/client.mjs [app-route] (ecmascript) <export OpenAI as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$systemPrompt$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/systemPrompt.ts [app-route] (ecmascript)");
;
;
async function processCommand(transcript, apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
        return {
            result: {
                action: 'unknown',
                entity: 'unknown',
                params: {},
                confidence: 0,
                error: 'OPENAI_API_KEY not configured',
                rawResponse: ''
            },
            latencyMs: 0
        };
    }
    const openai = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__["default"]({
        apiKey: key
    });
    const startTime = performance.now();
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$systemPrompt$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SYSTEM_PROMPT"]
                },
                {
                    role: 'user',
                    content: transcript
                }
            ],
            response_format: {
                type: 'json_object'
            },
            temperature: 0.1,
            max_tokens: 300
        });
        const latencyMs = Math.round(performance.now() - startTime);
        const rawResponse = completion.choices[0]?.message?.content || '{}';
        try {
            const parsed = JSON.parse(rawResponse);
            // Validate required fields
            const result = {
                action: parsed.action || 'unknown',
                entity: parsed.entity || 'unknown',
                params: parsed.params || {},
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                rawResponse,
                ...parsed.error ? {
                    error: parsed.error
                } : {}
            };
            return {
                result,
                latencyMs
            };
        } catch  {
            return {
                result: {
                    action: 'unknown',
                    entity: 'unknown',
                    params: {},
                    confidence: 0,
                    error: 'Failed to parse GPT response as JSON',
                    rawResponse
                },
                latencyMs
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
                rawResponse: ''
            },
            latencyMs
        };
    }
}
}),
"[project]/src/app/api/process-command/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$processCommand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/processCommand.ts [app-route] (ecmascript)");
;
;
async function POST(request) {
    try {
        const body = await request.json();
        const { transcript } = body;
        if (!transcript || typeof transcript !== 'string') {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing or invalid "transcript" field'
            }, {
                status: 400
            });
        }
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$processCommand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["processCommand"])(transcript);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
    } catch (err) {
        console.error('Command processor error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `Server error: ${err instanceof Error ? err.message : err}`
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__713f2246._.js.map