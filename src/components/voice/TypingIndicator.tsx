export function TypingIndicator() {
  return (
    <div className="mb-4 flex flex-col items-start">
      <div className="mb-1.5 flex items-center gap-1.5 pl-1">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-[12px] font-semibold tracking-[1.2px] text-primary">
          AI ASSISTANT
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-bl-2xl rounded-br-2xl rounded-tr-2xl border border-primary/20 bg-primary/50 px-5 py-4 backdrop-blur-[6px]">
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
