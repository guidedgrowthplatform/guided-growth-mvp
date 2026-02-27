import { useVoiceInput } from '@/hooks/useVoiceInput';

export function VoiceTranscript() {
    const { isListening, transcript, error, resetTranscript } = useVoiceInput();

    if (!isListening && !transcript && !error) return null;

    return (
        <div className="fixed bottom-24 right-24 z-50 lg:bottom-6 lg:right-24 w-72 max-w-[calc(100vw-8rem)]">
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

                {/* Error */}
                {error && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-2">
                        {error}
                    </div>
                )}

                {/* Transcript */}
                {transcript && (
                    <div className="text-sm text-slate-700 leading-relaxed">
                        <p className="italic">"{transcript}"</p>
                        <button
                            onClick={resetTranscript}
                            className="text-xs text-slate-400 hover:text-slate-600 mt-1 underline"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Prompt when listening but no transcript yet */}
                {isListening && !transcript && !error && (
                    <p className="text-xs text-slate-400 italic">Speak now...</p>
                )}
            </div>
        </div>
    );
}
