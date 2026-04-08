import { useEffect, useRef, useState } from 'react';

interface VoiceTooltipProps {
  /** Auto-dismiss after this many milliseconds (0 = never auto-dismiss) */
  autoDismissMs?: number;
  /** Called when tooltip is dismissed */
  onDismiss?: () => void;
}

/**
 * Tooltip shown above the mic button to hint that voice input is available.
 * Auto-dismisses after 4 seconds or when the user taps the mic.
 */
export function VoiceTooltip({ autoDismissMs = 4000, onDismiss }: VoiceTooltipProps) {
  const [isVisible, setIsVisible] = useState(true);
  // Keep the latest onDismiss in a ref so the effect below doesn't need
  // to include it in deps. Previously, callers passing an inline arrow
  // fn (`onDismiss={() => ...}`) re-triggered the effect on every parent
  // render, continuously resetting the timer — so the tooltip NEVER
  // auto-dismissed.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismissMs <= 0) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismissRef.current?.();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  if (!isVisible) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 duration-300">
      <div className="whitespace-nowrap rounded-[8px] border border-primary bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-[0_4px_12px_rgb(var(--color-primary)/0.15)]">
        Tap to record your answer
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
        <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-primary/10" />
      </div>
    </div>
  );
}
