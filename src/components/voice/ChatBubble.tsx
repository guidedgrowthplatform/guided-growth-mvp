interface ChatBubbleProps {
  role: 'user' | 'ai';
  text: string;
  userName?: string;
  animate?: boolean;
}

export function ChatBubble({ role, text, userName, animate = true }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'mb-3 items-end' : 'mt-[48px] items-start'}`}>
      <div className={`flex items-center px-[16px] ${isUser ? 'justify-end' : ''}`}>
        {!isUser && <div className="size-[8px] rounded-full bg-[#135bec]" />}
        <span
          className={`text-[12px] font-semibold uppercase tracking-[1.2px] ${
            isUser ? 'text-[rgba(255,255,255,0.4)]' : 'pl-[8px] text-[#135bec]'
          }`}
        >
          {isUser ? userName || 'YOU' : 'AI ASSISTANT'}
        </span>
      </div>

      <div className="pt-[8px]">
        <div
          className={`max-w-[290px] backdrop-blur-[6px] ${
            isUser
              ? 'rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px] border border-[rgba(255,255,255,0.1)] bg-white py-[21px] pl-[21px] pr-[23px]'
              : 'rounded-bl-[16px] rounded-br-[16px] rounded-tr-[16px] border border-[rgba(19,91,236,0.2)] bg-[rgba(19,91,236,0.5)] py-[21px] pl-[21px] pr-[30px]'
          } ${animate ? 'animate-bubble-in' : ''}`}
        >
          <p
            className={
              isUser
                ? 'text-[18px] font-medium leading-[29.25px] text-[#282828]'
                : 'text-[20px] font-semibold leading-[27.5px] text-white'
            }
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
