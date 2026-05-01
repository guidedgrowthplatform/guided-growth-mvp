/**
 * Cartesia Line Agent WebSocket Client
 *
 * Transport-layer client for browser real-time voice conversations with a
 * deployed Cartesia Line agent. Decoupled from React so it can be driven
 * from a hook or a plain script.
 *
 * Protocol (verified 2026-04-21 via scripts/cartesia-agent-smoke.mjs):
 *   URL   wss://api.cartesia.ai/agents/stream/{agent_id}
 *         ?access_token=<token>&cartesia_version=2026-03-01
 *   Auth  Access token as query parameter (browser WebSocket cannot set
 *         custom headers; Cartesia documents the same pattern for
 *         /tts/websocket).
 *   In    client → server: `start`, `media_input`, `dtmf`, `custom`
 *   Out   server → client: `ack`, `media_output`, `clear`, `transfer_call`
 *
 * Not on the wire (confirmed by Cartesia's official agent-ws-example repo):
 *   Tool-call forwarding and user/agent transcripts. The UI must subscribe
 *   to Supabase Realtime (or an equivalent side channel) to observe those.
 */

const CARTESIA_VERSION = '2026-03-01';
const HOST = 'api.cartesia.ai';
const NORMAL_CLOSE = 1000;
// Defense-in-depth: a compromised upstream cannot allocate more than ~1 MB of
// decoded audio per frame in the audio thread. Base64 inflates ~4/3× so the
// on-the-wire limit is a little under 1.4 MB.
const MAX_AUDIO_PAYLOAD_B64 = Math.ceil((1024 * 1024 * 4) / 3);

export type AudioFormat = 'pcm_16000' | 'pcm_24000' | 'pcm_44100' | 'mulaw_8000';

export type CoachingStyle = 'warm' | 'direct' | 'reflective';

export interface AgentStartMetadata {
  user_id: string;
  coaching_style?: CoachingStyle;
  screen?: string;
  /** Current static-ish screen context for LLM grounding */
  ai_context_block?: string;
  /** Recent actions since LLM last spoke for dynamic context */
  state_delta?: string;
}

export interface AgentAckPayload {
  stream_id: string;
  config: Record<string, unknown>;
}

export interface AgentClientConfig {
  agentId: string;
  accessToken: string;
  metadata: AgentStartMetadata;
  inputFormat?: AudioFormat;
  outputFormat?: AudioFormat;
  onReady?: (ack: AgentAckPayload) => void;
  onAudio?: (pcm: Uint8Array) => void;
  onClear?: () => void;
  onError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

type AgentClientState = 'idle' | 'connecting' | 'open' | 'closing' | 'closed';

// ─── Base64 helpers (browser-safe, avoids spread-arg limits) ─────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class CartesiaAgentClient {
  private ws: WebSocket | null = null;
  private state: AgentClientState = 'idle';

  constructor(private readonly config: AgentClientConfig) {}

  getState(): AgentClientState {
    return this.state;
  }

  connect(): void {
    if (this.state !== 'idle' && this.state !== 'closed') {
      throw new Error(`cartesia-agent: cannot connect from state=${this.state}`);
    }

    const { agentId, accessToken } = this.config;
    const url =
      `wss://${HOST}/agents/stream/${encodeURIComponent(agentId)}` +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&cartesia_version=${CARTESIA_VERSION}`;

    this.state = 'connecting';
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          event: 'start',
          config: {
            input_format: this.config.inputFormat ?? 'pcm_16000',
            output_format: this.config.outputFormat ?? 'pcm_44100',
          },
          metadata: this.config.metadata,
        }),
      );
    };

    ws.onmessage = (msg) => this.handleMessage(msg.data);

    ws.onerror = () => {
      this.config.onError?.(new Error('agent websocket error'));
    };

    ws.onclose = (evt) => {
      const wasOpen = this.state === 'open' || this.state === 'connecting';
      this.state = 'closed';
      this.ws = null;
      if (wasOpen) this.config.onClose?.(evt.code, evt.reason ?? '');
    };
  }

  /** Stream a chunk of PCM audio captured from the mic. No-op if not open. */
  sendAudio(pcm: Uint8Array): void {
    if (this.state !== 'open' || !this.ws) return;
    this.ws.send(
      JSON.stringify({
        event: 'media_input',
        media: { payload: uint8ToBase64(pcm) },
      }),
    );
  }

  /** Send an application-defined custom payload to the agent. */
  sendCustom(data: Record<string, unknown>): void {
    if (this.state !== 'open' || !this.ws) return;
    this.ws.send(JSON.stringify({ event: 'custom', data }));
  }

  /** Close the session cleanly. Safe to call multiple times. */
  close(): void {
    if (this.state === 'closed' || this.state === 'closing' || !this.ws) return;
    this.state = 'closing';
    try {
      this.ws.close(NORMAL_CLOSE, 'client close');
    } catch {
      /* socket already gone */
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private handleMessage(data: unknown): void {
    const parsed = parseFrame(data);
    if (!parsed) return;

    switch (parsed.event) {
      case 'ack':
        this.state = 'open';
        this.config.onReady?.({
          stream_id: typeof parsed.stream_id === 'string' ? parsed.stream_id : '',
          config: isRecord(parsed.config) ? parsed.config : {},
        });
        break;

      case 'media_output': {
        const media = parsed.media;
        if (!isRecord(media) || typeof media.payload !== 'string') break;
        if (media.payload.length > MAX_AUDIO_PAYLOAD_B64) {
          this.config.onError?.(new Error('audio frame exceeds size cap'));
          break;
        }
        this.config.onAudio?.(base64ToUint8(media.payload));
        break;
      }

      case 'clear':
        this.config.onClear?.();
        break;

      default:
        // transfer_call and any unknown event are ignored — they're not
        // expected during coaching sessions. Dev logging only.
        if (import.meta.env?.DEV) {
          console.debug('[cartesia-agent] unhandled event', parsed.event);
        }
    }
  }
}

// ─── Internal helpers (exported for tests) ──────────────────────────────────

interface AgentFrame {
  event?: string;
  stream_id?: unknown;
  config?: unknown;
  media?: unknown;
}

function parseFrame(data: unknown): AgentFrame | null {
  try {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? (parsed as AgentFrame) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
