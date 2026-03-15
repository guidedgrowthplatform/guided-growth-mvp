import { useState, useEffect, useRef } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { useVoiceStore } from '@/stores/voiceStore';
import { speak } from '@/lib/services/tts-service';
import { Pencil } from 'lucide-react';

export function VoiceTranscript() {
    const { isListening, transcript, interim, error, resetTranscript } = useVoiceInput();
    const { processTranscript, isProcessing, lastResult, lastIntent, latency, clearResult } = useVoiceCommand();
    const setTranscript = useVoiceStore((s) => s.setTranscript);
    const lastProcessedRef = useRef('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-process transcript when user stops speaking (silence detection triggers stop)
    useEffect(() => {
        if (!isListening && transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;
            processTranscript(transcript);
        }
    }, [isListening, transcript, processTranscript]);

    // TTS talk-back: speak the result after processing
    useEffect(() => {
        if (lastResult && !isProcessing) {
            speak(lastResult.message);
        }
    }, [lastResult, isProcessing]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

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

    if (!isListening && !transcript && !error && !lastResult) return null;

    return (
        <div className="fixed bottom-24 left-4 right-20 z-50 lg:left-auto lg:bottom-6 lg:right-24 lg:w-80">
            <div className="bg-surface backdrop-blur-sm rounded-xl shadow-elevated border border-border p-3">
                {/* Status */}
                {isListening && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-danger uppercase tracking-wide">
                            Listening...
                        </span>
                        <span className="text-[10px] text-content-tertiary ml-auto">
                            auto-stops after silence
                        </span>
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-primary">
                            Processing command...
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-xs text-warning bg-warning/10 rounded-lg p-2 mb-2">
                        {error}
                    </div>
                )}

                {/* Transcript — editable */}
                {transcript && !isEditing && (
                    <div className="text-sm text-content leading-relaxed mb-2 group">
                        <div className="flex items-start gap-1">
                            <p className="italic flex-1">"{transcript}"</p>
                            <button
                                onClick={handleEditStart}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-[10px] text-primary hover:text-primary underline flex-shrink-0 transition-opacity p-1"
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
                            className="w-full text-sm border border-primary/20 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Edit your command..."
                        />
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={handleEditSubmit}
                                className="text-xs bg-primary text-white px-2 py-0.5 rounded hover:bg-primary-dark"
                            >
                                Reprocess
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-xs text-content-tertiary hover:text-content-secondary underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Live interim text */}
                {isListening && interim && (
                    <p className="text-sm text-content-tertiary italic mt-1">
                        {interim}...
                    </p>
                )}

                {/* Prompt when listening but no transcript yet */}
                {isListening && !transcript && !interim && !error && (
                    <p className="text-xs text-content-tertiary italic">Speak now...</p>
                )}

                {/* Command Result */}
                {lastResult && !isProcessing && (
                    <div className={`rounded-lg p-2 mt-2 text-xs ${
                        lastResult.success
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-danger/10 text-danger border border-danger/20'
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
                            className="text-xs text-content-tertiary hover:text-content-secondary underline"
                        >
                            Clear
                        </button>
                    )}
                    {lastResult && (
                        <button
                            onClick={clearResult}
                            className="text-xs text-content-tertiary hover:text-content-secondary underline"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
