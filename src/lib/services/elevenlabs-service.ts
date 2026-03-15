// ElevenLabs WebSocket STT Service
// Streams microphone audio to ElevenLabs Speech-to-Text API (Scribe v2)

export interface ElevenLabsCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

let ws: WebSocket | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let isActive = false;

async function getElevenLabsToken(): Promise<string> {
  const res = await fetch('/api/elevenlabs-token');
  if (!res.ok) throw new Error('Failed to get ElevenLabs token');
  const data = await res.json();
  return data.token;
}

// Inline AudioWorklet processor — converts Float32 → Int16 PCM
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const float32 = input[0];
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor-el', PCMProcessor);
`;

async function createAudioPipeline(stream: MediaStream, onData: (buffer: ArrayBuffer) => void): Promise<void> {
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  try {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await audioContext.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor-el');
    workletNode.port.onmessage = (e) => {
      if (isActive && ws && ws.readyState === WebSocket.OPEN) {
        onData(e.data);
      }
    };
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
  } catch {
    // Fallback: ScriptProcessor for older browsers / iOS WKWebView
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!isActive || !ws || ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      onData(int16.buffer);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  }
}

export async function startElevenLabs(callbacks: ElevenLabsCallbacks): Promise<void> {
  if (isActive) return;

  try {
    const token = await getElevenLabsToken();

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    await createAudioPipeline(mediaStream, (buffer) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(buffer);
      }
    });

    const actualSampleRate = audioContext ? audioContext.sampleRate : 16000;

    // ElevenLabs STT WebSocket endpoint
    const url = `wss://api.elevenlabs.io/v1/speech-to-text/stream?model_id=scribe_v2&language_code=en&sample_rate=${actualSampleRate}&encoding=pcm_s16le`;

    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      isActive = true;
      // Send initial config message
      ws!.send(JSON.stringify({
        type: 'config',
        api_key: token,
        sample_rate: actualSampleRate,
        encoding: 'pcm_s16le',
        language_code: 'en',
      }));
      callbacks.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript') {
          const text = data.text || data.transcript || '';
          if (text) {
            const isFinal = data.is_final ?? data.type === 'transcript';
            callbacks.onTranscript(text, isFinal);
          }
        } else if (data.type === 'partial_transcript' || data.type === 'interim') {
          const text = data.text || data.transcript || '';
          if (text) {
            callbacks.onTranscript(text, false);
          }
        } else if (data.type === 'error') {
          callbacks.onError(data.message || 'ElevenLabs transcription error');
        }
      } catch (err) {
        console.error('[ElevenLabs] Parse error:', err);
      }
    };

    ws.onerror = () => {
      callbacks.onError('ElevenLabs connection error. Try again or switch to another STT provider.');
      stopElevenLabs();
    };

    ws.onclose = () => {
      isActive = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      callbacks.onClose();
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onError(`ElevenLabs failed: ${msg}`);
    stopElevenLabs();
  }
}

export function stopElevenLabs(): void {
  isActive = false;

  if (audioContext && audioContext.state !== 'closed') {
    try { audioContext.close(); } catch { /* ignore */ }
    audioContext = null;
  }

  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'close' })); } catch { /* ignore */ }
      ws.close();
    }
    ws = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

export function isElevenLabsActive(): boolean {
  return isActive;
}
