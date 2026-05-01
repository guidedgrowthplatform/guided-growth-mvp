import { useEffect, useRef, useState } from 'react';

export interface FocusedFieldContext {
  name: string;
  value: string;
  type: string;
}

// Tracks the most recently focused element with a `data-voice-field` attribute.
// Sticky across blur events so the mic button taking focus doesn't erase the
// field context — caller decides when to clear (e.g. on transcript submit).
export function useFocusedFieldContext(): FocusedFieldContext | null {
  const [field, setField] = useState<FocusedFieldContext | null>(null);
  const stickyRef = useRef<FocusedFieldContext | null>(null);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const voiceFieldName = target.getAttribute('data-voice-field');
      if (!voiceFieldName) return;
      const value =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target.value
          : (target.textContent ?? '');
      const type = target instanceof HTMLInputElement ? target.type : 'text';
      const next: FocusedFieldContext = { name: voiceFieldName, value, type };
      stickyRef.current = next;
      setField(next);
    };

    const onInput = (event: Event) => {
      const sticky = stickyRef.current;
      if (!sticky) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.getAttribute('data-voice-field') !== sticky.name) return;
      const value =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target.value
          : (target.textContent ?? '');
      const next = { ...sticky, value };
      stickyRef.current = next;
      setField(next);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('input', onInput);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('input', onInput);
    };
  }, []);

  return field;
}
