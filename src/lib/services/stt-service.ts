// STT recording service — captures mic audio, encodes WAV, sends to STT API
// Originally built for ElevenLabs Scribe, being migrated to Cartesia Ink
import { Capacitor } from '@capacitor/core';
import { supabase, sessionReady } from '@/lib/supabase';

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[STT] VITE_API_URL not set — STT will fail on native');
  }
  return '';
}

/** Get auth headers for API calls — required in production where AUTH_BYPASS_MODE is disabled */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    // On native, the Supabase session is loaded asynchronously from
    // Capacitor Preferences. Without awaiting sessionReady here, a voice
    // command issued immediately after app launch can race the session
    // loader: getSession() returns null, the request goes out without an
    // Authorization header, and the API returns 401. Awaiting is a no-op
    // on web (sessionReady resolves synchronously after the first
    // getSession()).
    if (Capacitor.isNativePlatform()) {
      await sessionReady;
    }
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

export interface SttCallbacks {
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

/**
 * Compute RMS (root-mean-square) energy of a Float32 buffer.
 * Values:
 *   < 0.0005  — essentially silent (ambient room noise max)
 *   0.001     — faint background
 *   0.005+    — clearly audible speech
 *   0.02+     — close-talking speech
 *
 * Used to reject empty/silent recordings BEFORE sending them to
 * ElevenLabs. Scribe (and Whisper) hallucinate long, unrelated text
 * when they receive silence — e.g. the user sees a transcript about
 * real estate because the model filled in training-data noise.
 * This is the bug Alejandro screenshotted on 2026-04-09.
 */
function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Heuristic: did the STT service return hallucinated text?
 *
 * Scribe/Whisper hallucinations tend to be long runs of fluent but
 * unrelated text when the audio was too quiet or was silence. If the
 * audio was short (<2s) and the transcript came back with more than
 * ~40 words, something is wrong — a short utterance can't have that
 * many words. We also catch the classic "thank you for watching" /
 * "subscribe to my channel" / long real-estate-sales-pitch patterns.
 */
function looksHallucinated(transcript: string, audioDurationSeconds: number): boolean {
  const text = transcript.trim();
  if (!text) return false;
  const wordCount = text.split(/\s+/).length;

  // Short audio should not produce long text. Normal speaking rate is
  // ~2.5 words/second; we allow 4 words/second as a generous cap plus
  // a small constant for very short utterances.
  const maxReasonableWords = Math.ceil(audioDurationSeconds * 4) + 3;
  if (wordCount > maxReasonableWords) return true;

  // Known Whisper/Scribe hallucination phrases. These show up when the
  // model is fed silence or pure noise. Not exhaustive — matched loose
  // to catch variants.
  const hallucinationPatterns = [
    /thank you for watching/i,
    /thanks for watching/i,
    /subscribe to my channel/i,
    /don't forget to (?:like|subscribe)/i,
    /see you (?:next time|in the next)/i,
    /\.\s*\.\s*\./, // long pause ellipses
  ];
  if (hallucinationPatterns.some((re) => re.test(text))) return true;

  return false;
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
  callbacks: SttCallbacks,
): void {
  const node = ctx.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (e: AudioProcessingEvent) => {
    // Accept chunks until the node is actually disconnected (captureNode === null).
    // Don't gate on `isActive` — we want in-flight audio to land even after the
    // user has tapped stop, so the flush window in stopAndTranscribe() works.
    if (captureNode === null) return;
    if (audioChunks.length >= maxChunks) {
      callbacks.onError('Recording exceeded 60 seconds. Stopped automatically.');
      stopRecording();
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

export async function startRecording(callbacks: SttCallbacks): Promise<void> {
  if (isActive) return;
  isActive = true;
  isTranscribing = false; // Reset stuck state from previous session

  try {
    // autoGainControl is important on Android — many devices ship with
    // a very low default mic gain, so without AGC the captured waveform
    // is below the silence-trim threshold and trimSilence() eats the
    // entire utterance. echoCancellation stops the mic from re-capturing
    // TTS playback when the user is mid-conversation with the agent.
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    audioContext = new AudioContext();
    // On Android Chrome and iOS Safari the AudioContext is created in
    // 'suspended' state due to autoplay policy. Without resume() the
    // worklet's process() method never fires and audioChunks stays empty,
    // surfacing as "Recording too short" with zero captured audio.
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
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
          // Accept chunks until the node is actually disconnected.
          // Gating on `isActive` would drop the last ~50-150ms of audio
          // (the worklet thread is async), so we use captureNode instead.
          if (captureNode === null) return;
          const chunk = new Float32Array(e.data);
          totalSamples += chunk.length;
          if (totalSamples >= maxRecordingSamples) {
            callbacks.onError('Recording exceeded 60 seconds. Stopped automatically.');
            stopRecording();
            return;
          }
          audioChunks.push(chunk);
        };
        sourceNode.connect(workletNode);
        // Connect worklet → silent gain → destination so the audio graph
        // has a path to destination. Without this, some browsers (Android
        // Chrome in particular) keep the graph in a suspended state and
        // process() never runs, even though the context is "running".
        // Gain is 0 so there's no audible echo.
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        workletNode.connect(silentGain);
        silentGain.connect(audioContext.destination);
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
    cleanupAudioResources();
    // Rethrow so the caller can inspect err.name (NotAllowedError etc.)
    // and surface a platform-specific message. Previously we only fired
    // callbacks.onError(string), which lost the original Error object and
    // forced the caller to string-match for permission detection.
    throw err;
  }
}

export async function stopAndTranscribe(): Promise<string> {
  // If already transcribing, wait briefly then bail — prevents stuck state
  if (isTranscribing) {
    console.warn('[STT] stopAndTranscribe called while already transcribing');
    return '';
  }
  const wasActive = isActive;
  isActive = false;
  isTranscribing = true;

  try {
    // Flush delay: AudioWorklet runs on a separate thread and may have chunks
    // in flight that haven't reached the main thread via port.postMessage().
    // Without this delay, the last ~50-150ms of audio is dropped — which on
    // slower devices (Android, low-end phones) trips the "recording too short"
    // check even when the user spoke for a clearly audible duration.
    await new Promise((resolve) => setTimeout(resolve, 120));

    const srcRate = nativeSampleRate;
    const chunks = [...audioChunks];
    cleanupAudioResources();

    if (!wasActive && chunks.length === 0) return '';

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    // Threshold lowered from 0.5s → 0.25s. The flush delay above recovers
    // ~120ms of previously-dropped audio, and 0.25s is enough for short
    // commands like "yes", "no", "next", "weekday".
    if (totalLength < srcRate * 0.25) {
      // Yair flagged on 2026-04-09 that "Recording too short" should never
      // be surfaced as an error. Using the friendlier clarification prompt.
      throw new Error("I didn't catch that — could you say it again?");
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Silence gate. ElevenLabs Scribe hallucinates long runs of fluent
    // unrelated text when it receives silence or pure noise (the
    // real-estate-sales-pitch screenshot from Alejandro on 2026-04-09
    // was this bug). Reject obviously-silent audio BEFORE sending to
    // the API so the user sees a friendly prompt instead of a garbage
    // hallucinated transcript.
    const rms = computeRms(merged);
    if (rms < 0.0008) {
      throw new Error("I didn't catch that — could you say it again?");
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
        // TODO: migrate to /api/cartesia-stt
        method: 'POST',
        headers: authHeaders,
        body: form,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      if (msg.includes('abort')) {
        throw new Error("Hmm, I didn't catch that in time. Try saying it again?");
      }
      throw new Error("Couldn't connect right now. Try again in a moment.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `STT API error: ${res.status}`);
    }

    const data = await res.json();
    const text = (data.text || '').trim();

    // Hallucination guard. Scribe/Whisper sometimes return long runs
    // of unrelated text when the audio was quiet or noisy even after
    // passing the RMS gate. Compare word count against audio duration
    // and look for known hallucination phrases. If we detect one, tell
    // the user to try again instead of processing garbage.
    if (text && looksHallucinated(text, durationSeconds)) {
      console.warn('[STT] Rejected likely hallucination:', {
        duration: durationSeconds.toFixed(2),
        wordCount: text.split(/\s+/).length,
        preview: text.slice(0, 80),
      });
      throw new Error("I didn't catch that — could you say it again?");
    }

    return text;
  } finally {
    isTranscribing = false;
  }
}

export function stopRecording(): void {
  isActive = false;
  isTranscribing = false;
  cleanupAudioResources();
}
