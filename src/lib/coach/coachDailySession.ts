import { authedFetch } from '@/api/authedFetch';

export type CoachOrbCallState = 'idle' | 'thinking' | 'coach' | 'user';

export interface DailyCallLike {
  join: (options: { url: string; token: string }) => Promise<void>;
  leave: () => Promise<void>;
  setLocalAudio: (enabled: boolean) => void | Promise<void>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  destroy?: () => void;
}

export interface CoachSessionResponse {
  sessionId: string;
  roomUrl: string;
  token: string;
}

export interface CoachDailySessionOptions {
  createCall?: () => Promise<DailyCallLike>;
  fetcher?: typeof authedFetch;
  onState?: (state: CoachOrbCallState) => void;
}

export function coachComponentEnabled(): boolean {
  return import.meta.env.VITE_COACH_COMPONENT === 'true';
}

export function coachOrbStateFromCall(
  botSpeaking: boolean,
  userSpeaking: boolean,
): CoachOrbCallState {
  if (botSpeaking) return 'coach';
  if (userSpeaking) return 'user';
  return 'idle';
}

async function createDailyCall(): Promise<DailyCallLike> {
  const { default: DailyIframe } = await import('@daily-co/daily-js');
  return DailyIframe.createCallObject() as unknown as DailyCallLike;
}

export class CoachDailySession {
  private call: DailyCallLike | null = null;
  private sessionId: string | null = null;
  private muted = false;
  private botSpeaking = false;
  private userSpeaking = false;
  private readonly localParticipantIds = new Set<string>();
  private readonly listeners: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];

  constructor(private readonly options: CoachDailySessionOptions = {}) {}

  get active(): boolean {
    return this.call !== null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async start(): Promise<void> {
    if (this.call) return;
    const fetcher = this.options.fetcher ?? authedFetch;
    const response = await fetcher('/api/voice/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface: 'onboarding' }),
    });
    if (!response.ok) throw new Error(`coach_session_failed:${response.status}`);
    const session = (await response.json()) as CoachSessionResponse;
    if (
      !session.roomUrl ||
      !session.token ||
      session.roomUrl === 'STUB' ||
      session.token === 'STUB'
    ) {
      throw new Error('coach_session_unavailable');
    }

    const call = await (this.options.createCall ?? createDailyCall)();
    this.call = call;
    this.sessionId = session.sessionId;
    this.attachCallListeners(call);
    this.emitState('thinking');
    try {
      await call.join({ url: session.roomUrl, token: session.token });
    } catch (error) {
      await this.leave();
      throw error;
    }
  }

  async toggleMute(): Promise<void> {
    if (!this.call) return;
    this.muted = !this.muted;
    await this.call.setLocalAudio(!this.muted);
  }

  async leave(): Promise<void> {
    const call = this.call;
    const sessionId = this.sessionId;
    let leaveError: unknown;
    this.call = null;
    this.sessionId = null;
    this.botSpeaking = false;
    this.userSpeaking = false;
    this.muted = false;
    if (call) {
      try {
        for (const { event, listener } of this.listeners) call.off?.(event, listener);
      } catch (error) {
        leaveError = error;
      }
      this.listeners.length = 0;
      try {
        await call.leave();
      } catch (error) {
        leaveError ??= error;
      } finally {
        try {
          call.destroy?.();
        } catch (error) {
          leaveError ??= error;
        }
      }
    }
    try {
      this.emitState('idle');
    } catch (error) {
      leaveError ??= error;
    } finally {
      if (sessionId) {
        try {
          const fetcher = this.options.fetcher ?? authedFetch;
          await fetcher('/api/voice/session/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        } catch (error) {
          leaveError ??= error;
        }
      }
    }
    if (leaveError) throw leaveError;
  }

  private attachCallListeners(call: DailyCallLike): void {
    this.listen(call, 'participant-updated', (event) => this.updateParticipant(event));
    this.listen(call, 'participant-joined', (event) => this.updateParticipant(event));
    this.listen(call, 'participant-left', (event) => this.updateParticipant(event));
    this.listen(call, 'active-speaker-change', (event) => this.updateActiveSpeaker(event));
    this.listen(call, 'local-audio-level', (event) => this.updateLocalAudioLevel(event));
    this.listen(call, 'left-meeting', () => this.emitState('idle'));
    this.listen(call, 'error', () => this.emitState('idle'));
  }

  private listen(call: DailyCallLike, event: string, listener: (...args: unknown[]) => void): void {
    call.on(event, listener);
    this.listeners.push({ event, listener });
  }

  private updateParticipant(event: unknown): void {
    const participant = (event as { participant?: Record<string, unknown> } | undefined)
      ?.participant;
    if (!participant) return;
    const participantId =
      typeof participant.session_id === 'string' ? participant.session_id : undefined;
    if (participant.local === true && participantId) this.localParticipantIds.add(participantId);
    if (participant.local === true && participant.audio === false) this.userSpeaking = false;
  }

  private updateActiveSpeaker(event: unknown): void {
    const peerId = (event as { activeSpeaker?: { peerId?: unknown } } | undefined)?.activeSpeaker
      ?.peerId;
    this.botSpeaking = typeof peerId === 'string' && !this.localParticipantIds.has(peerId);
    this.emitState();
  }

  private updateLocalAudioLevel(event: unknown): void {
    const audioLevel = (event as { audioLevel?: unknown } | undefined)?.audioLevel;
    this.userSpeaking = typeof audioLevel === 'number' && audioLevel > 0 && !this.muted;
    this.emitState();
  }

  private emitState(fallback?: CoachOrbCallState): void {
    this.options.onState?.(fallback ?? coachOrbStateFromCall(this.botSpeaking, this.userSpeaking));
  }
}
