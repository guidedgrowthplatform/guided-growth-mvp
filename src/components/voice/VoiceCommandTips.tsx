import { useState, useEffect, useCallback } from 'react';

const TIPS = [
  "Try: 'Create a habit called meditation'",
  "Try: 'Log my morning run'",
  "Try: 'How am I doing this week?'",
  "Try: 'Start a 25-minute focus session'",
  "Try: 'Show my habit streaks'",
] as const;

export function VoiceCommandTips() {
  const [tipIndex, setTipIndex] = useState(0);

  const rotateTip = useCallback(() => {
    setTipIndex((prev) => (prev + 1) % TIPS.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(rotateTip, 4000);
    return () => clearInterval(interval);
  }, [rotateTip]);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F0FF] px-3 py-1.5">
      <span className="text-sm" role="img" aria-label="sparkle">
        ✨
      </span>
      <span className="text-xs font-semibold text-primary">{TIPS[tipIndex]}</span>
    </div>
  );
}
