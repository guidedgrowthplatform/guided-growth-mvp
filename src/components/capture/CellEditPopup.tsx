import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Metric } from '@shared/types';

interface CellEditPopupProps {
  position: { x: number; y: number } | null;
  metric: Metric | null;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function CellEditPopup({ position, metric, value, onChange, onSave, onCancel }: CellEditPopupProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (position && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [position]);

  if (!position || !metric) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    e.stopPropagation();
  };

  const isMobile = window.innerWidth < 640;
  const style = isMobile
    ? { left: Math.min(position.x - 75, window.innerWidth - 170), top: position.y + 30, minWidth: 150 }
    : { left: position.x, top: position.y, minWidth: 150 };

  return createPortal(
    <div
      className="fixed z-50 glass rounded-lg shadow-xl border border-cyan-300/50 p-2"
      style={style}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onSave}
        className="w-full px-2 py-1 text-sm border border-cyan-300/50 rounded bg-white/90 resize-none outline-none focus:ring-2 focus:ring-cyan-400"
        rows={metric.input_type === 'binary' || metric.input_type === 'numeric' ? 1 : 3}
      />
      <div className="flex gap-1 mt-1 justify-end">
        <button onClick={onCancel} className="px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100/50 rounded">Esc</button>
        <button onClick={onSave} className="px-2 py-0.5 text-xs text-cyan-600 hover:bg-cyan-50/50 rounded">Enter</button>
      </div>
    </div>,
    document.body
  );
}
