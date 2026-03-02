import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandStore } from '@/stores/commandStore';
import { ActionDispatcher } from '@/lib/services/action-dispatcher';
import { mockDataService } from '@/lib/services/mock-data-service';
import { useToast } from '@/contexts/ToastContext';

const dispatcher = new ActionDispatcher(mockDataService);

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

    try {
      // 1. Send transcript to GPT-4o-mini
      const response = await fetch('/api/process-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `API error: ${response.status}`);
      }

      const intent = await response.json();
      const apiLatency = intent.latency || 0;

      // 2. Dispatch the action against MockDataService
      const result = await dispatcher.dispatch(intent);
      setResult(result, intent, apiLatency);
      addHistory(transcript, intent, result);

      // 3. Show feedback
      if (result.success) {
        addToast('success', result.message);
      } else {
        addToast('error', result.message);
      }

      // 4. Navigate if needed
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
