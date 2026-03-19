// ElevenLabs STT Service (REST-based)
// Records audio via microphone, then uploads to ElevenLabs Scribe v2 API
// Uses server-side proxy at /api/elevenlabs-stt to keep API key secure

export interface ElevenLabsCallbacks {
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioChunks: Float32Array[] = [];
let isActive = false;
let captureNode: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// ─── Audio helpers ───

function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const raw = samples[i];
    const clamped = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function cleanupAudioResources(): void {
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (captureNode) {
    captureNode.disconnect();
    captureNode = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    try { audioContext.close(); } catch { /* ignore */ }
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  audioChunks = [];
}

// ─── Public API ───

export async function startElevenLabs(callbacks: ElevenLabsCallbacks): Promise<void> {
  if (isActive) return;
  isActive = true; // Set before await to prevent double-tap race condition

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    audioContext = new AudioContext();
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    audioChunks = [];

    const maxChunks = Math.ceil((60 * audioContext.sampleRate) / 4096); // 60s max
    captureNode = audioContext.createScriptProcessor(4096, 1, 1);
    captureNode.onaudioprocess = (e) => {
      if (!isActive) return;
      if (audioChunks.length >= maxChunks) {
        callbacks.onError('Recording exceeded 60 seconds. Stopped automatically.');
        stopElevenLabs();
        return;
      }
      audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    sourceNode.connect(captureNode);
    captureNode.connect(audioContext.destination);

    callbacks.onOpen();
  } catch (err) {
    isActive = false;
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`Microphone access failed: ${msg}`);
    cleanupAudioResources();
  }
}

export async function stopAndTranscribe(): Promise<string> {
  if (!isActive) return '';
  isActive = false;

  const sampleRate = audioContext?.sampleRate || 16000;
  const chunks = [...audioChunks];
  cleanupAudioResources();

  // Merge audio chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  if (totalLength < sampleRate * 0.5) {
    throw new Error('Recording too short. Speak for at least 1 second.');
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to WAV and upload via server-side proxy
  const wavBlob = float32ToWavBlob(merged, sampleRate);
  const form = new FormData();
  form.append('file', wavBlob, 'recording.wav');
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'en');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const res = await fetch('/api/elevenlabs-stt', {
    method: 'POST',
    body: form,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `ElevenLabs API error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || '';
}

export function stopElevenLabs(): void {
  isActive = false;
  cleanupAudioResources();
}

export function isElevenLabsActive(): boolean {
  return isActive;
}
