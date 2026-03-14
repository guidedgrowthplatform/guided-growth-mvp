import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandStore } from '@/stores/commandStore';
import { ActionDispatcher } from '@/lib/services/action-dispatcher';
import { getDataService } from '@/lib/services/service-provider';
import { useToast } from '@/contexts/ToastContext';
import { speakPreAck } from '@/lib/services/tts-service';
import { haptic } from '@/lib/services/haptic-service';

// Lazy-init: wait for the correct data service (Supabase) before creating dispatcher
let _dispatcher: ActionDispatcher | null = null;
async function getDispatcher(): Promise<ActionDispatcher> {
  if (!_dispatcher) {
    const ds = await getDataService();
    _dispatcher = new ActionDispatcher(ds);
  }
  return _dispatcher;
}

// Word-number map for frequency parsing
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseWordNumber(str: string): number | null {
  const n = parseInt(str);
  if (!isNaN(n)) return n;
  return WORD_NUMBERS[str.toLowerCase()] ?? null;
}

function extractDate(text: string): string {
  if (text.includes('yesterday')) return 'yesterday';
  const dayMatch = text.match(/(?:for|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) return dayMatch[1].toLowerCase();
  return 'today';
}

// Simple local fallback when API is unavailable (e.g. local dev without vercel dev)
function localParse(transcript: string): { action: string; entity: string; params: Record<string, unknown>; confidence: number } {
  const t = transcript.toLowerCase().trim();

  // ─── HIGH PRIORITY: Check these FIRST to avoid false matches ───

  // Help (Issue #19) — must be before create/suggest
  if (t.match(/^help$|what can i|available commands|how.*use|what.*commands/)) {
    return { action: 'help', entity: 'command', params: {}, confidence: 0.95 };
  }

  // Suggest — must be before create ("suggest a new habit" contains "new habit")
  if (t.match(/suggest|recommend/)) {
    return { action: 'suggest', entity: 'habit', params: {}, confidence: 0.8 };
  }

  // Rename — must be before create/update
  if (t.match(/rename/)) {
    const m = t.match(/rename\s+(.+?)\s+to\s+(.+)/i);
    return { action: 'update', entity: 'habit', params: { name: m?.[1]?.trim() || '', newName: m?.[2]?.trim() || '' }, confidence: 0.7 };
  }

  // ─── CREATE ───

  // Create habit
  if (t.match(/create.*habits?|add.*habits?|new.*habits?/)) {
    const nameMatch =
      t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) ||    // "called X" / "named X"
      t.match(/habits?\s+(?:called|named|for)\s+(.+?)$/i) ||    // "habit called X"
      t.match(/(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:daily\s+)?(?:habits?\s+)?(.+?)(?:\s+habit)?$/i);
    let name = nameMatch?.[1]
      ?.replace(/^(?:a\s+|the\s+|new\s+|my\s+)/i, '')
      ?.replace(/\s+habits?$/i, '')
      ?.trim() || '';
    if (!name || name.length < 2) {
      return { action: 'create', entity: 'habit', params: { name: '', frequency: 'daily' }, confidence: 0.3 };
    }
    const freqMatch = t.match(/(\w+)\s*times?\s*(?:a|per)\s*week/i);
    const freqNum = freqMatch ? parseWordNumber(freqMatch[1]) : null;
    const frequency = freqNum ? `${freqNum}x/week` : 'daily';
    return { action: 'create', entity: 'habit', params: { name, frequency }, confidence: 0.7 };
  }

  // Create metric
  if (t.match(/create.*metric|add.*metric|new.*metric/)) {
    const nameMatch = t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) || t.match(/metric\s+(.+?)$/i);
    const name = nameMatch?.[1]?.trim() || '';
    const scaleMatch = t.match(/scale\s+(\d+)\s*to\s*(\d+)/i);
    return { action: 'create', entity: 'metric', params: { name, inputType: scaleMatch ? 'scale' : 'binary', scale: scaleMatch ? [Number(scaleMatch[1]), Number(scaleMatch[2])] : undefined }, confidence: 0.7 };
  }

  // ─── COMPLETE ───

  // "I did X" — natural language completion
  if (t.match(/^i did\s/)) {
    const nameMatch = t.match(/^i did\s+(.+?)$/i);
    const name = nameMatch?.[1]?.trim() || '';
    return { action: 'complete', entity: 'habit', params: { name, date: 'today' }, confidence: 0.7 };
  }

  // Complete / mark done
  if (t.match(/mark.*done|completed?\s/)) {
    const nameMatch = t.match(/(?:mark|completed?)\s+(.+?)(?:\s+(?:as\s+)?done|\s+for|$)/i);
    let name = nameMatch?.[1]
      ?.replace(/\s+(is|as|was|has been|has|been)\s*$/i, '')
      ?.replace(/\s+done.*/, '')
      ?.trim() || '';
    name = name.replace(/\s+(?:for\s+)?(?:yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*/i, '').trim();
    const date = extractDate(t);
    return { action: 'complete', entity: 'habit', params: { name, date }, confidence: 0.7 };
  }

  // ─── DELETE ───
  if (t.match(/delete|remove/)) {
    const nameMatch = t.match(/(?:delete|remove)\s+(?:the\s+)?(.+?)(?:\s+habit|\s+metric|$)/i);
    const name = nameMatch?.[1]?.trim() || '';
    return { action: 'delete', entity: t.includes('metric') ? 'metric' : 'habit', params: { name }, confidence: 0.7 };
  }

  // ─── LOG METRIC ───
  if (t.match(/log|record/)) {
    const nameMatch = t.match(/(?:log|record)\s+(?:my\s+)?(.+?)\s+(?:as|at)\s+(.+)/i);
    const name = nameMatch?.[1]?.trim() || '';
    const value = nameMatch ? parseFloat(nameMatch[2]) || nameMatch[2] : '';
    return { action: 'log', entity: 'metric', params: { name, value }, confidence: 0.6 };
  }

  // Natural metric logging: "my mood was 7 today"
  if (t.match(/^my\s+.+\s+(?:was|is)\s+\d/)) {
    const m = t.match(/^my\s+(.+?)\s+(?:was|is)\s+(\d+)/i);
    return { action: 'log', entity: 'metric', params: { name: m?.[1] || '', value: m ? Number(m[2]) : '' }, confidence: 0.6 };
  }

  // ─── QUERY ───
  if (t.match(/show|list|how.*doing|what.*my|what's/)) {
    const nameMatch = t.match(/(?:with|my|the)\s+(.+?)(?:\s+this|\s+habit|$|\?)/i);
    return { action: 'query', entity: t.includes('streak') ? 'habit' : t.includes('summary') ? 'summary' : 'habit', params: { name: nameMatch?.[1]?.trim(), period: t.includes('month') ? 'month' : 'week', ...(t.includes('streak') ? { metric: 'streak', sort: 'longest' } : {}) }, confidence: 0.6 };
  }

  // Summary
  if (t.match(/summary|report/)) {
    return { action: 'query', entity: 'summary', params: { period: 'week' }, confidence: 0.7 };
  }

  // ─── REFLECT ───
  // Only match genuine reflective statements, not commands that happen to contain "feel"
  // e.g. "I feel stressed" YES, "I feel like creating a habit" NO
  if (t.match(/^i (?:feel|felt|slept|am feeling|'m feeling)|^(?:feeling|slept|stressed|i'?m tired)/)) {
    const themes: string[] = [];
    if (t.includes('sleep') || t.includes('slept')) themes.push('sleep');
    if (t.includes('stress')) themes.push('stress');
    if (t.includes('tired') || t.includes('exhaust')) themes.push('fatigue');
    if (t.includes('anxious') || t.includes('anxiety')) themes.push('anxiety');
    if (t.includes('happy') || t.includes('great') || t.includes('amazing')) themes.push('positive');
    const mood = t.match(/terrible|terribly|bad|awful|stressed|anxious/) ? 'low' : t.match(/great|good|amazing|happy/) ? 'high' : 'neutral';
    return { action: 'reflect', entity: 'journal', params: { mood, themes }, confidence: 0.7 };
  }

  return { action: 'query', entity: 'habit', params: {}, confidence: 0.3 };
}

export function useVoiceCommand() {
  const navigate = useNavigate();
  const { addToast } = useToast();
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

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    setProcessing(true);
    const startTime = Date.now();

    try {
      let intent: { action: string; entity: string; params: Record<string, unknown>; confidence: number; latency?: number };

      // Try GPT-4o-mini API first
      try {
        const response = await fetch('/api/process-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          throw new Error('API unavailable');
        }

        intent = await response.json();

        // If GPT returns low confidence, check if local parser does better
        if (intent.confidence < 0.6) {
          const localIntent = localParse(transcript);
          if (localIntent.confidence > intent.confidence) {
            console.info(`[VoiceCommand] GPT low confidence (${intent.confidence}), using local parser (${localIntent.confidence})`);
            intent = localIntent;
            intent.latency = Date.now() - startTime;
          }
        }
      } catch {
        // Fallback to local keyword parser (works without API)
        console.warn('[VoiceCommand] API unavailable, using local parser');
        intent = localParse(transcript);
        intent.latency = Date.now() - startTime;
      }

      const apiLatency = intent.latency || (Date.now() - startTime);

      // Pre-acknowledgment TTS: immediate audio feedback before action runs
      speakPreAck(intent.action, intent.params as Record<string, unknown>);

      // Dispatch the action against the correct data service (Supabase or mock)
      const dispatcher = await getDispatcher();
      const result = await dispatcher.dispatch(intent);
      setResult(result, intent, apiLatency);
      addHistory(transcript, intent, result);

      // Show visual + audio + haptic feedback
      if (result.success) {
        haptic('success');
        addToast('success', result.message);
      } else {
        haptic('error');
        addToast('error', result.message);
      }

      // TTS talk-back is handled by VoiceTranscript.tsx (single source of TTS)
      // to avoid double speak() calls.

      // Navigate if needed
      if (result.uiAction === 'navigate' && result.navigateTo) {
        navigate(result.navigateTo);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addToast('error', `Command failed: ${msg}`);
    }
  }, [navigate, addToast, setProcessing, setResult, setError, addHistory]);

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
