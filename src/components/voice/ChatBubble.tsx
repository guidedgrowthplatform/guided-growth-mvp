interface ChatBubbleProps {
  role: 'user' | 'ai';
  text: string;
  userName?: string;
  animate?: boolean;
}

export function ChatBubble({ role, text, userName, animate = true }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3`}>
      <div className={`mb-1.5 flex items-center gap-1.5 ${isUser ? 'pr-1' : 'pl-1'}`}>
        {!isUser && <div className="h-2 w-2 rounded-full bg-primary" />}
        <span
          className={`text-[12px] font-semibold tracking-[1.2px] ${
            isUser ? 'text-white/40' : 'text-primary'
          }`}
        >
          {isUser ? (userName || 'YOU').toUpperCase() : 'AI ASSISTANT'}
        </span>
      </div>

      <div
        className={`max-w-[260px] px-3.5 py-2.5 backdrop-blur-[6px] ${
          isUser
            ? 'rounded-bl-2xl rounded-br-2xl rounded-tl-2xl border border-white/10 bg-white/10'
            : 'rounded-bl-2xl rounded-br-2xl rounded-tr-2xl border border-primary/20 bg-primary/50'
        } ${animate ? 'animate-bubble-in' : ''}`}
      >
        <p
          className={
            isUser
              ? 'text-[15px] font-medium leading-[22px] text-white'
              : 'text-[16px] font-semibold leading-[23px] text-white'
          }
        >
          {text}
        </p>
      </div>
    </div>
  );
}
