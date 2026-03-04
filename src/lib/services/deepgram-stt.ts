// DeepGram STT Service — Real-time speech-to-text using DeepGram WebSocket API
// Uses the DEEPGRAM_API_KEY from environment variables (server-side proxy for security)

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

interface DeepgramResult {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
}

interface DeepgramTranscribeOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onClose: () => void;
  language?: string;
}

// Server-side endpoint to get a temporary DeepGram token
async function getDeepgramToken(): Promise<string> {
  try {
    const response = await fetch('/api/deepgram-token');
    if (!response.ok) throw new Error('Failed to get DeepGram token');
    const data = await response.json();
    return data.token;
  } catch {
    // Fallback: use the key directly (for dev/testing only)
    const key = import.meta.env.VITE_DEEPGRAM_API_KEY;
    if (key) return key;
    throw new Error('No DeepGram API key available');
  }
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  async start(options: DeepgramTranscribeOptions): Promise<void> {
    const token = await getDeepgramToken();
    
    // Build WebSocket URL with parameters
    const params = new URLSearchParams({
      model: 'nova-2',           // Latest, fastest model
      language: options.language || 'en',
      smart_format: 'true',
      interim_results: 'true',   // Get results as user speaks
      utterance_end_ms: '1500',  // Silence detection
      vad_events: 'true',        // Voice activity detection
      encoding: 'opus',
      sample_rate: '48000',
    });
    
    const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`;
    
    this.ws = new WebSocket(wsUrl, ['token', token]);
    
    this.ws.onopen = async () => {
      console.log('[DeepgramSTT] WebSocket connected');
      
      // Start microphone capture
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(event.data);
          }
        };
        
        this.mediaRecorder.start(250); // Send audio chunks every 250ms
      } catch (err) {
        options.onError('Microphone access denied');
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'Results') {
          const result = data as DeepgramResult;
          const transcript = result.channel?.alternatives?.[0]?.transcript || '';
          
          if (transcript) {
            options.onTranscript(transcript, result.is_final || result.speech_final);
          }
        }
      } catch (err) {
        console.error('[DeepgramSTT] Parse error:', err);
      }
    };
    
    this.ws.onerror = () => {
      options.onError('DeepGram WebSocket error');
    };
    
    this.ws.onclose = () => {
      console.log('[DeepgramSTT] WebSocket closed');
      options.onClose();
    };
  }
  
  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send close frame for clean shutdown
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      this.ws.close();
    }
    
    this.ws = null;
    this.mediaRecorder = null;
  }
  
  isActive(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton
export const deepgramSTT = new DeepgramSTT();

// Speed test utility — transcribe a short phrase and measure latency
export async function testDeepgramSpeed(): Promise<{
  latencyMs: number;
  transcript: string;
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let firstResultTime: number | null = null;
    
    const stt = new DeepgramSTT();
    
    const timeout = setTimeout(() => {
      stt.stop();
      resolve({
        latencyMs: Date.now() - startTime,
        transcript: '',
        success: false,
        error: 'Timeout — no speech detected after 10s',
      });
    }, 10000);
    
    stt.start({
      onTranscript: (text, isFinal) => {
        if (!firstResultTime) firstResultTime = Date.now();
        
        if (isFinal && text.length > 0) {
          clearTimeout(timeout);
          stt.stop();
          resolve({
            latencyMs: firstResultTime - startTime,
            transcript: text,
            success: true,
          });
        }
      },
      onError: (error) => {
        clearTimeout(timeout);
        stt.stop();
        resolve({
          latencyMs: Date.now() - startTime,
          transcript: '',
          success: false,
          error,
        });
      },
      onClose: () => {
        clearTimeout(timeout);
      },
    });
  });
}
