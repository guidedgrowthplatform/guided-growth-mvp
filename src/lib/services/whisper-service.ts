/**
 * Whisper STT Service — browser-based speech-to-text via whisper-tiny WASM
 * Uses @huggingface/transformers (Transformers.js) to run Whisper in-browser
 *
 * Audio capture: Uses Web Audio API ScriptProcessorNode to capture raw PCM
 * at 16kHz mono — avoids MediaRecorder + WebM decoding issues entirely.
 */

// Lazy import — @huggingface/transformers is 21MB+ WASM, only load when user activates Whisper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let whisperPipeline: any = null;
let isLoading = false;
let loadProgress = 0;

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

const listeners = new Set<(status: WhisperStatus, progress?: number) => void>();

function notifyListeners(status: WhisperStatus, progress?: number) {
  listeners.forEach((cb) => cb(status, progress));
}

export function onWhisperStatus(cb: (status: WhisperStatus, progress?: number) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Load the whisper-tiny model. Downloads ~40MB on first use, cached after.
 */
export async function loadWhisperModel(): Promise<void> {
  if (whisperPipeline) return;
  if (isLoading) return;

  isLoading = true;
  notifyListeners('loading', 0);

  try {
    const { pipeline } = await import('@huggingface/transformers');
    whisperPipeline = await pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-base',
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (progress: { progress?: number; status?: string }) => {
          if (progress.progress !== undefined) {
            loadProgress = Math.round(progress.progress);
            notifyListeners('loading', loadProgress);
          }
        },
      },
    );
    notifyListeners('ready');
    // Whisper model loaded successfully
  } catch (err) {
    console.error('[Whisper] Failed to load model:', err);
    notifyListeners('error');
    throw err;
  } finally {
    isLoading = false;
  }
}

// ─── Raw PCM Audio Recorder ───

let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let processorNode: ScriptProcessorNode | null = null;
let recordedChunks: Float32Array[] = [];
let mediaStream: MediaStream | null = null;

/**
 * Start capturing raw PCM audio from the microphone.
 */
export async function startAudioCapture(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  mediaStream = stream;

  audioContext = new AudioContext({ sampleRate: 16000 });
  sourceNode = audioContext.createMediaStreamSource(stream);

  // ScriptProcessorNode captures raw PCM data
  // Buffer size 4096 gives good balance between latency and performance
  processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  recordedChunks = [];

  processorNode.onaudioprocess = (e) => {
    const channelData = e.inputBuffer.getChannelData(0);
    // Copy the data (the buffer gets reused)
    recordedChunks.push(new Float32Array(channelData));
  };

  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  // Audio capture started
}

/**
 * Stop capturing and return the recorded audio as a single Float32Array.
 */
export async function stopAudioCapture(): Promise<Float32Array> {
  // Disconnect nodes
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  // Merge all chunks into one Float32Array
  const totalLength = recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of recordedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  recordedChunks = [];

  const durationSec = (totalLength / 16000).toFixed(2);
  const maxAmp = result.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  // Audio captured: samples=totalLength, duration=durationSec

  return result;
}

/**
 * Transcribe raw PCM Float32Array (16kHz mono) using Whisper.
 */
export async function transcribeAudio(audioData: Float32Array): Promise<string> {
  if (!whisperPipeline) {
    await loadWhisperModel();
  }
  if (!whisperPipeline) {
    throw new Error('Whisper model not loaded');
  }

  notifyListeners('transcribing');

  try {
    // Whisper transcribing...

    const result = await whisperPipeline(audioData, {
      language: 'english',
      task: 'transcribe',
    });

    notifyListeners('ready');
    // Raw transcription result received

    let text = '';
    if (Array.isArray(result)) {
      text = result.map((r) => r.text).join(' ').trim();
    } else {
      text = (result as { text: string }).text.trim();
    }

    // Filter known whisper-tiny hallucinations on silence/noise
    const hallucinations = [
      '[music]', '[Music]', '[MUSIC]', '[ Music ]',
      '[silence]', '[Silence]', '[BLANK_AUDIO]',
      '(music)', '(Music)', '[applause]', '[Applause]',
      'Thank you.', 'Thanks for watching.', 'you', 'You',
      '...', '.', 'MBC 뉴스 이덕영입니다.',
    ];
    if (hallucinations.includes(text)) {
      console.warn('[Whisper] Filtered hallucination:', text);
      return '';
    }

    // Transcription complete
    return text;
  } catch (err) {
    console.error('[Whisper] Transcription error:', err);
    notifyListeners('ready');
    throw err;
  }
}

export function isWhisperReady(): boolean {
  return whisperPipeline !== null;
}

export function getWhisperLoadProgress(): number {
  return loadProgress;
}
