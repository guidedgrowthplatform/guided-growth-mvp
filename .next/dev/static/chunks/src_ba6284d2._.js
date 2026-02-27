(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/testTranscripts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 25 sample test transcripts for voice command processor evaluation.
 * Covers all actions, entities, edge cases, and ambiguous inputs.
 */ __turbopack_context__.s([
    "TEST_TRANSCRIPTS",
    ()=>TEST_TRANSCRIPTS
]);
const TEST_TRANSCRIPTS = [
    // ─── CREATE (5) ──────────────────────────────────────────────
    {
        id: 1,
        category: 'create',
        transcript: 'Add a task to buy groceries by Friday',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Simple task creation with due date'
    },
    {
        id: 2,
        category: 'create',
        transcript: 'Create a new habit to drink eight glasses of water daily',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Habit creation with quantity'
    },
    {
        id: 3,
        category: 'create',
        transcript: 'Set a goal to run a marathon by December',
        expectedAction: 'create',
        expectedEntity: 'goal',
        description: 'Goal with deadline'
    },
    {
        id: 4,
        category: 'create',
        transcript: 'Add task call the dentist high priority',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Task with priority level'
    },
    {
        id: 5,
        category: 'create',
        transcript: 'Start tracking my meditation habit',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Implicit habit creation'
    },
    // ─── COMPLETE (3) ────────────────────────────────────────────
    {
        id: 6,
        category: 'complete',
        transcript: 'I finished my morning run',
        expectedAction: 'complete',
        expectedEntity: 'habit',
        description: 'Complete with past tense'
    },
    {
        id: 7,
        category: 'complete',
        transcript: 'Mark exercise as done',
        expectedAction: 'complete',
        expectedEntity: 'habit',
        description: 'Explicit mark as done'
    },
    {
        id: 8,
        category: 'complete',
        transcript: 'Done with the grocery shopping task',
        expectedAction: 'complete',
        expectedEntity: 'task',
        description: 'Task completion'
    },
    // ─── UPDATE (3) ──────────────────────────────────────────────
    {
        id: 9,
        category: 'update',
        transcript: 'Change my water intake goal to ten glasses',
        expectedAction: 'update',
        expectedEntity: 'habit',
        description: 'Update numeric value'
    },
    {
        id: 10,
        category: 'update',
        transcript: 'Move the dentist appointment to next Monday',
        expectedAction: 'update',
        expectedEntity: 'task',
        description: 'Reschedule with date'
    },
    {
        id: 11,
        category: 'update',
        transcript: 'Set my marathon goal deadline to January',
        expectedAction: 'update',
        expectedEntity: 'goal',
        description: 'Update goal deadline'
    },
    // ─── DELETE (2) ──────────────────────────────────────────────
    {
        id: 12,
        category: 'delete',
        transcript: 'Remove the task about cleaning the garage',
        expectedAction: 'delete',
        expectedEntity: 'task',
        description: 'Delete task by name'
    },
    {
        id: 13,
        category: 'delete',
        transcript: 'Stop tracking my caffeine habit',
        expectedAction: 'delete',
        expectedEntity: 'habit',
        description: 'Implicit habit deletion'
    },
    // ─── QUERY (3) ────────────────────────────────────────────────
    {
        id: 14,
        category: 'query',
        transcript: 'What tasks do I have due this week',
        expectedAction: 'query',
        expectedEntity: 'task',
        description: 'Query with time filter'
    },
    {
        id: 15,
        category: 'query',
        transcript: 'How did I sleep last night',
        expectedAction: 'query',
        expectedEntity: 'sleep',
        description: 'Sleep query'
    },
    {
        id: 16,
        category: 'query',
        transcript: 'Show me my habit streaks',
        expectedAction: 'query',
        expectedEntity: 'habit',
        description: 'Query habit data'
    },
    // ─── REFLECT (4) ─────────────────────────────────────────────
    {
        id: 17,
        category: 'reflect',
        transcript: 'Log my mood as happy, I had a great day at work',
        expectedAction: 'reflect',
        expectedEntity: 'mood',
        description: 'Mood log with context'
    },
    {
        id: 18,
        category: 'reflect',
        transcript: 'I slept seven hours last night and feel well rested',
        expectedAction: 'reflect',
        expectedEntity: 'sleep',
        description: 'Sleep log with duration and quality'
    },
    {
        id: 19,
        category: 'reflect',
        transcript: 'Journal entry: Today I learned about mindfulness and practiced deep breathing for ten minutes',
        expectedAction: 'reflect',
        expectedEntity: 'journal',
        description: 'Journal with detailed content'
    },
    {
        id: 20,
        category: 'reflect',
        transcript: 'My energy level is about six out of ten today',
        expectedAction: 'reflect',
        expectedEntity: 'mood',
        description: 'Numeric mood rating'
    },
    // ─── EDGE CASES (5) ──────────────────────────────────────────
    {
        id: 21,
        category: 'edge-case',
        transcript: 'asdfghjkl random noise blah',
        expectedAction: 'unknown',
        expectedEntity: 'unknown',
        description: 'Gibberish input'
    },
    {
        id: 22,
        category: 'edge-case',
        transcript: 'Maybe I should start running but I also want to read more books',
        expectedAction: 'create',
        expectedEntity: 'goal',
        description: 'Ambiguous multi-intent'
    },
    {
        id: 23,
        category: 'edge-case',
        transcript: 'Hello',
        expectedAction: 'unknown',
        expectedEntity: 'unknown',
        description: 'Greeting, no actionable intent'
    },
    {
        id: 24,
        category: 'edge-case',
        transcript: 'I want to create a task and also log my mood and track my sleep and set a new goal',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Multi-step request (should focus on primary)'
    },
    {
        id: 25,
        category: 'edge-case',
        transcript: 'Ummm so like I kinda wanna maybe possibly start working out or something I guess',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Hesitant/uncertain natural speech'
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/command-test/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CommandTestPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/testTranscripts.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function CommandTestPage() {
    _s();
    const [results, setResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isProcessing, setIsProcessing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [activeId, setActiveId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [customInput, setCustomInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [customResult, setCustomResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isCustomProcessing, setIsCustomProcessing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [batchProgress, setBatchProgress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Process single transcript
    const processOne = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "CommandTestPage.useCallback[processOne]": async (item)=>{
            setActiveId(item.id);
            setIsProcessing(true);
            try {
                const res = await fetch('/api/process-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        transcript: item.transcript
                    })
                });
                const data = await res.json();
                const testResult = {
                    transcriptId: item.id,
                    transcript: item.transcript,
                    expectedAction: item.expectedAction,
                    expectedEntity: item.expectedEntity,
                    result: data,
                    actionMatch: data.result.action === item.expectedAction,
                    entityMatch: data.result.entity === item.expectedEntity
                };
                setResults({
                    "CommandTestPage.useCallback[processOne]": (prev)=>{
                        const filtered = prev.filter({
                            "CommandTestPage.useCallback[processOne].filtered": (r)=>r.transcriptId !== item.id
                        }["CommandTestPage.useCallback[processOne].filtered"]);
                        return [
                            ...filtered,
                            testResult
                        ];
                    }
                }["CommandTestPage.useCallback[processOne]"]);
            } catch (err) {
                console.error('Process error:', err);
            }
            setIsProcessing(false);
            setActiveId(null);
        }
    }["CommandTestPage.useCallback[processOne]"], []);
    // Run all tests
    const runAll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "CommandTestPage.useCallback[runAll]": async ()=>{
            setIsProcessing(true);
            setBatchProgress({
                current: 0,
                total: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_TRANSCRIPTS"].length
            });
            for(let i = 0; i < __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_TRANSCRIPTS"].length; i++){
                const item = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_TRANSCRIPTS"][i];
                setActiveId(item.id);
                setBatchProgress({
                    current: i + 1,
                    total: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_TRANSCRIPTS"].length
                });
                try {
                    const res = await fetch('/api/process-command', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            transcript: item.transcript
                        })
                    });
                    const data = await res.json();
                    setResults({
                        "CommandTestPage.useCallback[runAll]": (prev)=>{
                            const filtered = prev.filter({
                                "CommandTestPage.useCallback[runAll].filtered": (r)=>r.transcriptId !== item.id
                            }["CommandTestPage.useCallback[runAll].filtered"]);
                            return [
                                ...filtered,
                                {
                                    transcriptId: item.id,
                                    transcript: item.transcript,
                                    expectedAction: item.expectedAction,
                                    expectedEntity: item.expectedEntity,
                                    result: data,
                                    actionMatch: data.result.action === item.expectedAction,
                                    entityMatch: data.result.entity === item.expectedEntity
                                }
                            ];
                        }
                    }["CommandTestPage.useCallback[runAll]"]);
                } catch (err) {
                    console.error(`Test #${item.id} error:`, err);
                }
            }
            setIsProcessing(false);
            setActiveId(null);
            setBatchProgress(null);
        }
    }["CommandTestPage.useCallback[runAll]"], []);
    // Process custom input
    const processCustom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "CommandTestPage.useCallback[processCustom]": async ()=>{
            if (!customInput.trim()) return;
            setIsCustomProcessing(true);
            try {
                const res = await fetch('/api/process-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        transcript: customInput
                    })
                });
                const data = await res.json();
                setCustomResult(data);
            } catch (err) {
                console.error('Custom process error:', err);
            }
            setIsCustomProcessing(false);
        }
    }["CommandTestPage.useCallback[processCustom]"], [
        customInput
    ]);
    // Export results
    const exportResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "CommandTestPage.useCallback[exportResults]": ()=>{
            const blob = new Blob([
                JSON.stringify(results, null, 2)
            ], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'command-processor-results.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    }["CommandTestPage.useCallback[exportResults]"], [
        results
    ]);
    // Stats
    const totalTests = results.length;
    const actionMatches = results.filter((r)=>r.actionMatch).length;
    const entityMatches = results.filter((r)=>r.entityMatch).length;
    const avgLatency = totalTests > 0 ? Math.round(results.reduce((sum, r)=>sum + r.result.latencyMs, 0) / totalTests) : 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-6xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-3xl font-bold text-white",
                            children: "Voice Command Processor"
                        }, void 0, false, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 148,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-2 text-slate-400",
                            children: "GPT-4o-mini intent extraction — test with 25 sample transcripts"
                        }, void 0, false, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 149,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/command-test/page.tsx",
                    lineNumber: 147,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8 rounded-xl bg-white/5 border border-white/10 p-5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-sm font-medium text-white/70 uppercase tracking-wider mb-3",
                            children: "Try Your Own"
                        }, void 0, false, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 156,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: customInput,
                                    onChange: (e)=>setCustomInput(e.target.value),
                                    onKeyDown: (e)=>e.key === 'Enter' && processCustom(),
                                    placeholder: "Type a voice command, e.g. 'Add a task to buy groceries'",
                                    className: "flex-1 rounded-lg bg-black/30 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 160,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: processCustom,
                                    disabled: isCustomProcessing || !customInput.trim(),
                                    className: "rounded-lg bg-indigo-600 px-5 py-2.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer",
                                    children: isCustomProcessing ? '⏳ Processing...' : '🚀 Process'
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 168,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 159,
                            columnNumber: 21
                        }, this),
                        customResult && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 rounded-lg bg-black/30 p-4 font-mono text-xs text-white/80 overflow-x-auto",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                children: JSON.stringify(customResult, null, 2)
                            }, void 0, false, {
                                fileName: "[project]/src/app/command-test/page.tsx",
                                lineNumber: 178,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 177,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/command-test/page.tsx",
                    lineNumber: 155,
                    columnNumber: 17
                }, this),
                totalTests > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mb-8 grid gap-4 sm:grid-cols-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl bg-white/5 p-4 border border-white/10",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-2xl font-bold text-white",
                                    children: [
                                        totalTests,
                                        "/25"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 187,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-slate-400",
                                    children: "Tested"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 188,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 186,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl bg-white/5 p-4 border border-white/10",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-2xl font-bold text-emerald-400",
                                    children: [
                                        Math.round(actionMatches / totalTests * 100),
                                        "%"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 191,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-slate-400",
                                    children: "Action Accuracy"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 194,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 190,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl bg-white/5 p-4 border border-white/10",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-2xl font-bold text-blue-400",
                                    children: [
                                        Math.round(entityMatches / totalTests * 100),
                                        "%"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 197,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-slate-400",
                                    children: "Entity Accuracy"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 200,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 196,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rounded-xl bg-white/5 p-4 border border-white/10",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-2xl font-bold text-amber-400",
                                    children: [
                                        avgLatency,
                                        "ms"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 203,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-slate-400",
                                    children: "Avg Latency"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 204,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 202,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/command-test/page.tsx",
                    lineNumber: 185,
                    columnNumber: 21
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between mb-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-lg font-semibold text-white",
                            children: "Test Transcripts"
                        }, void 0, false, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 211,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: runAll,
                                    disabled: isProcessing,
                                    className: "rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer",
                                    children: batchProgress ? `⏳ ${batchProgress.current}/${batchProgress.total}` : '▶️ Run All'
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 213,
                                    columnNumber: 25
                                }, this),
                                results.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: exportResults,
                                    className: "rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors cursor-pointer",
                                    children: "📦 Export JSON"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 223,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 212,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/command-test/page.tsx",
                    lineNumber: 210,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$testTranscripts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TEST_TRANSCRIPTS"].map((item)=>{
                        const testResult = results.find((r)=>r.transcriptId === item.id);
                        const isActive = activeId === item.id;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `rounded-xl border p-4 transition-all ${isActive ? 'border-indigo-500/50 bg-indigo-500/10' : testResult ? testResult.actionMatch && testResult.entityMatch ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start justify-between gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-2 mb-1",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.category === 'edge-case' ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'}`,
                                                            children: item.category
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/command-test/page.tsx",
                                                            lineNumber: 255,
                                                            columnNumber: 45
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-xs text-slate-500",
                                                            children: [
                                                                "#",
                                                                item.id
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/command-test/page.tsx",
                                                            lineNumber: 263,
                                                            columnNumber: 45
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[10px] text-slate-600",
                                                            children: [
                                                                "expects: ",
                                                                item.expectedAction,
                                                                "/",
                                                                item.expectedEntity
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/command-test/page.tsx",
                                                            lineNumber: 264,
                                                            columnNumber: 45
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 254,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-white font-medium",
                                                    children: [
                                                        "“",
                                                        item.transcript,
                                                        "”"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 268,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-slate-500 mt-0.5",
                                                    children: item.description
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 269,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/command-test/page.tsx",
                                            lineNumber: 253,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>processOne(item),
                                            disabled: isProcessing,
                                            className: "rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0",
                                            children: isActive ? '⏳ Processing...' : '🚀 Test'
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/command-test/page.tsx",
                                            lineNumber: 271,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 252,
                                    columnNumber: 33
                                }, this),
                                testResult && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 rounded-lg bg-black/20 p-3 text-xs",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-4 mb-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: testResult.actionMatch ? 'text-emerald-400' : 'text-red-400',
                                                    children: [
                                                        "Action: ",
                                                        testResult.result.result.action,
                                                        testResult.actionMatch ? ' ✓' : ` ✗ (expected: ${testResult.expectedAction})`
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 284,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: testResult.entityMatch ? 'text-emerald-400' : 'text-red-400',
                                                    children: [
                                                        "Entity: ",
                                                        testResult.result.result.entity,
                                                        testResult.entityMatch ? ' ✓' : ` ✗ (expected: ${testResult.expectedEntity})`
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 288,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-slate-400",
                                                    children: [
                                                        "Confidence: ",
                                                        (testResult.result.result.confidence * 100).toFixed(0),
                                                        "%"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 292,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-slate-500 ml-auto",
                                                    children: [
                                                        testResult.result.latencyMs,
                                                        "ms"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/command-test/page.tsx",
                                                    lineNumber: 295,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/command-test/page.tsx",
                                            lineNumber: 283,
                                            columnNumber: 41
                                        }, this),
                                        Object.keys(testResult.result.result.params).length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-white/60 font-mono",
                                            children: [
                                                "Params: ",
                                                JSON.stringify(testResult.result.result.params)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/command-test/page.tsx",
                                            lineNumber: 300,
                                            columnNumber: 45
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/command-test/page.tsx",
                                    lineNumber: 282,
                                    columnNumber: 37
                                }, this)
                            ]
                        }, item.id, true, {
                            fileName: "[project]/src/app/command-test/page.tsx",
                            lineNumber: 240,
                            columnNumber: 29
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/src/app/command-test/page.tsx",
                    lineNumber: 234,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/command-test/page.tsx",
            lineNumber: 145,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command-test/page.tsx",
        lineNumber: 144,
        columnNumber: 9
    }, this);
}
_s(CommandTestPage, "pXqKgZJzs+b9gAfIFp5VzR+sHOg=");
_c = CommandTestPage;
var _c;
__turbopack_context__.k.register(_c, "CommandTestPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_ba6284d2._.js.map