import { Icon } from '@iconify/react';
import { useState, useCallback, useEffect } from 'react';
import { submitFeedback } from '@/api/feedback';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';
import {
  startElevenLabs,
  stopAndTranscribe,
  stopElevenLabs,
} from '@/lib/services/elevenlabs-service';

type Sentiment = 'love' | 'ok' | 'needs-work';

const SENTIMENTS: { key: Sentiment; icon: string; label: string }[] = [
  { key: 'love', icon: 'mdi:heart-outline', label: 'LOVE IT' },
  { key: 'ok', icon: 'mdi:emoticon-happy-outline', label: "IT'S OK" },
  { key: 'needs-work', icon: 'mdi:wrench-outline', label: 'NEEDS WORK' },
];

interface FeedbackSheetProps {
  onClose: () => void;
}

export function FeedbackSheet({ onClose }: FeedbackSheetProps) {
  const { addToast } = useToast();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Cleanup mic on unmount (e.g. drag-to-close while recording)
  useEffect(() => {
    return () => {
      stopElevenLabs();
    };
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      // Stop and transcribe
      setRecording(false);
      setTranscribing(true);
      try {
        const transcript = await stopAndTranscribe();
        if (transcript) {
          setText((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        }
      } catch {
        addToast('error', 'Transcription failed. Please try again.');
      } finally {
        setTranscribing(false);
      }
      return;
    }

    // Start recording
    try {
      await startElevenLabs({
        onOpen: () => setRecording(true),
        onError: (error) => {
          setRecording(false);
          addToast('error', error || 'Voice recording failed.');
        },
      });
    } catch {
      setRecording(false);
      addToast('error', 'Could not access microphone.');
    }
  }, [recording, addToast]);

  const handleClose = () => {
    if (recording) stopElevenLabs();
    onClose();
  };

  const handleSubmit = async () => {
    if (!sentiment) return;
    let finalText = text;
    // Transcribe any active recording before submitting
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const transcript = await stopAndTranscribe();
        if (transcript) {
          finalText = finalText ? `${finalText} ${transcript.trim()}` : transcript.trim();
        }
      } catch {
        /* proceed with existing text */
      }
      setTranscribing(false);
    }
    setSubmitting(true);
    try {
      await submitFeedback({ sentiment, text: finalText.trim() });
      addToast('success', 'Thanks for your feedback!');
      onClose();
    } catch {
      addToast('error', 'Failed to submit feedback. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet onClose={handleClose}>
      <div className="px-6 pb-8 pt-2">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-content">How&apos;s your experience?</h2>
          <p className="mt-2 text-sm text-content-secondary">
            Tell us about any part of the app that is not working correctly or you&apos;ve a
            suggestion how to improve it
          </p>
          <p className="mt-1 text-sm font-medium text-content-secondary">
            Your Feedback helps us grow.
          </p>
        </div>

        {/* Sentiment Selector */}
        <div className="mt-6 flex justify-center gap-6">
          {SENTIMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSentiment(s.key)}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-colors ${
                  sentiment === s.key
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent bg-surface-secondary'
                }`}
              >
                <Icon
                  icon={s.icon}
                  width={28}
                  height={28}
                  className={sentiment === s.key ? 'text-primary' : 'text-content-tertiary'}
                />
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  sentiment === s.key ? 'text-primary' : 'text-content-tertiary'
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* Voice Note */}
        <div className="mt-6 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={transcribing}
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-colors disabled:opacity-50 ${
              recording ? 'animate-pulse bg-red-500' : 'bg-primary'
            }`}
          >
            {transcribing ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Icon
                icon={recording ? 'mdi:stop' : 'mdi:microphone'}
                width={28}
                height={28}
                className="text-white"
              />
            )}
          </button>
          <span className="text-sm font-medium text-primary">
            {transcribing ? 'Transcribing...' : recording ? 'Tap to stop' : 'Leave us a voice note'}
          </span>
        </div>

        {/* Text Input */}
        <textarea
          className="mt-6 w-full resize-none rounded-2xl border-none bg-surface-secondary p-5 text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:ring-0"
          rows={3}
          placeholder="Or type your feedback..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!sentiment || submitting || transcribing}
          className="mt-6 w-full rounded-full bg-primary py-4 text-lg font-bold text-white shadow-[0px_8px_24px_rgba(19,91,236,0.3)] transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </BottomSheet>
  );
}
