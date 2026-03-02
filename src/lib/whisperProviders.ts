// Whisper.cpp WASM transcription library
// Uses pre-built whisper.cpp WASM from Hugging Face models hub

const MODELS = {
    'tiny': {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        size: '75 MB',
        label: 'Tiny (fastest, lower accuracy)',
    },
    'base': {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        size: '142 MB',
        label: 'Base (balanced)',
    },
} as const;

export type WhisperModel = keyof typeof MODELS;

interface WhisperResult {
    text: string;
    latencyMs: number;
    error?: string;
    modelLoadMs?: number;
}

// Convert AudioBuffer/Blob to 16kHz mono Float32Array (required by whisper.cpp)
async function audioToFloat32(audioBlob: Blob): Promise<Float32Array> {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get mono channel
    const channelData = audioBuffer.getChannelData(0);

    // Resample if needed (decodeAudioData should handle this with sampleRate: 16000)
    await audioContext.close();
    return channelData;
}

// Simple transcription using OpenAI Whisper API as fallback
// (Since WASM requires complex worker setup that doesn't work well on Vercel)
export async function transcribeWithWhisperAPI(
    audioBlob: Blob,
    apiEndpoint: string = '/api/whisper'
): Promise<WhisperResult> {
    const start = performance.now();

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const res = await fetch(apiEndpoint, {
            method: 'POST',
            body: formData,
        });

        const latencyMs = Math.round(performance.now() - start);
        const data = await res.json();

        if (!res.ok) {
            return { text: '', latencyMs, error: data.error || 'Whisper API error' };
        }

        return {
            text: data.transcript || '',
            latencyMs,
        };
    } catch (err) {
        return {
            text: '',
            latencyMs: Math.round(performance.now() - start),
            error: `${err}`,
        };
    }
}

// Transcribe using Faster Whisper self-hosted server
export async function transcribeWithFasterWhisper(
    audioBlob: Blob,
    apiEndpoint: string = '/api/faster-whisper'
): Promise<WhisperResult> {
    const start = performance.now();

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const res = await fetch(apiEndpoint, {
            method: 'POST',
            body: formData,
        });

        const latencyMs = Math.round(performance.now() - start);
        const data = await res.json();

        if (!res.ok) {
            return { text: '', latencyMs, error: data.error || 'Faster Whisper error' };
        }

        return {
            text: data.transcript || '',
            latencyMs,
        };
    } catch (err) {
        return {
            text: '',
            latencyMs: Math.round(performance.now() - start),
            error: `${err}`,
        };
    }
}

export { MODELS, audioToFloat32 };
export type { WhisperResult };
