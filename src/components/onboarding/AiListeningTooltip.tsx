interface AiListeningTooltipProps {
  text: string;
  visible: boolean;
}

export function AiListeningTooltip({ text, visible }: AiListeningTooltipProps) {
  return (
    <div
      className="flex flex-col items-end pb-[8px]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
        transition: visible
          ? 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'opacity 200ms ease-in, transform 200ms ease-in',
        transformOrigin: 'bottom right',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div className="relative max-w-[240px] rounded-[16px] border border-[#135bec] bg-white p-[17px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
        <div className="mb-[10px] flex items-center gap-[8px]">
          <div
            className="size-[8px] rounded-full bg-primary"
            style={{
              animation: visible ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[10px] font-bold uppercase leading-none tracking-[1px] text-primary">
            AI Listening
          </span>
        </div>
        <p className="text-[14px] font-medium leading-[20px] text-[#475569]">{text}</p>
        <div className="absolute -bottom-[8px] right-[20px]">
          <div className="size-[14px] rotate-45 border-b border-r border-[#135bec] bg-white" />
        </div>
      </div>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
