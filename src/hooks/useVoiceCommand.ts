import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCommandStore } from '@/stores/commandStore';
import { ActionDispatcher } from '@/lib/services/action-dispatcher';
import { getDataService } from '@/lib/services/service-provider';
import { useToast } from '@/contexts/ToastContext';
import { speakPreAck, speak } from '@/lib/services/tts-service';
import { haptic } from '@/lib/services/haptic-service';
import { queryKeys } from '@/lib/query';

// Lazy-init: wait for the correct data service (Supabase) before creating dispatcher
let _dispatcher: ActionDispatcher | null = null;
async function getDispatcher(): Promise<ActionDispatcher> {
  if (!_dispatcher) {
    const ds = await getDataService();
    _dispatcher = new ActionDispatcher(ds);
  }
  return _dispatcher;
}

// Simple local fallback when API is unavailable (e.g. local dev without vercel dev)
function localParse(transcript: string): { action: string; entity: string; params: Record<string, unknown>; confidence: number } {
  const t = transcript.toLowerCase().trim();

  // Create habit
  if (t.match(/create.*habits?|add.*habits?|new.*habits?/)) {
    // Try multiple patterns to extract the habit name
    const nameMatch =
      t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) ||    // "called X" / "named X"
      t.match(/habits?\s+(?:called|named|for)\s+(.+?)$/i) ||    // "habit called X"
      t.match(/(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:daily\s+)?(?:habits?\s+)?(.+?)(?:\s+habit)?$/i); // "add X" / "add new habit X" / "add new habits playing"
    let name = nameMatch?.[1]
      ?.replace(/^(?:a\s+|the\s+|new\s+|my\s+)/i, '')  // strip leading articles
      ?.replace(/\s+habits?$/i, '')                       // strip trailing "habit(s)"
      ?.trim() || '';
    // Reject empty or garbage names
    if (!name || name.length < 2) {
      return { action: 'create', entity: 'habit', params: { name: '', frequency: 'daily' }, confidence: 0.3 };
    }
    const freqMatch = t.match(/(\d+)\s*times?\s*(?:a|per)\s*week/i);
    const frequency = freqMatch ? `${freqMatch[1]}x/week` : 'daily';
    return { action: 'create', entity: 'habit', params: { name, frequency }, confidence: 0.7 };
  }

  // Create metric
  if (t.match(/create.*metric|add.*metric|new.*metric/)) {
    const nameMatch = t.match(/(?:called|named|for)\s+(.+?)(?:\s*,|$)/i) || t.match(/metric\s+(.+?)$/i);
    const name = nameMatch?.[1]?.trim() || '';
    const scaleMatch = t.match(/scale\s+(\d+)\s*to\s*(\d+)/i);
    return { action: 'create', entity: 'metric', params: { name, inputType: scaleMatch ? 'scale' : 'binary', scale: scaleMatch ? [Number(scaleMatch[1]), Number(scaleMatch[2])] : undefined }, confidence: 0.7 };
  }

  // Complete / mark done
  if (t.match(/mark.*done|completed?\s/)) {
    const nameMatch = t.match(/(?:mark|completed?)\s+(.+?)(?:\s+(?:as\s+)?done|\s+for|$)/i);
    const name = nameMatch?.[1]
      ?.replace(/\s+(is|as|was|has been|has|been)\s*$/i, '') // strip trailing "is/as/was"
      ?.replace(/\s+done.*/, '')
      ?.trim() || '';
    return { action: 'complete', entity: 'habit', params: { name, date: 'today' }, confidence: 0.7 };
  }

  // Delete
  if (t.match(/delete|remove/)) {
    const nameMatch = t.match(/(?:delete|remove)\s+(?:the\s+)?(.+?)(?:\s+habit|\s+metric|$)/i);
    const name = nameMatch?.[1]?.trim() || '';
    return { action: 'delete', entity: t.includes('metric') ? 'metric' : 'habit', params: { name }, confidence: 0.7 };
  }

  // Log metric
  if (t.match(/log|record/)) {
    const nameMatch = t.match(/(?:log|record)\s+(?:my\s+)?(.+?)\s+(?:as|at)\s+(.+)/i);
    const name = nameMatch?.[1]?.trim() || '';
    const value = nameMatch ? parseFloat(nameMatch[2]) || nameMatch[2] : '';
    return { action: 'log', entity: 'metric', params: { name, value }, confidence: 0.6 };
  }

  // Query / show
  if (t.match(/show|list|how.*doing|what.*my|what's/)) {
    const nameMatch = t.match(/(?:with|my|the)\s+(.+?)(?:\s+this|\s+habit|$|\?)/i);
    return { action: 'query', entity: t.includes('streak') ? 'habit' : t.includes('summary') ? 'summary' : 'habit', params: { name: nameMatch?.[1]?.trim(), period: t.includes('month') ? 'month' : 'week', ...(t.includes('streak') ? { metric: 'streak', sort: 'longest' } : {}) }, confidence: 0.6 };
  }

  // Summary
  if (t.match(/summary|report/)) {
    return { action: 'query', entity: 'summary', params: { period: 'week' }, confidence: 0.7 };
  }

  // Help (Issue #19)
  if (t.match(/^help$|what can i|available commands|how.*use|what.*commands/)) {
    return { action: 'help', entity: 'command', params: {}, confidence: 0.95 };
  }

  // Suggest
  if (t.match(/suggest|recommend/)) {
    return { action: 'suggest', entity: 'habit', params: {}, confidence: 0.8 };
  }

  // Reflect
  if (t.match(/feel|slept|stressed|tired|mood/)) {
    const themes: string[] = [];
    if (t.includes('sleep') || t.includes('slept')) themes.push('sleep');
    if (t.includes('stress')) themes.push('stress');
    if (t.includes('tired')) themes.push('fatigue');
    const mood = t.match(/terrible|terribly|bad|awful/) ? 'low' : t.match(/great|good|amazing/) ? 'high' : 'neutral';
    return { action: 'reflect', entity: 'journal', params: { mood, themes }, confidence: 0.6 };
  }

  return { action: 'query', entity: 'habit', params: {}, confidence: 0.3 };
}

export function useVoiceCommand() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const qc = useQueryClient();
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

      // Talk back: read the result message aloud (if TTS enabled)
      speak(result.message);

      // Invalidate queries so data refreshes after voice commands
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
      qc.invalidateQueries({ queryKey: queryKeys.entries.all });

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
