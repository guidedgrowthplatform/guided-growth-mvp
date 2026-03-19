import { useRef, useCallback } from 'react';
import { getCellColor, getCellDisplayValue } from '@/utils/cellColors';
import type { Metric } from '@shared/types';

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
  onQuickToggle?: (date: string, metricId: string, value: string) => void;
}

export function SpreadsheetCell({
  date,
  metric,
  value,
  isSelected,
  isEditing,
  editValue,
  onEditChange,
  onClick,
  onMouseDown,
  onDoubleClick,
  onEditSave,
  onEditCancel,
  onFillHandleStart,
  onQuickToggle,
}: SpreadsheetCellProps) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const color = getCellColor(value, metric);
  const display = getCellDisplayValue(value, metric);

  const isTextType = metric.input_type === 'text' || metric.input_type === 'short_text';

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Binary cells: single-click toggles empty → yes → no → empty
      if (metric.input_type === 'binary' && onQuickToggle) {
        const nextValue = !value || value === '' ? 'yes' : value === 'yes' ? 'no' : '';
        onQuickToggle(date, metric.id, nextValue);
        return;
      }
      onClick(e);
    },
    [metric, value, date, onQuickToggle, onClick],
  );

  const handleDoubleClick = useCallback(() => {
    // On touch, non-binary cells open popup on single tap (handled via onClick/select flow)
    if (cellRef.current) onDoubleClick(cellRef.current);
  }, [onDoubleClick]);

  return (
    <td
      ref={cellRef}
      data-date={date}
      data-metric-id={metric.id}
      className={`relative h-[44px] min-w-[32px] cursor-pointer select-none border-l border-border px-1 py-1 text-center text-xs sm:h-auto ${color} ${isSelected ? 'z-10 ring-2 ring-inset ring-primary' : ''} `}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing && isTextType ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEditSave();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onEditCancel();
            }
            e.stopPropagation();
          }}
          onBlur={onEditSave}
          className="absolute inset-0 z-20 h-full w-full border-2 border-primary bg-surface text-center text-xs outline-none"
        />
      ) : (
        <>
          <span data-cell-value className="block truncate">
            {display || ''}
          </span>
          {metric.input_type === 'numeric' && metric.target_value != null && value && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (parseFloat(value) / metric.target_value) * 100)}%`,
                }}
              />
            </div>
          )}
          {isSelected && (
            <>
              <div className="cell-selected-overlay" />
              <div className="cell-selected-fill-handle" onMouseDown={onFillHandleStart} />
            </>
          )}
        </>
      )}
    </td>
  );
}
