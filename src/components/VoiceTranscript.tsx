'use client';

import { useVoiceStore } from '@/stores/voiceStore';

export function VoiceTranscript() {
    const { transcript, error, isListening, isSupported } = useVoiceStore();

    // Don't show anything if nothing to display
    if (!transcript && !error && !isListening) return null;

    return (
        <div
            id="voice-transcript-panel"
            className={`
        fixed bottom-24 right-6 z-40
        max-w-sm w-80
        rounded-2xl overflow-hidden
        shadow-2xl
        backdrop-blur-xl
        transition-all duration-300 ease-out
        animate-slide-up
        ${error ? 'bg-red-950/80 border border-red-500/30' : 'bg-gray-900/80 border border-white/10'}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    {isListening && (
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                    )}
                    <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                        {error ? 'Error' : isListening ? 'Listening...' : 'Transcript'}
                    </span>
                </div>
                {transcript && (
                    <button
                        onClick={() => useVoiceStore.getState().resetTranscript()}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                        aria-label="Clear transcript"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
                {error ? (
                    <p className="text-sm text-red-300">{error}</p>
                ) : transcript ? (
                    <p className="text-sm text-white/90 leading-relaxed">{transcript}</p>
                ) : isListening ? (
                    <p className="text-sm text-white/40 italic">Speak now...</p>
                ) : null}
            </div>

            {/* Browser support warning */}
            {!isSupported && (
                <div className="px-4 py-2 bg-amber-900/40 border-t border-amber-500/20">
                    <p className="text-xs text-amber-300">
                        ⚠️ Web Speech API not supported. Try Chrome or Edge.
                    </p>
                </div>
            )}
        </div>
    );
}
