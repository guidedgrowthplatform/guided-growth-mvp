'use client';

import { useState, useCallback } from 'react';
import { TEST_TRANSCRIPTS, TestTranscript } from '@/lib/testTranscripts';
import type { ProcessCommandResult } from '@/lib/commandTypes';

// ─── Types ─────────────────────────────────────────────────────
interface TestResult {
    transcriptId: number;
    transcript: string;
    expectedAction: string;
    expectedEntity: string;
    result: ProcessCommandResult;
    actionMatch: boolean;
    entityMatch: boolean;
}

// ─── Main Page ─────────────────────────────────────────────────
export default function CommandTestPage() {
    const [results, setResults] = useState<TestResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [customInput, setCustomInput] = useState('');
    const [customResult, setCustomResult] = useState<ProcessCommandResult | null>(null);
    const [isCustomProcessing, setIsCustomProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

    // Process single transcript
    const processOne = useCallback(async (item: TestTranscript) => {
        setActiveId(item.id);
        setIsProcessing(true);

        try {
            const res = await fetch('/api/process-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: item.transcript }),
            });
            const data: ProcessCommandResult = await res.json();

            const testResult: TestResult = {
                transcriptId: item.id,
                transcript: item.transcript,
                expectedAction: item.expectedAction,
                expectedEntity: item.expectedEntity,
                result: data,
                actionMatch: data.result.action === item.expectedAction,
                entityMatch: data.result.entity === item.expectedEntity,
            };

            setResults((prev) => {
                const filtered = prev.filter((r) => r.transcriptId !== item.id);
                return [...filtered, testResult];
            });
        } catch (err) {
            console.error('Process error:', err);
        }

        setIsProcessing(false);
        setActiveId(null);
    }, []);

    // Run all tests
    const runAll = useCallback(async () => {
        setIsProcessing(true);
        setBatchProgress({ current: 0, total: TEST_TRANSCRIPTS.length });

        for (let i = 0; i < TEST_TRANSCRIPTS.length; i++) {
            const item = TEST_TRANSCRIPTS[i];
            setActiveId(item.id);
            setBatchProgress({ current: i + 1, total: TEST_TRANSCRIPTS.length });

            try {
                const res = await fetch('/api/process-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: item.transcript }),
                });
                const data: ProcessCommandResult = await res.json();

                setResults((prev) => {
                    const filtered = prev.filter((r) => r.transcriptId !== item.id);
                    return [
                        ...filtered,
                        {
                            transcriptId: item.id,
                            transcript: item.transcript,
                            expectedAction: item.expectedAction,
                            expectedEntity: item.expectedEntity,
                            result: data,
                            actionMatch: data.result.action === item.expectedAction,
                            entityMatch: data.result.entity === item.expectedEntity,
                        },
                    ];
                });
            } catch (err) {
                console.error(`Test #${item.id} error:`, err);
            }
        }

        setIsProcessing(false);
        setActiveId(null);
        setBatchProgress(null);
    }, []);

    // Process custom input
    const processCustom = useCallback(async () => {
        if (!customInput.trim()) return;
        setIsCustomProcessing(true);
        try {
            const res = await fetch('/api/process-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: customInput }),
            });
            const data: ProcessCommandResult = await res.json();
            setCustomResult(data);
        } catch (err) {
            console.error('Custom process error:', err);
        }
        setIsCustomProcessing(false);
    }, [customInput]);

    // Export results
    const exportResults = useCallback(() => {
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'command-processor-results.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [results]);

    // Stats
    const totalTests = results.length;
    const actionMatches = results.filter((r) => r.actionMatch).length;
    const entityMatches = results.filter((r) => r.entityMatch).length;
    const avgLatency = totalTests > 0
        ? Math.round(results.reduce((sum, r) => sum + r.result.latencyMs, 0) / totalTests)
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-8">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-white">Voice Command Processor</h1>
                    <p className="mt-2 text-slate-400">
                        GPT-4o-mini intent extraction — test with 25 sample transcripts
                    </p>
                </div>

                {/* Custom Input */}
                <div className="mb-8 rounded-xl bg-white/5 border border-white/10 p-5">
                    <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
                        Try Your Own
                    </h2>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && processCustom()}
                            placeholder="Type a voice command, e.g. 'Add a task to buy groceries'"
                            className="flex-1 rounded-lg bg-black/30 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            onClick={processCustom}
                            disabled={isCustomProcessing || !customInput.trim()}
                            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            {isCustomProcessing ? '⏳ Processing...' : '🚀 Process'}
                        </button>
                    </div>
                    {customResult && (
                        <div className="mt-4 rounded-lg bg-black/30 p-4 font-mono text-xs text-white/80 overflow-x-auto">
                            <pre>{JSON.stringify(customResult, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* Summary Stats */}
                {totalTests > 0 && (
                    <div className="mb-8 grid gap-4 sm:grid-cols-4">
                        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                            <p className="text-2xl font-bold text-white">{totalTests}/25</p>
                            <p className="text-xs text-slate-400">Tested</p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                            <p className="text-2xl font-bold text-emerald-400">
                                {Math.round((actionMatches / totalTests) * 100)}%
                            </p>
                            <p className="text-xs text-slate-400">Action Accuracy</p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                            <p className="text-2xl font-bold text-blue-400">
                                {Math.round((entityMatches / totalTests) * 100)}%
                            </p>
                            <p className="text-xs text-slate-400">Entity Accuracy</p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                            <p className="text-2xl font-bold text-amber-400">{avgLatency}ms</p>
                            <p className="text-xs text-slate-400">Avg Latency</p>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Test Transcripts</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={runAll}
                            disabled={isProcessing}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            {batchProgress
                                ? `⏳ ${batchProgress.current}/${batchProgress.total}`
                                : '▶️ Run All'}
                        </button>
                        {results.length > 0 && (
                            <button
                                onClick={exportResults}
                                className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors cursor-pointer"
                            >
                                📦 Export JSON
                            </button>
                        )}
                    </div>
                </div>

                {/* Test Items */}
                <div className="space-y-3">
                    {TEST_TRANSCRIPTS.map((item) => {
                        const testResult = results.find((r) => r.transcriptId === item.id);
                        const isActive = activeId === item.id;

                        return (
                            <div
                                key={item.id}
                                className={`rounded-xl border p-4 transition-all ${isActive
                                        ? 'border-indigo-500/50 bg-indigo-500/10'
                                        : testResult
                                            ? testResult.actionMatch && testResult.entityMatch
                                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                                : 'border-amber-500/30 bg-amber-500/5'
                                            : 'border-white/10 bg-white/5'
                                    }`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.category === 'edge-case'
                                                        ? 'bg-amber-500/20 text-amber-300'
                                                        : 'bg-indigo-500/20 text-indigo-300'
                                                    }`}
                                            >
                                                {item.category}
                                            </span>
                                            <span className="text-xs text-slate-500">#{item.id}</span>
                                            <span className="text-[10px] text-slate-600">
                                                expects: {item.expectedAction}/{item.expectedEntity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white font-medium">&ldquo;{item.transcript}&rdquo;</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                                    </div>
                                    <button
                                        onClick={() => processOne(item)}
                                        disabled={isProcessing}
                                        className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
                                    >
                                        {isActive ? '⏳ Processing...' : '🚀 Test'}
                                    </button>
                                </div>

                                {/* Result */}
                                {testResult && (
                                    <div className="mt-3 rounded-lg bg-black/20 p-3 text-xs">
                                        <div className="flex items-center gap-4 mb-2">
                                            <span className={testResult.actionMatch ? 'text-emerald-400' : 'text-red-400'}>
                                                Action: {testResult.result.result.action}
                                                {testResult.actionMatch ? ' ✓' : ` ✗ (expected: ${testResult.expectedAction})`}
                                            </span>
                                            <span className={testResult.entityMatch ? 'text-emerald-400' : 'text-red-400'}>
                                                Entity: {testResult.result.result.entity}
                                                {testResult.entityMatch ? ' ✓' : ` ✗ (expected: ${testResult.expectedEntity})`}
                                            </span>
                                            <span className="text-slate-400">
                                                Confidence: {(testResult.result.result.confidence * 100).toFixed(0)}%
                                            </span>
                                            <span className="text-slate-500 ml-auto">
                                                {testResult.result.latencyMs}ms
                                            </span>
                                        </div>
                                        {Object.keys(testResult.result.result.params).length > 0 && (
                                            <div className="text-white/60 font-mono">
                                                Params: {JSON.stringify(testResult.result.result.params)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
