import { Send } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

// 2 lines @ 20px line-height; beyond this the textarea scrolls
const MAX_TEXTAREA_HEIGHT = 40;

export interface ChatComposerProps {
  onSubmit: (text: string) => void;
  value?: string;
  onValueChange?: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputId?: string;
  sendLabel?: string;
  leadingSlot?: ReactNode;
  className?: string;
  autoFocus?: boolean;
  ariaHidden?: boolean;
  tabbable?: boolean;
}

// Controlled when `value` provided; otherwise internal state.
// On submit: always clears internal state; if controlled, also calls onValueChange('').
export function ChatComposer({
  onSubmit,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Type a message…',
  inputId,
  sendLabel = 'Send message',
  leadingSlot,
  className,
  autoFocus,
  ariaHidden,
  tabbable = true,
}: ChatComposerProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState('');
  const current = isControlled ? (value as string) : internal;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setCurrent = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  // grow to fit content up to 2 lines, then scroll
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [current]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const trimmed = current.trim();
  const sendDisabled = disabled || !trimmed;

  const submit = () => {
    if (sendDisabled) return;
    onSubmit(trimmed);
    if (!isControlled) setInternal('');
    if (isControlled) onValueChange?.('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  // Enter sends; Shift+Enter inserts a newline
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      aria-hidden={ariaHidden}
      onSubmit={handleSubmit}
      className={
        className ??
        'flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]'
      }
    >
      {leadingSlot}
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={1}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        tabIndex={tabbable ? 0 : -1}
        className="flex-1 resize-none self-center overflow-y-auto bg-transparent text-[15px] leading-5 text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={sendDisabled}
        aria-label={sendLabel}
        className="flex h-8 w-8 shrink-0 items-center justify-center text-primary transition-opacity disabled:opacity-40"
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
}
