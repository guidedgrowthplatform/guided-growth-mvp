import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { STT_CORRECTIONS } from '@/lib/config/voice';
import { queryKeys } from '@/lib/query';
import { ActionDispatcher } from '@/lib/services/action-dispatcher';
import { haptic } from '@/lib/services/haptic-service';
import { getDataService } from '@/lib/services/service-provider';
import { speak } from '@/lib/services/tts-service';
import { supabase, sessionReady } from '@/lib/supabase';
import { useCommandStore } from '@/stores/commandStore';
import { useVoiceStore } from '@/stores/voiceStore';

// ─── STT Correction Dictionary ──────────────────────────────────────────────
// Dictionary lives in src/lib/config/voice.ts so domain vocabulary can be
// edited centrally. Applied before parsing so the intent matcher sees clean
// input.
// TODO(voice-layer): Alejandro suggested moving fuzzy intent matching into
// an LLM-backed module; tracked for Phase 2.

/** Fix common STT misrecognitions before intent parsing */
function correctTranscript(text: string): string {
  let corrected = text;
  for (const [wrong, right] of Object.entries(STT_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
  }
  return corrected;
}

// Module-level state survives React remounts — prevents double-fire across
// overlay close/reopen cycles and React StrictMode double-invocation.
let _processing = false;

// Always get a fresh dispatcher with the current (non-mock) DataService.
// Never cache — prevents stale mock reference if Supabase loads after first call.
async function getDispatcher(): Promise<ActionDispatcher> {
  const ds = await getDataService();
  return new ActionDispatcher(ds);
}

const MUTATION_ACTIONS = new Set(['create', 'complete', 'delete', 'update', 'log', 'checkin']);

function getApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[VoiceCommand] VITE_API_URL not set — API calls will fail on native');
  }
  return '';
}

export function localParse(transcript: string): {
  action: string;
  entity: string;
  params: Record<string, unknown>;
  confidence: number;
} {
  const t = transcript.toLowerCase().trim();

  if (t.match(/create.*habits?|add.*habits?|new.*habits?/)) {
    const nameMatch =
      t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) ||
      t.match(/habits?\s+(?:called|named|for)\s+(.+?)$/i) ||
      t.match(
        /(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:daily\s+)?(?:habits?\s+)?(.+?)(?:\s+habit)?$/i,
      );
    const freqMatch = t.match(/(\d+)\s*times?\s*(?:a|per)\s*week/i);
    const frequency = freqMatch ? `${freqMatch[1]}x/week` : 'daily';
    const name =
      nameMatch?.[1]
        ?.replace(/^(?:a\s+|the\s+|new\s+|my\s+)/i, '')
        ?.replace(/\s+habits?$/i, '')
        ?.replace(/\s*\d+\s*times?\s*(?:a|per)\s*week.*/i, '')
        ?.trim() || '';
    if (!name || name.length < 2) {
      return {
        action: 'create',
        entity: 'habit',
        params: { name: '', frequency: 'daily' },
        confidence: 0.3,
      };
    }
    return { action: 'create', entity: 'habit', params: { name, frequency }, confidence: 0.7 };
  }

  if (t.match(/create.*metric|add.*metric|new.*metric/)) {
    const nameMatch =
      t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) || t.match(/metric\s+(.+?)$/i);
    const name = nameMatch?.[1]?.replace(/\s*scale\s+\d+\s*to\s*\d+.*/i, '')?.trim() || '';
    const scaleMatch = t.match(/scale\s+(\d+)\s*to\s*(\d+)/i);
    return {
      action: 'create',
      entity: 'metric',
      params: {
        name,
        inputType: scaleMatch ? 'scale' : 'binary',
        scale: scaleMatch ? [Number(scaleMatch[1]), Number(scaleMatch[2])] : undefined,
      },
      confidence: 0.7,
    };
  }

  if (t.match(/mark.*done|completed?\s/)) {
    const nameMatch = t.match(/(?:mark|completed?)\s+(.+?)(?:\s+(?:as\s+)?done|\s+for|$)/i);
    const name =
      nameMatch?.[1]
        ?.replace(/\s+(is|as|was|has been|has|been)\s*$/i, '') // strip trailing "is/as/was"
        ?.replace(/\s+done.*/, '')
        ?.trim() || '';
    return {
      action: 'complete',
      entity: 'habit',
      params: { name, date: 'today' },
      confidence: 0.7,
    };
  }

  if (t.match(/delete|remove/)) {
    const nameMatch = t.match(/(?:delete|remove)\s+(?:the\s+)?(.+?)(?:\s+habit|\s+metric|$)/i);
    const name = nameMatch?.[1]?.trim() || '';
    return {
      action: 'delete',
      entity: t.includes('metric') ? 'metric' : 'habit',
      params: { name },
      confidence: 0.7,
    };
  }

  if (t.match(/log|record/)) {
    const nameMatch =
      t.match(/(?:log|record)\s+(?:my\s+)?(.+?)\s+(?:as|at)\s+(.+)/i) ||
      t.match(/(?:log|record)\s+(?:my\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*$/i);
    const name = nameMatch?.[1]?.trim() || '';
    const value = nameMatch ? parseFloat(nameMatch[2]) || nameMatch[2] : '';
    return { action: 'log', entity: 'metric', params: { name, value }, confidence: 0.6 };
  }

  if (t.match(/show|list|how.*doing|how's|what.*my|what's/)) {
    const nameMatch = t.match(/(?:with|my|the)\s+(.+?)(?:\s+this|\s+habit|$|\?)/i);
    return {
      action: 'query',
      entity: t.includes('streak') ? 'habit' : t.includes('summary') ? 'summary' : 'habit',
      params: {
        name: nameMatch?.[1]?.trim(),
        period: t.includes('month') ? 'month' : 'week',
        ...(t.includes('streak') ? { metric: 'streak', sort: 'longest' } : {}),
      },
      confidence: 0.6,
    };
  }

  if (t.match(/summary|report/)) {
    return { action: 'query', entity: 'summary', params: { period: 'week' }, confidence: 0.7 };
  }

  if (t.match(/^help$|what can i|available commands|how.*use|what.*commands/)) {
    return { action: 'help', entity: 'command', params: {}, confidence: 0.95 };
  }

  if (t.match(/suggest|recommend/)) {
    return { action: 'suggest', entity: 'habit', params: {}, confidence: 0.8 };
  }

  // Check-in: "check in sleep 4 mood 3 energy 5 stress 2"
  if (t.match(/check\s*-?\s*in/)) {
    const sleep = t.match(/sleep\s+(\d+)/)?.[1];
    const mood = t.match(/mood\s+(\d+)/)?.[1];
    const energy = t.match(/energy\s+(\d+)/)?.[1];
    const stress = t.match(/stress\s+(\d+)/)?.[1];
    return {
      action: 'checkin',
      entity: 'checkin',
      params: {
        sleep: sleep ? Number(sleep) : null,
        mood: mood ? Number(mood) : null,
        energy: energy ? Number(energy) : null,
        stress: stress ? Number(stress) : null,
      },
      confidence: 0.8,
    };
  }

  // Timer aliases: "start timer for 5 minutes", "set timer 10 minutes", "timer 5 minutes"
  if (t.match(/(?:start|begin|set)\s+(?:a\s+)?timer|^timer\s/)) {
    const durationMatch = t.match(/(?:for\s+)?(\d+)\s*(?:minutes?|mins?|seconds?|secs?)/);
    const duration = durationMatch ? Number(durationMatch[1]) : 25;
    return {
      action: 'focus',
      entity: 'focus',
      params: { duration, habit: null },
      confidence: 0.85,
    };
  }

  // Focus: "start focus session for 25 minutes" or "start focus on meditation for 25 minutes"
  if (t.match(/(?:start|begin)\s+focus/)) {
    const durationMatch = t.match(/(?:for\s+)?(\d+)\s*(?:minutes?|mins?)/);
    const habitMatch = t.match(/focus\s+(?:on|session\s+on)\s+(.+?)(?:\s+for\s+\d+|\s*$)/);
    const duration = durationMatch ? Number(durationMatch[1]) : 25;
    const habit = habitMatch?.[1]?.replace(/\s+session.*/, '').trim() || null;
    return {
      action: 'focus',
      entity: 'focus',
      params: { duration, habit },
      confidence: 0.8,
    };
  }

  // Journal quick entry: "journal I had a productive morning"
  if (t.match(/^journal\s+/)) {
    const content = t.replace(/^journal\s+/, '').trim();
    return {
      action: 'reflect',
      entity: 'journal',
      params: { mood: 'neutral', themes: [], content },
      confidence: 0.7,
    };
  }

  if (t.match(/feel|slept|stressed|tired|mood/)) {
    const themes: string[] = [];
    if (t.includes('sleep') || t.includes('slept')) themes.push('sleep');
    if (t.includes('stress')) themes.push('stress');
    if (t.includes('tired')) themes.push('fatigue');
    const mood = t.match(/terrible|terribly|bad|awful/)
      ? 'low'
      : t.match(/great|good|amazing/)
        ? 'high'
        : 'neutral';
    return { action: 'reflect', entity: 'journal', params: { mood, themes }, confidence: 0.6 };
  }

  return { action: 'query', entity: 'habit', params: {}, confidence: 0.3 };
}

export function useVoiceCommand() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const {
    isProcessing,
    lastResult,
    lastIntent,
    latency,
    error,
    setProcessing,
    setResult,
    setError,
    clearResult,
    addHistory,
  } = useCommandStore();

  const processTranscript = useCallback(
    async (rawTranscript: string) => {
      if (!rawTranscript.trim()) return;
      // Module-level guard — survives remounts, prevents concurrent dispatches
      if (_processing) return;

      const rawClean = rawTranscript.replace(/\s{2,}/g, ' ').trim();
      if (!rawClean) return;
      // Apply STT corrections before parsing (e.g. "matrix" → "metric")
      const transcript = correctTranscript(rawClean);

      _processing = true;
      setProcessing(true);
      const startTime = Date.now();

      try {
        let intent: {
          action: string;
          entity: string;
          params: Record<string, unknown>;
          confidence: number;
          latency?: number;
          corrected_transcript?: string;
        };

        const dispatcher = await getDispatcher();

        try {
          const ds = dispatcher.getDataService();
          const habits = await ds.getHabits().catch(() => []);
          const existingHabits = habits.map((h: { name: string }) => h.name);

          // Get auth token for production API calls
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          try {
            // Native session is async — await sessionReady so a voice
            // command issued immediately at app launch doesn't race the
            // Capacitor Preferences loader and 401.
            if (Capacitor.isNativePlatform()) {
              await sessionReady;
            }
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          } catch {
            /* continue without auth */
          }

          const response = await fetch(`${getApiBase()}/api/process-command`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ transcript, existingHabits }),
          });

          const contentType = response.headers.get('content-type') || '';
          if (!response.ok || !contentType.includes('application/json')) {
            throw new Error('API unavailable');
          }

          intent = await response.json();

          if (intent.corrected_transcript) {
            useVoiceStore.getState().setCorrectedTranscript(intent.corrected_transcript);
          }
        } catch {
          console.warn('[VoiceCommand] API unavailable, using local parser');
          intent = localParse(transcript);
          intent.latency = Date.now() - startTime;
        }

        const apiLatency = intent.latency || Date.now() - startTime;

        const result = await dispatcher.dispatch(intent);
        setResult(result, intent, apiLatency);
        addHistory(transcript, intent, result);

        haptic(result.success ? 'success' : 'error');

        speak(result.message);

        // Handle navigation from voice commands (e.g., "start focus" → /focus)
        if (result.navigateTo) {
          // Pass voice command data via route state (e.g., focus duration)
          const navState: Record<string, unknown> = {};
          if (intent.action === 'focus' && intent.params.duration) {
            navState.duration = Number(intent.params.duration);
            navState.autoStart = true;
          }
          // Small delay so TTS starts playing before the page transitions
          setTimeout(() => {
            navigate(result.navigateTo!, { state: navState });
          }, 600);
        }

        // Only invalidate/refresh on mutation actions (not query/help/suggest)
        if (MUTATION_ACTIONS.has(intent.action)) {
          qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
          qc.invalidateQueries({ queryKey: queryKeys.entries.all });
          qc.invalidateQueries({ queryKey: queryKeys.habits.all });
          // Use LOCAL date, not UTC — matches the date the dispatcher
          // saved against (see formatLocalDate in action-dispatcher.ts).
          // Previously toISOString().slice(0,10) returned UTC, which on
          // morning hours in Asia/Jakarta would invalidate yesterday's
          // cache key while the new check-in was stored under today.
          const _now = new Date();
          const _localDate = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
          qc.invalidateQueries({
            queryKey: queryKeys.checkins.byDate(_localDate),
          });
          qc.invalidateQueries({ queryKey: queryKeys.journal.all });
          qc.invalidateQueries({ queryKey: queryKeys.focusSessions.all });

          // Notify non-React-Query components (e.g. HabitsSection) to refresh
          window.dispatchEvent(new CustomEvent('habits-changed'));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        _processing = false;
        setProcessing(false);
      }
    },
    [setProcessing, setResult, setError, addHistory, qc, navigate],
  );

  return {
    processTranscript,
    isProcessing,
    lastResult,
    lastIntent,
    latency,
    error,
    clearResult,
  };
}
