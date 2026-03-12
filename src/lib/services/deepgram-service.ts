// DeepGram WebSocket STT Service
// Streams microphone audio to DeepGram's real-time transcription API

export interface DeepGramCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

let ws: WebSocket | null = null;
let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let isActive = false;

async function getDeepGramToken(): Promise<string> {
  const res = await fetch('/api/deepgram-token');
  if (!res.ok) throw new Error('Failed to get DeepGram token');
  const data = await res.json();
  return data.token;
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

    ws.onopen = () => {
      console.log('[DeepGram] WebSocket connected');
      isActive = true;
      callbacks.onOpen();

      // 4. Start MediaRecorder to stream audio
      // Use AudioContext to get raw PCM data
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(mediaStream!);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!isActive || !ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws!.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store for cleanup
      (ws as any)._audioContext = audioContext;
      (ws as any)._processor = processor;
      (ws as any)._source = source;
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

  // Clean up audio processing
  if (ws) {
    try {
      const ctx = (ws as any)._audioContext as AudioContext | undefined;
      const proc = (ws as any)._processor as ScriptProcessorNode | undefined;
      const src = (ws as any)._source as MediaStreamAudioSourceNode | undefined;
      if (proc) proc.disconnect();
      if (src) src.disconnect();
      if (ctx && ctx.state !== 'closed') ctx.close();
    } catch { /* ignore */ }

    // Send close message to DeepGram
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

  if (mediaRecorder) {
    try { mediaRecorder.stop(); } catch { /* ignore */ }
    mediaRecorder = null;
  }
}

export function isDeepGramActive(): boolean {
  return isActive;
}
