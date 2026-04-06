// Server-side proxy at /api/elevenlabs-stt keeps API key secure
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[ElevenLabs] VITE_API_URL not set — STT will fail on native');
  }
  return '';
}

/** Get auth headers for API calls — required in production where AUTH_BYPASS_MODE is disabled */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Continue without auth
  }
  return {};
}

export interface ElevenLabsCallbacks {
  onError: (error: string) => void;
  onOpen: () => void;
}

// For short commands (<5s), send at native rate for better accuracy.
// Only downsample longer recordings to save bandwidth.
const SHORT_COMMAND_THRESHOLD_SECONDS = 5;
const DOWNSAMPLE_RATE = 16000;

let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioChunks: Float32Array[] = [];
let isActive = false;
let isTranscribing = false;
let captureNode: ScriptProcessorNode | AudioWorkletNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let nativeSampleRate = 44100;

async function resampleAudio(
  samples: Float32Array,
  srcRate: number,
  targetRate: number,
): Promise<Float32Array> {
  if (srcRate === targetRate) return samples;

  const duration = samples.length / srcRate;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * targetRate), targetRate);
  const buffer = offlineCtx.createBuffer(1, samples.length, srcRate);
  buffer.getChannelData(0).set(samples);

  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start();

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

/** Normalize audio volume: find peak and scale to targetPeak (0.9) */
function normalizeAudio(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }

  // Don't amplify silence or already-loud audio
  if (peak < 0.001 || peak > 0.85) return samples;

  const targetPeak = 0.9;
  const gain = targetPeak / peak;
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * gain;
  }
  return normalized;
}

/**
 * Trim silence from start and end of audio.
 * Skips samples below the threshold amplitude.
 */
function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const threshold = 0.01;
  // Minimum padding to keep around speech (50ms)
  const padSamples = Math.floor(sampleRate * 0.05);

  let start = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      start = i;
      break;
    }
  }

  let end = samples.length - 1;
  for (let i = samples.length - 1; i >= start; i--) {
    if (Math.abs(samples[i]) > threshold) {
      end = i;
      break;
    }
  }

  // Add padding but clamp to array bounds
  const trimStart = Math.max(0, start - padSamples);
  const trimEnd = Math.min(samples.length, end + padSamples + 1);

  // Don't trim if result would be too short (<0.3s)
  if ((trimEnd - trimStart) / sampleRate < 0.3) return samples;

  return samples.slice(trimStart, trimEnd);
}

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
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function cleanupAudioResources(): void {
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (captureNode) {
    if (captureNode instanceof AudioWorkletNode) {
      captureNode.port.close();
    }
    captureNode.disconnect();
    captureNode = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    try {
      audioContext.close();
    } catch {
      /* ignore */
    }
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  audioChunks = [];
}

const WORKLET_CODE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) this.port.postMessage(new Float32Array(input));
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

function setupScriptProcessorFallback(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  maxChunks: number,
  callbacks: ElevenLabsCallbacks,
): void {
  const node = ctx.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (e: AudioProcessingEvent) => {
    if (!isActive) return;
    if (audioChunks.length >= maxChunks) {
      callbacks.onError('Recording exceeded 60 seconds. Stopped automatically.');
      stopElevenLabs();
      return;
    }
    audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(node);
  const silentGain = ctx.createGain();
  silentGain.gain.value = 0;
  node.connect(silentGain);
  silentGain.connect(ctx.destination);
  captureNode = node;
}

export async function startElevenLabs(callbacks: ElevenLabsCallbacks): Promise<void> {
  if (isActive) return;
  isActive = true;
  isTranscribing = false; // Reset stuck state from previous session

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    audioContext = new AudioContext();
    nativeSampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    audioChunks = [];

    // ScriptProcessor uses 4096 samples/chunk; AudioWorklet uses 128 samples/chunk.
    // Track max samples instead of chunks to handle both correctly.
    const maxRecordingSamples = 60 * nativeSampleRate;
    let totalSamples = 0;
    const maxChunks = Math.ceil(maxRecordingSamples / 4096) + 1; // for ScriptProcessor

    // Prefer AudioWorklet (modern), fall back to ScriptProcessor (deprecated)
    if (audioContext.audioWorklet) {
      try {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        const workletNode = new AudioWorkletNode(audioContext, 'capture-processor');
        workletNode.port.onmessage = (e: MessageEvent) => {
          if (!isActive) return;
          const chunk = new Float32Array(e.data);
          totalSamples += chunk.length;
          if (totalSamples >= maxRecordingSamples) {
            callbacks.onError('Recording exceeded 60 seconds. Stopped automatically.');
            stopElevenLabs();
            return;
          }
          audioChunks.push(chunk);
        };
        sourceNode.connect(workletNode);
        // Don't connect to destination — avoids echo
        captureNode = workletNode;
      } catch {
        // AudioWorklet failed (e.g. insecure context), fall back
        setupScriptProcessorFallback(audioContext, sourceNode, maxChunks, callbacks);
      }
    } else {
      setupScriptProcessorFallback(audioContext, sourceNode, maxChunks, callbacks);
    }

    callbacks.onOpen();
  } catch (err) {
    isActive = false;
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`Microphone access failed: ${msg}`);
    cleanupAudioResources();
  }
}

export async function stopAndTranscribe(): Promise<string> {
  // If already transcribing, wait briefly then bail — prevents stuck state
  if (isTranscribing) {
    console.warn('[ElevenLabs] stopAndTranscribe called while already transcribing');
    return '';
  }
  const wasActive = isActive;
  isActive = false;
  isTranscribing = true;

  try {
    const srcRate = nativeSampleRate;
    const chunks = [...audioChunks];
    cleanupAudioResources();

    if (!wasActive && chunks.length === 0) return '';

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalLength < srcRate * 0.5) {
      throw new Error('Recording too short. Speak for at least 1 second.');
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Pre-process: trim silence, then normalize volume
    const trimmed = trimSilence(merged, srcRate);
    const normalized = normalizeAudio(trimmed);

    // For short commands (<5s), keep native sample rate for better accuracy.
    // Longer recordings get downsampled to 16kHz to save bandwidth.
    const durationSeconds = normalized.length / srcRate;
    const isShortCommand = durationSeconds <= SHORT_COMMAND_THRESHOLD_SECONDS;
    const outputRate = isShortCommand ? srcRate : DOWNSAMPLE_RATE;
    const processed = await resampleAudio(normalized, srcRate, outputRate);
    const wavBlob = float32ToWavBlob(processed, outputRate);

    const form = new FormData();
    form.append('file', wavBlob, 'recording.wav');
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'en');
    form.append('tag_audio_events', 'false');
    form.append('diarize', 'false');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const authHeaders = await getAuthHeaders();

    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/api/elevenlabs-stt`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      if (msg.includes('abort')) {
        throw new Error('Transcription timed out. Try again.');
      }
      throw new Error('Voice API unavailable. Deploy to Vercel or run vercel dev.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `ElevenLabs API error: ${res.status}`);
    }

    const data = await res.json();
    return data.text || '';
  } finally {
    isTranscribing = false;
  }
}

export function stopElevenLabs(): void {
  isActive = false;
  isTranscribing = false;
  cleanupAudioResources();
}
