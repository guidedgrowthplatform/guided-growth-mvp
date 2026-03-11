import { useState, useEffect, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { useVoiceStore } from '@/stores/voiceStore';
import { speak } from '@/lib/services/tts-service';
import { Pencil, Keyboard } from 'lucide-react';

export function VoiceTranscript() {
    const { isListening, transcript, interim, error, resetTranscript, stop } = useVoiceInput();
    const { processTranscript, isProcessing, lastResult, lastIntent, latency, clearResult } = useVoiceCommand();
    const setTranscript = useVoiceStore((s) => s.setTranscript);
    const lastProcessedRef = useRef('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // ─── Manual text input fallback (when voice fails) ───
    const [showTextFallback, setShowTextFallback] = useState(false);
    const [manualText, setManualText] = useState('');
    const manualInputRef = useRef<HTMLInputElement>(null);

    // Auto-process transcript when user stops speaking (silence detection triggers stop)
    useEffect(() => {
        if (!isListening && transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;
            processTranscript(transcript);
        }
    }, [isListening, transcript, processTranscript]);

    // FIX-42: Auto-clear voice context after command execution
    useEffect(() => {
        if (lastResult && !isProcessing) {
            const timer = setTimeout(() => {
                resetTranscript();
                lastProcessedRef.current = '';
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [lastResult, isProcessing, resetTranscript]);

    // TTS talk-back: speak the result after processing
    useEffect(() => {
        if (lastResult && !isProcessing) {
            try { speak(lastResult.message); } catch { /* TTS fail is non-critical */ }
        }
    }, [lastResult, isProcessing]);

    // Focus manual input when it appears
    useEffect(() => {
        if (showTextFallback && manualInputRef.current) {
            manualInputRef.current.focus();
        }
    }, [showTextFallback]);

    // Focus edit input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // ─── Handlers ───

    const handleEditStart = () => {
        setEditedText(transcript);
        setIsEditing(true);
    };

    const handleEditSubmit = () => {
        if (editedText.trim()) {
            setTranscript(editedText.trim());
            lastProcessedRef.current = editedText.trim();
            processTranscript(editedText.trim());
        }
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleEditSubmit();
        if (e.key === 'Escape') setIsEditing(false);
    };

    // Switch to manual text input — STOP voice completely first
    const handleSwitchToManual = () => {
        // MUTUALLY EXCLUSIVE: stop voice before enabling text input
        try { stop(); } catch { /* ignore */ }
        setShowTextFallback(true);
        setManualText('');
    };

    // Submit manual text command — same pipeline as voice
    const handleManualSubmit = () => {
        const text = manualText.trim();
        if (!text) return;
        setTranscript(text);
        lastProcessedRef.current = text;
        processTranscript(text);
        setManualText('');
        setShowTextFallback(false);
    };

    const handleManualKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleManualSubmit();
        if (e.key === 'Escape') {
            setShowTextFallback(false);
            setManualText('');
        }
    };

    // When voice starts listening again, hide text fallback (mutually exclusive)
    useEffect(() => {
        if (isListening) {
            setShowTextFallback(false);
        }
    }, [isListening]);

    if (!isListening && !transcript && !error && !lastResult && !showTextFallback) return null;

    return (
        <div className="fixed bottom-24 left-4 right-20 z-50 lg:left-auto lg:bottom-6 lg:right-24 lg:w-80">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200 p-3">
                {/* Status */}
                {isListening && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                            Listening...
                        </span>
                        <span className="text-[10px] text-slate-400 ml-auto">
                            auto-stops after silence
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

                {/* Error + "Type instead" fallback button */}
                {error && (
                    <div className="mb-2">
                        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                            {error}
                        </div>
                        {/* Show "Type instead" button when there's a voice error */}
                        {!showTextFallback && !isListening && (
                            <button
                                onClick={handleSwitchToManual}
                                className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                                <Keyboard className="w-3.5 h-3.5" />
                                Type your command instead
                            </button>
                        )}
                    </div>
                )}

                {/* ─── Manual text input fallback ─── */}
                {showTextFallback && (
                    <div className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Keyboard className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-semibold text-blue-600">Type your command:</span>
                        </div>
                        <input
                            ref={manualInputRef}
                            type="text"
                            value={manualText}
                            onChange={(e) => setManualText(e.target.value)}
                            onKeyDown={handleManualKeyDown}
                            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder='e.g. "create habit stretching" or "mark meditation done"'
                            disabled={isProcessing}
                        />
                        <div className="flex gap-2 mt-1.5">
                            <button
                                onClick={handleManualSubmit}
                                disabled={!manualText.trim() || isProcessing}
                                className="text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
                            >
                                Send
                            </button>
                            <button
                                onClick={() => { setShowTextFallback(false); setManualText(''); }}
                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Transcript — editable */}
                {transcript && !isEditing && (
                    <div className="text-sm text-slate-700 leading-relaxed mb-2 group">
                        <div className="flex items-start gap-1">
                            <p className="italic flex-1">"{transcript}"</p>
                            <button
                                onClick={handleEditStart}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-700 underline flex-shrink-0 transition-opacity p-1"
                                title="Edit transcript before reprocessing"
                            >
                                <Pencil className="w-3 h-3 inline" /> Edit
                            </button>
                        </div>
                    </div>
                )}

                {/* Edit mode */}
                {isEditing && (
                    <div className="mb-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="w-full text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Edit your command..."
                        />
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={handleEditSubmit}
                                className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                            >
                                Reprocess
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                                Cancel
                            </button>
                        </div>
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
                            onClick={() => { resetTranscript(); clearResult(); lastProcessedRef.current = ''; setIsEditing(false); }}
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
                    {/* Always-available manual input toggle (even without error) */}
                    {!showTextFallback && !isListening && !isEditing && (
                        <button
                            onClick={handleSwitchToManual}
                            className="text-xs text-slate-400 hover:text-blue-600 underline ml-auto flex items-center gap-1 transition-colors"
                        >
                            <Keyboard className="w-3 h-3" /> Type
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
