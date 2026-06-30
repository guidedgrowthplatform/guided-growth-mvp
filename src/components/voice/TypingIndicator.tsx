// The coach "thinking" bubble. Matches the onboarding flow's ThinkingDots
// (BeatPlayer.tsx): a tight white coach bubble with three bouncing dots and no
// eyebrow label, so the loading state reads the same everywhere (home coach,
// onboarding overlay, flow designer).
export function TypingIndicator() {
  return (
    <div className="mb-3 mt-12 flex flex-col items-start">
      <div
        className="flex w-fit animate-fade-in items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.12)]"
        aria-label="Coach is thinking"
      >
        <span className="h-2 w-2 animate-bounce rounded-full bg-content/40" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-content/40 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-content/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
