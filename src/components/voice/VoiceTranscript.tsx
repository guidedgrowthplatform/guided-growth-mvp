import { Pencil } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';

export function VoiceTranscript() {
  const { isListening, transcript, interim, resetTranscript } = useVoiceInput();
  const { processTranscript, isProcessing, lastResult, lastIntent, latency, clearResult } =
    useVoiceCommand();
  const setTranscript = useVoiceStore((s) => s.setTranscript);
  const lastProcessedRef = useRef('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-process transcript when user stops speaking (silence detection triggers stop)
  useEffect(() => {
    if (!isListening && transcript && transcript !== lastProcessedRef.current) {
      lastProcessedRef.current = transcript;
      processTranscript(transcript);
    }
  }, [isListening, transcript, processTranscript]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (lastResult && !isProcessing && !isListening) {
      const timer = setTimeout(() => {
        resetTranscript();
        clearResult();
        lastProcessedRef.current = '';
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastResult, isProcessing, isListening, resetTranscript, clearResult]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditStart = () => {
    setEditedText(transcript);
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    if (editedText.trim()) {
      setTranscript(editedText.trim());
      lastProcessedRef.current = editedText.trim();
      processTranscript(editedText.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditSubmit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  if (!isListening && !transcript && !lastResult) return null;

  return (
    <div className="fixed bottom-24 left-4 right-20 z-50 lg:bottom-6 lg:left-auto lg:right-24 lg:w-80">
      <div className="relative rounded-xl border border-border bg-surface p-3 shadow-elevated backdrop-blur-sm">
        <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-b border-r border-border bg-surface" />
        {/* Status */}
        {isListening && (
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            <span className="text-xs font-semibold uppercase tracking-wide text-danger">
              Listening...
            </span>
            <span className="ml-auto text-[10px] text-content-tertiary">
              auto-stops after silence
            </span>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="mb-2 flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs font-semibold text-primary">Processing command...</span>
          </div>
        )}

        {/* Transcript — editable */}
        {transcript && !isEditing && (
          <div className="group mb-2 text-sm leading-relaxed text-content">
            <div className="flex items-start gap-1">
              <p className="flex-1 italic">"{transcript}"</p>
              <button
                onClick={handleEditStart}
                className="flex-shrink-0 p-1 text-[10px] text-primary underline opacity-100 transition-opacity hover:text-primary lg:opacity-0 lg:group-hover:opacity-100"
                title="Edit transcript before reprocessing"
              >
                <Pencil className="inline h-3 w-3" /> Edit
              </button>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div className="mb-2">
            <input
              ref={inputRef}
              type="text"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Edit your command..."
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={handleEditSubmit}
                className="rounded bg-primary px-2 py-0.5 text-xs text-white hover:bg-primary-dark"
              >
                Reprocess
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-content-tertiary underline hover:text-content-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live interim text */}
        {isListening && interim && (
          <p className="mt-1 text-sm italic text-content-tertiary">{interim}...</p>
        )}

        {/* Prompt when listening but no transcript yet */}
        {isListening && !transcript && !interim && (
          <p className="text-xs italic text-content-tertiary">Speak now...</p>
        )}

        {/* Command Result */}
        {lastResult && !isProcessing && (
          <div
            className={`mt-2 rounded-lg p-2 text-xs ${
              lastResult.success
                ? 'border border-success/20 bg-success/10 text-success'
                : 'border border-danger/20 bg-danger/10 text-danger'
            }`}
          >
            <p className="whitespace-pre-line font-medium">{lastResult.message}</p>
            {lastIntent && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] opacity-70">
                <span className="rounded bg-white/60 px-1.5 py-0.5">{lastIntent.action}</span>
                <span className="rounded bg-white/60 px-1.5 py-0.5">{lastIntent.entity}</span>
                <span>{Math.round(lastIntent.confidence * 100)}%</span>
                {latency && <span>{latency}ms</span>}
              </div>
            )}
          </div>
        )}

        {/* Dismiss */}
        {(transcript || lastResult) && (
          <button
            onClick={() => {
              resetTranscript();
              clearResult();
              lastProcessedRef.current = '';
              setIsEditing(false);
            }}
            className="mt-2 text-xs text-content-tertiary underline hover:text-content-secondary"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
