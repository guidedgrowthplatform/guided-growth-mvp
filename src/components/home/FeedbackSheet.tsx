import { Icon } from '@iconify/react';
import { useState } from 'react';
import { track } from '@/analytics';
import { submitFeedback } from '@/api/feedback';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';

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

  const handleSubmit = async () => {
    if (!sentiment) return;
    const trimmed = text.trim();
    setSubmitting(true);
    try {
      await submitFeedback({ sentiment, text: trimmed });
      track('submit_feedback', {
        sentiment,
        feedback_length_chars: trimmed.length,
        input_method: 'text',
      });
      addToast('success', 'Thanks for your feedback!');
      onClose();
    } catch {
      addToast('error', 'Failed to submit feedback. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-6 pt-2" style={{ paddingBottom: '150px' }}>
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

        {/* Text Input */}
        <textarea
          className="mt-6 w-full resize-none rounded-2xl border border-border-light bg-surface p-5 text-sm text-content placeholder:text-content-tertiary focus:border-primary focus:outline-none focus:ring-0"
          rows={4}
          placeholder="Type your feedback..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!sentiment || submitting}
          className="mt-6 w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition-opacity active:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </BottomSheet>
  );
}
