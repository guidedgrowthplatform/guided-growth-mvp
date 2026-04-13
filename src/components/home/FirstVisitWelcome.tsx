import { useCallback, useEffect, useRef, useState } from 'react';
import { speak, stopTTS, unlockTTS } from '@/lib/services/tts-service';

/**
 * HOME-FIRST: First visit after onboarding.
 *
 * Voice Journey CSV spec:
 * "Here's your home. This is where you'll check in every day.
 *  Would you like me to explain the different parts?"
 * YES → explains check-in, habits, mic
 * NO → "Got it. If you ever want a walkthrough, just ask."
 */

interface FirstVisitWelcomeProps {
  onDismiss: () => void;
}

const INTRO_TEXT =
  "Here's your home. This is where you'll check in every day. Would you like me to explain the different parts?";

const EXPLANATION_TEXT =
  "At the top you'll see your check-in. That's where you report how you're feeling each morning. " +
  'Below that are your habits for today. You can tap the checkmark when you complete one, ' +
  'or tell me about it during your evening check-in. ' +
  "The mic button in the center is where you can talk to me anytime. And that's really it. Simple.";

const DECLINE_TEXT =
  'Got it. If you ever want a walkthrough, just ask. Your first morning check-in is ready whenever you are.';

export function FirstVisitWelcome({ onDismiss }: FirstVisitWelcomeProps) {
  const [showButtons, setShowButtons] = useState(true);
  const [explaining, setExplaining] = useState(false);
  const hasSpoken = useRef(false);

  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    unlockTTS();
    speak(INTRO_TEXT);
  }, []);

  const handleYes = useCallback(() => {
    stopTTS();
    setShowButtons(false);
    setExplaining(true);
    speak(EXPLANATION_TEXT);
    // Auto-dismiss after explanation (~15 sec)
    setTimeout(() => {
      setExplaining(false);
      onDismiss();
    }, 16000);
  }, [onDismiss]);

  const handleNo = useCallback(() => {
    stopTTS();
    setShowButtons(false);
    speak(DECLINE_TEXT);
    setTimeout(() => onDismiss(), 4000);
  }, [onDismiss]);

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-[#f0f5ff] to-[#dbeafe] p-5 shadow-sm">
      <p className="text-center text-sm font-medium text-content">
        {explaining
          ? 'Check-in at top. Habits below. Mic button to talk anytime.'
          : 'Welcome to your home screen.'}
      </p>

      {showButtons && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleYes}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Yes, explain
          </button>
          <button
            onClick={handleNo}
            className="flex-1 rounded-full border border-border-light bg-surface py-2.5 text-sm font-semibold text-content-secondary"
          >
            I got it
          </button>
        </div>
      )}

      {explaining && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2.5 w-1 animate-pulse rounded-full bg-primary"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-content-tertiary">Explaining...</span>
        </div>
      )}
    </div>
  );
}
