'use client';

import { useState, useCallback, useRef } from 'react';
import { TEST_PHRASES, TestPhrase } from '@/lib/testPhrases';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface SimpleTranscriptionResult {
    text: string;
    latencyMs: number;
    error?: string;
}

// ─── Types ─────────────────────────────────────────────────────
interface TestResult {
    phraseId: number;
    expected: string;
    provider: string;
    transcript: string;
    latencyMs: number;
    accuracy: number; // 0-100
    error?: string;
}

// ─── Accuracy calculation (word-level) ─────────────────────────
function calculateAccuracy(expected: string, actual: string): number {
    if (!actual) return 0;
    const expectedWords = expected.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const actualWords = actual.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

    let matches = 0;
    for (const word of expectedWords) {
        if (actualWords.includes(word)) matches++;
    }
    return Math.round((matches / expectedWords.length) * 100);
}

// ─── Web Speech API live transcription ─────────────────────────
function useWebSpeechLive() {
    const [isListening, setIsListening] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    function createRecognition() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;
        const r = new SpeechRecognition();
        r.continuous = false;
        r.interimResults = false;
        r.lang = 'en-US';
        return r;
    }

    const transcribe = useCallback((): Promise<SimpleTranscriptionResult> => {
        return new Promise((resolve) => {
            const recognition = createRecognition();
            if (!recognition) {
                resolve({ text: '', latencyMs: 0, error: 'Web Speech API not supported' });
                return;
            }
            recognitionRef.current = recognition;
            const start = performance.now();
            setIsListening(true);

            recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
                const text = event.results[0][0].transcript;
                setIsListening(false);
                resolve({ text, latencyMs: Math.round(performance.now() - start) });
            };
            recognition.onerror = (event: { error: string }) => {
                setIsListening(false);
                resolve({ text: '', latencyMs: Math.round(performance.now() - start), error: event.error });
            };
            recognition.onend = () => {
                setIsListening(false);
            };
            recognition.start();
        });
    }, []);

    const cancel = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            setIsListening(false);
        }
    }, []);

    return { transcribe, isListening, cancel };
}

// ─── Main Evaluate Page ────────────────────────────────────────
export default function EvaluatePage() {
    const [results, setResults] = useState<TestResult[]>([]);
    const [activePhrase, setActivePhrase] = useState<TestPhrase | null>(null);
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const recorder = useAudioRecorder();
    const webSpeech = useWebSpeechLive();

    // Test with Web Speech API (live)
    const testWebSpeech = useCallback(
        async (phrase: TestPhrase) => {
            setActivePhrase(phrase);
            setActiveProvider('Web Speech API');
            setIsProcessing(true);
            const result = await webSpeech.transcribe();
            const testResult: TestResult = {
                phraseId: phrase.id,
                expected: phrase.text,
                provider: 'Web Speech API',
                transcript: result.text,
                latencyMs: result.latencyMs,
                accuracy: calculateAccuracy(phrase.text, result.text),
                error: result.error,
            };
            setResults((prev) => [...prev, testResult]);
            setIsProcessing(false);
            setActivePhrase(null);
        },
        [webSpeech]
    );

    // Test with Deepgram (record then send)
    const testDeepgram = useCallback(
        async (phrase: TestPhrase, audioBlob: Blob) => {
            setActivePhrase(phrase);
            setActiveProvider('Deepgram');
            setIsProcessing(true);

            const start = performance.now();
            try {
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');
                const res = await fetch('/api/deepgram', { method: 'POST', body: formData });
                const latencyMs = Math.round(performance.now() - start);
                const data = await res.json();

                if (!res.ok) {
                    setResults((prev) => [
                        ...prev,
                        {
                            phraseId: phrase.id,
                            expected: phrase.text,
                            provider: 'Deepgram',
                            transcript: '',
                            latencyMs,
                            accuracy: 0,
                            error: data.error,
                        },
                    ]);
                } else {
                    setResults((prev) => [
                        ...prev,
                        {
                            phraseId: phrase.id,
                            expected: phrase.text,
                            provider: 'Deepgram',
                            transcript: data.transcript,
                            latencyMs,
                            accuracy: calculateAccuracy(phrase.text, data.transcript),
                        },
                    ]);
                }
            } catch (err) {
                setResults((prev) => [
                    ...prev,
                    {
                        phraseId: phrase.id,
                        expected: phrase.text,
                        provider: 'Deepgram',
                        transcript: '',
                        latencyMs: Math.round(performance.now() - start),
                        accuracy: 0,
                        error: `${err}`,
                    },
                ]);
            }

            setIsProcessing(false);
            setActivePhrase(null);
        },
        []
    );

    // Export results
    const exportResults = useCallback(() => {
        const blob = new Blob([JSON.stringify(results, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stt-evaluation-results.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [results]);

    // Calculate summary stats
    const getProviderStats = (provider: string) => {
        const providerResults = results.filter((r) => r.provider === provider && !r.error);
        if (providerResults.length === 0) return null;
        return {
            count: providerResults.length,
            avgAccuracy: Math.round(
                providerResults.reduce((sum, r) => sum + r.accuracy, 0) / providerResults.length
            ),
            avgLatency: Math.round(
                providerResults.reduce((sum, r) => sum + r.latencyMs, 0) / providerResults.length
            ),
        };
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-8">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-white">STT Provider Evaluation</h1>
                    <p className="mt-2 text-slate-400">
                        Compare Web Speech API vs Deepgram on accuracy and latency
                    </p>
                </div>

                {/* Summary Cards */}
                {results.length > 0 && (
                    <div className="mb-8 grid gap-4 sm:grid-cols-2">
                        {['Web Speech API', 'Deepgram'].map((provider) => {
                            const stats = getProviderStats(provider);
                            if (!stats) return null;
                            return (
                                <div
                                    key={provider}
                                    className="rounded-xl bg-white/5 p-5 backdrop-blur-sm border border-white/10"
                                >
                                    <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                                        {provider}
                                    </h3>
                                    <div className="mt-3 grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-2xl font-bold text-white">{stats.count}</p>
                                            <p className="text-xs text-slate-400">Tests</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-emerald-400">{stats.avgAccuracy}%</p>
                                            <p className="text-xs text-slate-400">Avg Accuracy</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-amber-400">{stats.avgLatency}ms</p>
                                            <p className="text-xs text-slate-400">Avg Latency</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Test Phrases */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Test Phrases</h2>
                        {results.length > 0 && (
                            <button
                                onClick={exportResults}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                            >
                                Export JSON
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {TEST_PHRASES.map((phrase) => {
                            const phraseResults = results.filter((r) => r.phraseId === phrase.id);
                            const isActive = activePhrase?.id === phrase.id;

                            return (
                                <div
                                    key={phrase.id}
                                    className={`rounded-xl border p-4 transition-all ${isActive
                                        ? 'border-indigo-500/50 bg-indigo-500/10'
                                        : 'border-white/10 bg-white/5'
                                        }`}
                                >
                                    {/* Phrase Header */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${phrase.category === 'command'
                                                        ? 'bg-blue-500/20 text-blue-300'
                                                        : phrase.category === 'sentence'
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-amber-500/20 text-amber-300'
                                                        }`}
                                                >
                                                    {phrase.category}
                                                </span>
                                                <span className="text-xs text-slate-500">#{phrase.id}</span>
                                            </div>
                                            <p className="text-sm text-white font-medium">&ldquo;{phrase.text}&rdquo;</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{phrase.description}</p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            {/* Web Speech API Test */}
                                            <button
                                                onClick={() => testWebSpeech(phrase)}
                                                disabled={isProcessing}
                                                className="rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                            >
                                                {isActive && activeProvider === 'Web Speech API'
                                                    ? '🎙️ Listening...'
                                                    : '🌐 Web Speech'}
                                            </button>

                                            {/* Deepgram Test (needs recording first) */}
                                            {recorder.audioBlob && !recorder.isRecording ? (
                                                <button
                                                    onClick={() => testDeepgram(phrase, recorder.audioBlob!)}
                                                    disabled={isProcessing}
                                                    className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                >
                                                    {isActive && activeProvider === 'Deepgram'
                                                        ? '⏳ Processing...'
                                                        : '🔊 Deepgram'}
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="rounded-lg bg-emerald-600/30 px-3 py-1.5 text-xs text-white/40 cursor-not-allowed"
                                                    title="Record audio first using the recorder below"
                                                >
                                                    🔊 Deepgram
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Results */}
                                    {phraseResults.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {phraseResults.map((r, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs"
                                                >
                                                    <span className="font-medium text-white/70 w-28 flex-shrink-0">
                                                        {r.provider}
                                                    </span>
                                                    {r.error ? (
                                                        <span className="text-red-400">{r.error}</span>
                                                    ) : (
                                                        <>
                                                            <span className="flex-1 text-white/80 truncate">
                                                                &ldquo;{r.transcript}&rdquo;
                                                            </span>
                                                            <span
                                                                className={`font-mono font-bold ${r.accuracy >= 80
                                                                    ? 'text-emerald-400'
                                                                    : r.accuracy >= 50
                                                                        ? 'text-amber-400'
                                                                        : 'text-red-400'
                                                                    }`}
                                                            >
                                                                {r.accuracy}%
                                                            </span>
                                                            <span className="text-slate-500 font-mono w-16 text-right">
                                                                {r.latencyMs}ms
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Audio Recorder Panel */}
                <div className="sticky bottom-4 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-white">
                                Audio Recorder
                                <span className="ml-2 text-xs text-slate-400">
                                    (Record once, test with Deepgram on any phrase)
                                </span>
                            </h3>
                            {recorder.isRecording && (
                                <p className="text-xs text-red-400 mt-1 animate-pulse">
                                    ● Recording... {recorder.duration}s
                                </p>
                            )}
                            {recorder.audioBlob && !recorder.isRecording && (
                                <p className="text-xs text-emerald-400 mt-1">
                                    ✓ Audio recorded ({Math.round(recorder.audioBlob.size / 1024)}KB) — click
                                    &ldquo;Deepgram&rdquo; on any phrase to test
                                </p>
                            )}
                            {recorder.error && (
                                <p className="text-xs text-red-400 mt-1">{recorder.error}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {!recorder.isRecording ? (
                                <button
                                    onClick={recorder.startRecording}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors cursor-pointer"
                                >
                                    🎙️ Record
                                </button>
                            ) : (
                                <button
                                    onClick={recorder.stopRecording}
                                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors cursor-pointer animate-pulse"
                                >
                                    ⏹️ Stop
                                </button>
                            )}
                            {recorder.audioBlob && (
                                <button
                                    onClick={recorder.reset}
                                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors cursor-pointer"
                                >
                                    🗑️ Clear
                                </button>
                            )}
                            {recorder.audioUrl && (
                                <audio src={recorder.audioUrl} controls className="h-10" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Whisper note */}
                <div className="mt-6 rounded-xl bg-amber-900/20 border border-amber-500/20 p-4">
                    <p className="text-xs text-amber-300">
                        ⚠️ <strong>OpenAI Whisper</strong> is not tested in this evaluation — no API key
                        provided. See the evaluation document for a research-based comparison.
                    </p>
                </div>

                {/* Cancel overlay */}
                {webSpeech.isListening && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="rounded-2xl bg-slate-900 border border-indigo-500/30 p-8 text-center shadow-2xl">
                            <div className="animate-pulse text-4xl mb-4">🎙️</div>
                            <p className="text-white font-semibold text-lg">Listening...</p>
                            <p className="text-slate-400 text-sm mt-2 max-w-xs">
                                Read the phrase aloud. Recognition will stop automatically when you pause.
                            </p>
                            <button
                                onClick={webSpeech.cancel}
                                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
