import { Send } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

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

  const setCurrent = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const trimmed = current.trim();
  const sendDisabled = disabled || !trimmed;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sendDisabled) return;
    onSubmit(trimmed);
    if (!isControlled) setInternal('');
    if (isControlled) onValueChange?.('');
  };

  return (
    <form
      aria-hidden={ariaHidden}
      onSubmit={handleSubmit}
      className={
        className ??
        'flex h-[44px] w-full items-center gap-2 rounded-full bg-white pl-5 pr-3 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]'
      }
    >
      {leadingSlot}
      <input
        id={inputId}
        type="text"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        tabIndex={tabbable ? 0 : -1}
        className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={sendDisabled}
        aria-label={sendLabel}
        className="flex h-8 w-8 items-center justify-center text-primary transition-opacity disabled:opacity-40"
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
}
