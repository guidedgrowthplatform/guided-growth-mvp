/**
 * Instant onboarding opener. Speaks one short coach line via Cartesia HTTP and
 * resolves when the audio has finished playing.
 *
 * Used only by the ONBOARDING_INSTANT_OPENER path (see config/voice.ts). The
 * goal is to hide Vapi's cold-start latency: the moment the first Vapi-covered
 * beat becomes active, this speaks the beat's opener (with the user's name) over
 * Cartesia while Vapi connects silently in the background. The mic is held until
 * BOTH this audio has ended AND Vapi is connected.
 *
 * This deliberately does NOT route through tts-service's chunked coach-turn
 * queue: that queue is owned by the Direct-LLM / coach-chat path and gated by
 * isVoiceOutEnabled(). The opener is a single one-shot line that must play even
 * when the standalone voice-out gate is off (Vapi owns the turn, so speakReplies
 * is false). It hits the same /api/cartesia-tts endpoint, which already defaults
 * to the aligned Pro Voice Clone V1 voice on sonic-3.5, matching Vapi exactly.
 */
import { Capacitor } from '@capacitor/core';
import { COACH_VOICE_ID } from '@/config/voiceConfig';
import { sessionReady, supabase } from '@/lib/supabase';

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
    console.error('[opener] VITE_API_URL not set, opener TTS will fail on native');
  }
  return '';
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    // Native session hydration can lag app launch; await it so the very first
    // call right after sign-in doesn't ship a null session (mirrors tts-service).
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
    // Continue without auth (the endpoint may run in bypass mode in dev).
  }
  return {};
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export interface SpeakOpenerHandle {
  // Resolves when the audio finishes (ended), errors, or is stopped. Never
  // rejects, so the caller's mic-gate coordination is simple: await, then gate.
  done: Promise<void>;
  // Stop playback immediately (e.g. the beat changed or the user barged in).
  stop: () => void;
}

/**
 * Synthesize and play one opener line. Returns a handle whose `done` resolves
 * when playback ends (or fails, since a failed opener must never strand the mic
 * closed, so the caller treats "done" as "opener no longer pending"). Resolves
 * immediately for empty text.
 */
export function speakOpener(text: string): SpeakOpenerHandle {
  const clean = text.trim();
  if (!clean) {
    return { done: Promise.resolve(), stop: () => {} };
  }

  const abort = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let settled = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const settle = () => {
    if (settled) return;
    settled = true;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* noop */
      }
      audio = null;
    }
    resolveDone();
  };

  const stop = () => {
    abort.abort();
    settle();
  };

  void (async () => {
    try {
      const authHeaders = await getAuthHeaders();
      if (abort.signal.aborted) return settle();
      const res = await fetch(`${getApiBase()}/api/cartesia-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          text: clean,
          voice_id: COACH_VOICE_ID,
          ...(Capacitor.isNativePlatform() ? { format: 'base64' } : {}),
        }),
        signal: abort.signal,
      });
      if (abort.signal.aborted) return settle();
      if (!res.ok) {
        console.warn('[opener] Cartesia opener error:', res.status);
        return settle();
      }
      const blob = Capacitor.isNativePlatform()
        ? base64ToBlob(((await res.json()) as { audio: string }).audio, 'audio/mpeg')
        : await res.blob();
      if (abort.signal.aborted) return settle();

      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      el.volume = 0.85;
      audio = el;
      const cleanupUrl = () => URL.revokeObjectURL(url);
      el.onended = () => {
        cleanupUrl();
        settle();
      };
      el.onerror = () => {
        cleanupUrl();
        settle();
      };
      try {
        await el.play();
      } catch (err) {
        // Autoplay rejection (iOS) or stale stop. Never strand the mic closed.
        console.warn('[opener] opener playback blocked/failed:', err);
        cleanupUrl();
        settle();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return settle();
      }
      console.warn('[opener] opener synthesis failed:', err);
      settle();
    }
  })();

  return { done, stop };
}
