// ElevenLabs STT Service (REST-based)
// Records audio, then uploads to ElevenLabs Speech-to-Text API (Scribe v2)
// Uses REST API instead of WebSocket (WebSocket requires single-use token not yet available in JS SDK)

export interface ElevenLabsCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioChunks: Float32Array[] = [];
let isActive = false;
let captureNode: ScriptProcessorNode | null = null;

async function getElevenLabsToken(): Promise<string> {
  const res = await fetch('/api/elevenlabs-token');
  if (!res.ok) throw new Error('Failed to get ElevenLabs token');
  const data = await res.json();
  return data.token;
}

function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
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

  // PCM data
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function startElevenLabs(callbacks: ElevenLabsCallbacks): Promise<void> {
  if (isActive) return;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioChunks = [];

    // Capture raw PCM audio
    captureNode = audioContext.createScriptProcessor(4096, 1, 1);
    captureNode.onaudioprocess = (e) => {
      if (isActive) {
        const data = e.inputBuffer.getChannelData(0);
        audioChunks.push(new Float32Array(data));
      }
    };
    source.connect(captureNode);
    captureNode.connect(audioContext.destination);

    isActive = true;
    callbacks.onOpen();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`ElevenLabs failed: ${msg}`);
    stopElevenLabs();
  }
}

export async function stopElevenLabsAndTranscribe(): Promise<string> {
  if (!isActive) return '';
  isActive = false;

  const sampleRate = audioContext?.sampleRate || 16000;

  // Stop capture
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

  // Merge audio chunks
  const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  if (totalLength < sampleRate * 0.5) {
    audioChunks = [];
    throw new Error('Recording too short. Speak for at least 1 second.');
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  audioChunks = [];

  // Convert to WAV and upload
  const wavBlob = float32ToWavBlob(merged, sampleRate);
  const token = await getElevenLabsToken();

  const form = new FormData();
  form.append('file', wavBlob, 'recording.wav');
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'en');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': token },
    body: form,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `ElevenLabs API error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || '';
}

export function stopElevenLabs(): void {
  isActive = false;

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

export function isElevenLabsActive(): boolean {
  return isActive;
}
