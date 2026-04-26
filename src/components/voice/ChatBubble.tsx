interface ChatBubbleProps {
  role: 'user' | 'ai';
  text: string;
  userName?: string;
  animate?: boolean;
  eyebrowVariant?: 'light' | 'dark';
}

export function ChatBubble({
  role,
  text,
  userName,
  animate = true,
  eyebrowVariant = 'light',
}: ChatBubbleProps) {
  const isUser = role === 'user';
  const isLightBackdrop = eyebrowVariant === 'dark';
  const userEyebrowColor = isLightBackdrop ? 'text-[#616f89]' : 'text-[rgba(255,255,255,0.4)]';
  const userBubbleSurface = isLightBackdrop
    ? 'bg-white shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.08)]'
    : 'bg-white';

  return (
    <div
      className={`flex flex-col ${isUser ? 'mb-3 mt-[24px] items-end' : 'mt-[48px] items-start'}`}
    >
      <div className={`flex items-center px-[16px] ${isUser ? 'justify-end' : ''}`}>
        {!isUser && <div className="size-[8px] rounded-full bg-[#135bec]" />}
        <span
          className={`text-[12px] font-semibold uppercase leading-[16px] tracking-[1.2px] ${
            isUser ? userEyebrowColor : 'pl-[8px] text-[#135bec]'
          }`}
        >
          {isUser ? userName || 'YOU' : 'GUIDED GROWTH COACH'}
        </span>
      </div>

      <div className="pt-[8px]">
        <div
          className={`max-w-[290px] backdrop-blur-[6px] ${
            isUser
              ? `rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px] py-[14px] pl-[21px] pr-[23px] ${userBubbleSurface}`
              : 'rounded-bl-[16px] rounded-br-[16px] rounded-tr-[16px] bg-[rgba(19,91,236,0.8)] py-[14px] pl-[21px] pr-[30px]'
          } ${animate ? 'animate-bubble-in' : ''}`}
        >
          <p
            className={
              isUser
                ? 'text-[14px] font-medium leading-[29.25px] text-[#0f172a]'
                : 'text-[14px] font-semibold leading-[27.5px] text-white'
            }
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
