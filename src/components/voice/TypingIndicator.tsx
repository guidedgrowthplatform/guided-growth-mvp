export function TypingIndicator() {
  return (
    <div className="mb-3 mt-12 flex flex-col items-start">
      <div className="mb-1.5 flex items-center gap-1.5 pl-1">
        <span className="text-[12px] font-semibold tracking-[1.2px] text-[#616f89]">
          GUIDED GROWTH COACH
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-bl-2xl rounded-br-2xl rounded-tr-2xl bg-white px-5 py-5 shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.08)] backdrop-blur-[6px]">
        <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40 [animation-delay:150ms]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-[#0f172a]/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
