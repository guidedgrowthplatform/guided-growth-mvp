import { create } from 'zustand';

interface VoiceState {
    /** Whether the speech recognition is actively listening */
    isListening: boolean;
    /** The current/accumulated transcript text */
    transcript: string;
    /** Error message if speech recognition fails */
    error: string | null;
    /** Whether the browser supports Web Speech API */
    isSupported: boolean;

    // Actions
    startListening: () => void;
    stopListening: () => void;
    setTranscript: (transcript: string) => void;
    appendTranscript: (text: string) => void;
    setError: (error: string | null) => void;
    resetTranscript: () => void;
    setSupported: (supported: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
    isListening: false,
    transcript: '',
    error: null,
    isSupported: false,

    startListening: () => set({ isListening: true, error: null }),
    stopListening: () => set({ isListening: false }),
    setTranscript: (transcript) => set({ transcript }),
    appendTranscript: (text) =>
        set((state) => ({
            transcript: state.transcript ? `${state.transcript} ${text}` : text,
        })),
    setError: (error) => set({ error, isListening: false }),
    resetTranscript: () => set({ transcript: '', error: null }),
    setSupported: (isSupported) => set({ isSupported }),
}));
