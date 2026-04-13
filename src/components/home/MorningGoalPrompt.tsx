import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { track } from '@/lib/analytics';
import { speak, stopTTS, unlockTTS } from '@/lib/services/tts-service';

/**
 * MCHECK-02: Morning goal voice prompt.
 *
 * Voice Journey CSV spec:
 * After morning check-in submitted, AI asks:
 * "Anything specific you want to make happen today? A goal we can check back on tonight?"
 *
 * Goal is saved to localStorage for evening reference (ECHECK-04).
 */

interface MorningGoalPromptProps {
  onClose: () => void;
}

export function MorningGoalPrompt({ onClose }: MorningGoalPromptProps) {
  const { user } = useAuth();
  const displayName = user?.nickname || user?.name?.split(' ')[0] || 'there';

  const { isListening, start, stop, transcript, resetTranscript } = useVoiceInput();
  const [goalText, setGoalText] = useState('');
  const [answered, setAnswered] = useState(false);
  const hasSpoken = useRef(false);
  const lastTranscript = useRef('');

  // Speak the goal prompt on mount
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    unlockTTS();
    speak('Anything specific you want to make happen today? A goal we can check back on tonight?');
  }, []);

  // Process voice transcript
  useEffect(() => {
    if (!transcript || transcript === lastTranscript.current || isListening) return;
    lastTranscript.current = transcript;

    const text = transcript.toLowerCase().trim();

    // Check if user declined
    const declined =
      /^(no|nah|nope|i.?m good|not today|nothing|skip)$/i.test(text) || text.length < 4;

    if (declined) {
      setAnswered(true);
      track('morning_goal', { has_goal: false });
      speak(`All good. Have a great day, ${displayName}.`);
      setTimeout(() => onClose(), 3000);
    } else {
      setGoalText(transcript);
      setAnswered(true);
      localStorage.setItem('gg_morning_goal', transcript);
      track('morning_goal', { has_goal: true, goal_text_length: transcript.length });
      speak(`Got it, ${transcript}. I'll ask you about it tonight.`);
      setTimeout(() => onClose(), 4000);
    }

    resetTranscript();
  }, [transcript, isListening, resetTranscript, displayName, onClose]);

  const handleMicPress = useCallback(() => {
    unlockTTS();
    if (isListening) {
      stop();
    } else {
      stopTTS();
      lastTranscript.current = '';
      resetTranscript();
      start();
    }
  }, [isListening, start, stop, resetTranscript]);

  const handleSkip = useCallback(() => {
    stopTTS();
    speak(`All good. Have a great day, ${displayName}.`);
    setAnswered(true);
    setTimeout(() => onClose(), 3000);
  }, [displayName, onClose]);

  return (
    <div className="rounded-2xl border border-border-light bg-gradient-to-br from-surface to-[#f0f5ff] p-5 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        {/* AI message */}
        <div className="text-center">
          <p className="text-sm font-medium text-content-secondary">
            {answered
              ? goalText
                ? `Goal set: "${goalText}"`
                : "No goal today — that's OK!"
              : 'Anything specific you want to make happen today?'}
          </p>
        </div>

        {!answered && (
          <div className="flex items-center gap-3">
            {/* Mic button */}
            <button
              onClick={handleMicPress}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isListening
                  ? 'bg-[#fdd017] shadow-md'
                  : 'bg-primary shadow-[0px_4px_6px_-1px_rgba(65,105,225,0.2)]'
              }`}
            >
              <Icon
                icon={isListening ? 'ic:round-mic' : 'ic:round-mic-off'}
                width={20}
                height={20}
                className={isListening ? 'text-content' : 'text-white'}
              />
            </button>

            {/* Skip button */}
            <button
              onClick={handleSkip}
              className="rounded-full border border-border-light bg-surface px-4 py-2.5 text-sm font-medium text-content-secondary"
            >
              Skip
            </button>
          </div>
        )}

        {isListening && (
          <p className="animate-pulse text-xs font-medium text-primary">Listening...</p>
        )}
      </div>
    </div>
  );
}
