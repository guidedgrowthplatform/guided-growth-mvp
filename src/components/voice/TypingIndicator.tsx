export function TypingIndicator() {
  return (
    <div className="mb-3 mt-12 flex flex-col items-start">
      <div className="mb-1.5 flex items-center gap-1.5 pl-1">
        <div className="h-2 w-2 rounded-full bg-[#135bec]" />
        <span className="text-[12px] font-semibold tracking-[1.2px] text-[#135bec]">
          AI ASSISTANT
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-bl-2xl rounded-br-2xl rounded-tr-2xl border border-[rgba(19,91,236,0.2)] bg-[rgba(19,91,236,0.5)] px-5 py-5 backdrop-blur-[6px]">
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
