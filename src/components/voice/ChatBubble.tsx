import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { safeStreamPrefix } from '@/lib/markdown/parse';

interface ChatBubbleProps {
  role: 'user' | 'ai';
  text: string;
  userName?: string;
  animate?: boolean;
  eyebrowVariant?: 'light' | 'dark';
  compact?: boolean;
  streaming?: boolean;
  markdown?: boolean;
}

function StreamingText({ text }: { text: string }) {
  if (text.length === 0) return null;
  return (
    <>
      {text.slice(0, -1)}
      <span key={text.length} className="animate-fade-in">
        {text.slice(-1)}
      </span>
    </>
  );
}

export function ChatBubble({
  role,
  text,
  userName,
  animate = true,
  eyebrowVariant = 'light',
  compact = false,
  streaming = false,
  markdown = false,
}: ChatBubbleProps) {
  const isUser = role === 'user';
  const isLightBackdrop = eyebrowVariant === 'dark';
  const userEyebrowColor = isLightBackdrop ? 'text-[#616f89]' : 'text-[rgba(255,255,255,0.4)]';
  const userBubbleSurface = isLightBackdrop
    ? 'bg-white shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.08)]'
    : 'bg-white';

  const wrapperMargins = compact
    ? isUser
      ? 'mb-2 mt-[12px] items-end'
      : 'mt-[20px] items-start'
    : isUser
      ? 'mb-3 mt-[24px] items-end'
      : 'mt-[48px] items-start';

  const eyebrowPadTop = compact ? 'pt-[6px]' : 'pt-[8px]';

  const bubblePad = compact
    ? isUser
      ? 'py-[10px] pl-[18px] pr-[20px]'
      : 'py-[10px] pl-[18px] pr-[24px]'
    : isUser
      ? 'py-[14px] pl-[21px] pr-[23px]'
      : 'py-[14px] pl-[21px] pr-[30px]';

  const textLeading = compact
    ? 'leading-[20px]'
    : isUser
      ? 'leading-[29.25px]'
      : 'leading-[27.5px]';

  const textClasses = isUser
    ? `text-[14px] font-medium ${textLeading} text-white`
    : `text-[14px] font-semibold ${textLeading} text-[#0f172a]`;

  return (
    <div className={`flex flex-col ${wrapperMargins}`}>
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

      <div className={eyebrowPadTop}>
        <div
          className={`max-w-[290px] backdrop-blur-[6px] ${
            isUser
              ? `rounded-bl-[16px] rounded-br-[16px] rounded-tl-[16px] bg-[rgba(19,91,236,0.85)] ${bubblePad}`
              : `rounded-bl-[16px] rounded-br-[16px] rounded-tr-[16px] ${bubblePad} ${userBubbleSurface}`
          } ${animate ? 'animate-bubble-in' : ''}`}
        >
          {markdown ? (
            <div className={textClasses}>
              <MarkdownMessage text={streaming ? safeStreamPrefix(text) : text} />
            </div>
          ) : (
            <p className={textClasses}>{streaming ? <StreamingText text={text} /> : text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
