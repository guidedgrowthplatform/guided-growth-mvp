import { useEffect, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';

export function VoiceTranscript() {
    const { isListening, transcript, interim, error, resetTranscript } = useVoiceInput();
    const { processTranscript, isProcessing, lastResult, lastIntent, latency, clearResult } = useVoiceCommand();
    const lastProcessedRef = useRef('');

    // Auto-process transcript when user stops speaking
    useEffect(() => {
        if (!isListening && transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;
            processTranscript(transcript);
        }
    }, [isListening, transcript, processTranscript]);

    if (!isListening && !transcript && !error && !lastResult) return null;

    return (
        <div className="fixed bottom-24 right-24 z-50 lg:bottom-6 lg:right-24 w-80 max-w-[calc(100vw-8rem)]">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200 p-3">
                {/* Status */}
                {isListening && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                            Listening...
                        </span>
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-blue-600">
                            Processing command...
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-2">
                        {error}
                    </div>
                )}

                {/* Transcript */}
                {transcript && (
                    <div className="text-sm text-slate-700 leading-relaxed mb-2">
                        <p className="italic">"{transcript}"</p>
                    </div>
                )}

                {/* Live interim text */}
                {isListening && interim && (
                    <p className="text-sm text-slate-400 italic mt-1">
                        {interim}...
                    </p>
                )}

                {/* Prompt when listening but no transcript yet */}
                {isListening && !transcript && !interim && !error && (
                    <p className="text-xs text-slate-400 italic">Speak now...</p>
                )}

                {/* Command Result */}
                {lastResult && !isProcessing && (
                    <div className={`rounded-lg p-2 mt-2 text-xs ${
                        lastResult.success
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        <p className="font-medium whitespace-pre-line">{lastResult.message}</p>
                        {lastIntent && (
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] opacity-70">
                                <span className="px-1.5 py-0.5 bg-white/60 rounded">
                                    {lastIntent.action}
                                </span>
                                <span className="px-1.5 py-0.5 bg-white/60 rounded">
                                    {lastIntent.entity}
                                </span>
                                <span>{Math.round(lastIntent.confidence * 100)}%</span>
                                {latency && <span>{latency}ms</span>}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-2">
                    {transcript && (
                        <button
                            onClick={() => { resetTranscript(); clearResult(); lastProcessedRef.current = ''; }}
                            className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            Clear
                        </button>
                    )}
                    {lastResult && (
                        <button
                            onClick={clearResult}
                            className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
