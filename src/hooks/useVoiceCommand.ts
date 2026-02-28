import { useCallback } from 'react';
import { useCommandStore } from './useCommandStore';

/**
 * Hook that processes voice transcripts into structured commands via GPT-4o-mini.
 * Call processTranscript() with the final transcript text after the user stops speaking.
 */
export function useVoiceCommand() {
    const {
        isProcessing,
        lastResult,
        latencyMs,
        error,
        history,
        setProcessing,
        setResult,
        setError,
        clearResult,
        clearHistory,
    } = useCommandStore();

    const processTranscript = useCallback(
        async (transcript: string) => {
            if (!transcript.trim()) return;

            setProcessing(true);
            clearResult();

            try {
                const res = await fetch('/api/process-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: transcript.trim() }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Failed to process command');
                    return;
                }

                if (data.result) {
                    setResult(data.result, data.result.latencyMs || 0, transcript.trim());
                } else {
                    setError('No result from command processor');
                }
            } catch (err) {
                setError(`${err}`);
            }
        },
        [setProcessing, setResult, setError, clearResult]
    );

    return {
        processTranscript,
        isProcessing,
        lastResult,
        latencyMs,
        error,
        history,
        clearResult,
        clearHistory,
    };
}
