// Server-side proxy at /api/elevenlabs-stt keeps API key secure

export interface ElevenLabsCallbacks {
  onError: (error: string) => void;
  onOpen: () => void;
}

const TARGET_SAMPLE_RATE = 16000;

let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioChunks: Float32Array[] = [];
let isActive = false;
let isTranscribing = false;
let captureNode: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let nativeSampleRate = 44100;

async function resampleTo16k(samples: Float32Array, srcRate: number): Promise<Float32Array> {
  if (srcRate === TARGET_SAMPLE_RATE) return samples;

  const duration = samples.length / srcRate;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE,
  );
  const buffer = offlineCtx.createBuffer(1, samples.length, srcRate);
  buffer.getChannelData(0).set(samples);

  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start();

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
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

export async function startElevenLabs(callbacks: ElevenLabsCallbacks): Promise<void> {
  if (isActive) return;
  isActive = true;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    audioContext = new AudioContext();
    nativeSampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    audioChunks = [];

    const maxChunks = Math.ceil((60 * nativeSampleRate) / 4096) + 1;
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
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    captureNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    callbacks.onOpen();
  } catch (err) {
    isActive = false;
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`Microphone access failed: ${msg}`);
    cleanupAudioResources();
  }
}

export async function stopAndTranscribe(): Promise<string> {
  if (isTranscribing) return '';
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

    const resampled = await resampleTo16k(merged, srcRate);
    const wavBlob = float32ToWavBlob(resampled, TARGET_SAMPLE_RATE);

    const form = new FormData();
    form.append('file', wavBlob, 'recording.wav');
    form.append('model_id', 'scribe_v2');
    form.append('language_code', 'en');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch('/api/elevenlabs-stt', {
        method: 'POST',
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
