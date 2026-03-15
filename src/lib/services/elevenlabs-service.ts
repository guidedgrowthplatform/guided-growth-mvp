// ElevenLabs Realtime STT Service
// Streams microphone audio to ElevenLabs Speech-to-Text Realtime API (Scribe v2)
// Docs: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime

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

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
        // ElevenLabs expects base64-encoded audio in JSON messages
        const base64 = arrayBufferToBase64(buffer);
        ws.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: base64,
        }));
      }
    });

    const actualSampleRate = audioContext ? audioContext.sampleRate : 16000;

    // Map sample rate to ElevenLabs supported format
    const sampleRateMap: Record<number, string> = {
      8000: 'pcm_8000',
      16000: 'pcm_16000',
      22050: 'pcm_22050',
      24000: 'pcm_24000',
      44100: 'pcm_44100',
      48000: 'pcm_48000',
    };
    const audioFormat = sampleRateMap[actualSampleRate] || 'pcm_16000';

    // ElevenLabs Realtime STT WebSocket
    const params = new URLSearchParams({
      model_id: 'scribe_v2',
      language_code: 'en',
      audio_format: audioFormat,
      commit_strategy: 'vad',
      vad_silence_threshold_secs: '1.5',
      token: token,
    });

    const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      isActive = true;
      callbacks.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.message_type) {
          case 'session_started':
            // Session started successfully
            break;

          case 'partial_transcript':
            if (data.text) {
              callbacks.onTranscript(data.text, false);
            }
            break;

          case 'committed_transcript':
          case 'committed_transcript_with_timestamps':
            if (data.text) {
              callbacks.onTranscript(data.text, true);
            }
            break;

          case 'error':
          case 'auth_error':
          case 'quota_exceeded':
          case 'rate_limited':
          case 'resource_exhausted':
          case 'session_time_limit_exceeded':
          case 'transcriber_error':
            callbacks.onError(data.error || `ElevenLabs error: ${data.message_type}`);
            break;
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
