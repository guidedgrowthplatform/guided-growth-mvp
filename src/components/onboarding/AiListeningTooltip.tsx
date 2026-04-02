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
      <div className="relative max-w-[280px] rounded-[20px] border border-primary/10 bg-white p-[20px] shadow-[0px_20px_40px_-8px_rgba(19,91,236,0.15),0px_8px_16px_-4px_rgba(0,0,0,0.08)]">
        <div className="mb-[12px] flex items-center gap-[10px]">
          <div
            className="size-[10px] rounded-full bg-primary"
            style={{
              animation: visible ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[11px] font-bold uppercase leading-[16px] tracking-[0.5px] text-primary">
            AI Listening
          </span>
        </div>
        <p className="text-[14px] font-medium leading-[20px] text-content-secondary">{text}</p>
        {/* Tooltip arrow */}
        <div className="absolute -bottom-[8px] right-[24px] flex items-center justify-center">
          <div className="size-[14px] rotate-45 border-b border-r border-primary/10 bg-white" />
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
