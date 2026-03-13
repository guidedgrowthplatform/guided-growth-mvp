// DeepGram WebSocket STT Service
// Streams microphone audio to DeepGram's real-time transcription API
// Uses AudioWorklet (modern Web Audio API) for PCM conversion

export interface DeepGramCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

let ws: WebSocket | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let isActive = false;

async function getDeepGramToken(): Promise<string> {
  const res = await fetch('/api/deepgram-token');
  if (!res.ok) throw new Error('Failed to get DeepGram token');
  const data = await res.json();
  return data.token;
}

// Inline AudioWorklet processor code (avoids separate file / CORS issues)
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
registerProcessor('pcm-processor', PCMProcessor);
`;

async function createAudioPipeline(stream: MediaStream, onData: (buffer: ArrayBuffer) => void): Promise<void> {
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);

  // Try AudioWorklet first (modern), fall back to ScriptProcessor (legacy)
  try {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
    workletNode.port.onmessage = (e) => {
      if (isActive && ws && ws.readyState === WebSocket.OPEN) {
        onData(e.data);
      }
    };
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
  } catch {
    // Fallback: ScriptProcessor for older browsers that don't support AudioWorklet
    console.warn('[DeepGram] AudioWorklet unavailable, using ScriptProcessor fallback');
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
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

export async function startDeepGram(callbacks: DeepGramCallbacks): Promise<void> {
  if (isActive) return;

  try {
    // 1. Get API key from server
    const token = await getDeepGramToken();

    // 2. Get microphone access
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // 3. Open WebSocket to DeepGram
    const url = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      language: 'en',
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: '1500',
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    }).toString();

    ws = new WebSocket(url, ['token', token]);
    ws.binaryType = 'arraybuffer';

    ws.onopen = async () => {
      console.log('[DeepGram] WebSocket connected');
      isActive = true;
      callbacks.onOpen();

      // 4. Start audio pipeline (AudioWorklet or ScriptProcessor fallback)
      try {
        await createAudioPipeline(mediaStream!, (buffer) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(buffer);
          }
        });
      } catch (err) {
        console.error('[DeepGram] Audio pipeline error:', err);
        callbacks.onError('Failed to start audio processing');
        stopDeepGram();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
          const alt = data.channel.alternatives[0];
          const transcript = alt.transcript || '';
          if (transcript) {
            callbacks.onTranscript(transcript, data.is_final);
          }
        }
      } catch (err) {
        console.error('[DeepGram] Parse error:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[DeepGram] WebSocket error:', event);
      callbacks.onError('DeepGram connection error. Try again or switch to Web Speech.');
      stopDeepGram();
    };

    ws.onclose = (event) => {
      console.log('[DeepGram] WebSocket closed:', event.code, event.reason);
      isActive = false;
      callbacks.onClose();
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DeepGram] Start error:', msg);
    callbacks.onError(`DeepGram failed: ${msg}`);
    stopDeepGram();
  }
}

export function stopDeepGram(): void {
  isActive = false;

  // Clean up audio context (handles both AudioWorklet and ScriptProcessor)
  if (audioContext && audioContext.state !== 'closed') {
    try { audioContext.close(); } catch { /* ignore */ }
    audioContext = null;
  }

  // Close WebSocket
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* ignore */ }
      ws.close();
    }
    ws = null;
  }

  // Release microphone
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

export function isDeepGramActive(): boolean {
  return isActive;
}
