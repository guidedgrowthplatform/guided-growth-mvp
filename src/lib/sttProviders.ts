/**
 * STT Provider abstraction for evaluation.
 * Each provider implements transcribe() returning text + latency.
 */

export interface TranscriptionResult {
    text: string;
    latencyMs: number;
    error?: string;
}

export type ProviderName = 'web-speech-api' | 'deepgram' | 'whisper';

export interface STTProvider {
    name: ProviderName;
    label: string;
    available: boolean;
    transcribe: (audioBlob: Blob) => Promise<TranscriptionResult>;
}

// ─── Web Speech API Provider ───────────────────────────────────
function createWebSpeechProvider(): STTProvider {
    const available =
        typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    return {
        name: 'web-speech-api',
        label: 'Web Speech API',
        available,
        transcribe: async (): Promise<TranscriptionResult> => {
            // Web Speech API works on live audio, not blobs.
            // For evaluation, we use it in "live mode" — user speaks while it listens.
            // This is a placeholder — actual testing happens via the live test component.
            return {
                text: '',
                latencyMs: 0,
                error: 'Web Speech API requires live audio — use the Live Test mode.',
            };
        },
    };
}

// ─── Deepgram Provider ─────────────────────────────────────────
function createDeepgramProvider(): STTProvider {
    return {
        name: 'deepgram',
        label: 'Deepgram Nova-3',
        available: true, // Available if API key is set (checked server-side)
        transcribe: async (audioBlob: Blob): Promise<TranscriptionResult> => {
            const startTime = performance.now();

            try {
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                const response = await fetch('/api/deepgram', {
                    method: 'POST',
                    body: formData,
                });

                const latencyMs = Math.round(performance.now() - startTime);

                if (!response.ok) {
                    const err = await response.json();
                    return { text: '', latencyMs, error: err.error || 'Deepgram API error' };
                }

                const data = await response.json();
                return { text: data.transcript, latencyMs };
            } catch (err) {
                return {
                    text: '',
                    latencyMs: Math.round(performance.now() - startTime),
                    error: `Deepgram error: ${err}`,
                };
            }
        },
    };
}

// ─── Whisper Provider ──────────────────────────────────────────
function createWhisperProvider(): STTProvider {
    return {
        name: 'whisper',
        label: 'OpenAI Whisper',
        available: false, // Disabled — no API key provided
        transcribe: async (): Promise<TranscriptionResult> => {
            return {
                text: '',
                latencyMs: 0,
                error: 'Whisper not configured — OPENAI_API_KEY not provided.',
            };
        },
    };
}

// ─── Factory ───────────────────────────────────────────────────
export function getProviders(): STTProvider[] {
    return [
        createWebSpeechProvider(),
        createDeepgramProvider(),
        createWhisperProvider(),
    ];
}

export function getProvider(name: ProviderName): STTProvider | undefined {
    return getProviders().find((p) => p.name === name);
}
