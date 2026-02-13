import { useRef } from 'react';
import type { Metric } from '@shared/types';
import { getCellColor, getCellDisplayValue } from '@/utils/cellColors';

interface SpreadsheetCellProps {
  date: string;
  metric: Metric;
  value: string | undefined;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (cellEl: HTMLElement) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onFillHandleStart: (e: React.MouseEvent) => void;
}

export function SpreadsheetCell({
  date, metric, value, isSelected, isEditing, editValue, onEditChange,
  onClick, onMouseDown, onDoubleClick, onEditSave, onEditCancel, onFillHandleStart,
}: SpreadsheetCellProps) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const color = getCellColor(value, metric);
  const display = getCellDisplayValue(value, metric);

  const isTextType = metric.input_type === 'text' || metric.input_type === 'short_text';

  return (
    <td
      ref={cellRef}
      data-date={date}
      data-metric-id={metric.id}
      className={`relative px-1 py-1 text-center text-xs border-l border-cyan-200/30 cursor-pointer select-none min-w-[32px] ${color}
        ${isSelected ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}
      `}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDoubleClick={() => cellRef.current && onDoubleClick(cellRef.current)}
    >
      {isEditing && isTextType ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onEditSave(); }
            if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); }
            e.stopPropagation();
          }}
          onBlur={onEditSave}
          className="absolute inset-0 w-full h-full text-xs text-center bg-white border-2 border-blue-500 z-20 outline-none"
        />
      ) : (
        <>
          <span data-cell-value className="block truncate">{display || ''}</span>
          {isSelected && (
            <>
              <div className="cell-selected-overlay" />
              <div
                className="cell-selected-fill-handle"
                onMouseDown={onFillHandleStart}
              />
            </>
          )}
        </>
      )}
    </td>
  );
}
