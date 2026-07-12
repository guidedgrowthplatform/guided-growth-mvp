import { Icon } from '@iconify/react';
import { useState } from 'react';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';

// UI-side reflection style, kept as a 3-way choice for the evening chrome. The
// adapter maps it to the 2-value ReflectionMode ('prompts' | 'freeform') + the
// customPrompts payload at the persistence seam.
export type ReflectionStyle = 'suggested template' | 'your template' | 'freeform';

const FONT = "Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BLUE = 'rgb(19,91,235)';
const INK = 'rgb(15,23,42)';
const SUBTLE = 'rgb(100,116,139)';

// Evening palette: deep indigo-purple tones, warm and winding-down.
const EVENING_BG = 'rgba(67, 47, 120, 0.06)';
const EVENING_ICON_BG = 'rgba(67, 47, 120, 0.12)';
const EVENING_ICON_COLOR = 'rgb(100, 74, 185)';
const EVENING_BORDER = 'rgba(100, 74, 185, 0.15)';

const SUGGESTED_PROMPTS = [
  'What am I proud of?',
  'What do I forgive myself for?',
  'What am I grateful for?',
];
const DEFAULT_PROMPTS = ["I'm proud of...", 'I forgive...', "I'm grateful for..."];

function SuggestedPrompts() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {SUGGESTED_PROMPTS.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 15px',
            borderRadius: 14,
            background: EVENING_BG,
            border: `1.5px solid ${EVENING_BORDER}`,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: EVENING_ICON_BG,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 800,
              color: EVENING_ICON_COLOR,
            }}
          >
            {i + 1}
          </div>
          <span style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>{p}</span>
        </div>
      ))}
    </div>
  );
}

function StylePicker({
  value,
  onChange,
}: {
  value: ReflectionStyle;
  onChange: (v: ReflectionStyle) => void;
}) {
  const options: { id: ReflectionStyle; label: string; icon: string }[] = [
    { id: 'suggested template', label: 'Suggested', icon: 'mdi:comment-question-outline' },
    { id: 'your template', label: 'Make your own', icon: 'mdi:pencil-outline' },
    { id: 'freeform', label: 'Just talk freely', icon: 'mdi:microphone-outline' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        background: 'rgba(15,23,42,0.05)',
        borderRadius: 16,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '9px 4px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              color: active ? BLUE : 'rgb(100,116,139)',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 2px 8px -2px rgba(19,91,235,0.18)' : 'none',
              transition: 'all 160ms ease-out',
              lineHeight: 1.25,
              textAlign: 'center',
            }}
          >
            <Icon icon={opt.icon} width={13} height={13} style={{ flexShrink: 0 }} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PromptInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        borderRadius: 14,
        background: EVENING_BG,
        border: `1.5px solid ${EVENING_BORDER}`,
      }}
    >
      <Icon
        icon="mdi:format-quote-open"
        width={16}
        height={16}
        style={{ color: EVENING_ICON_COLOR, flexShrink: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 500,
          color: INK,
          outline: 'none',
        }}
      />
    </div>
  );
}

// The evening reflection setup chrome: style picker (suggested / your template /
// freeform), the matching prompt surface, then day picker + time + reminder. The
// freeform textarea is a visual placeholder only; the reflection itself is
// captured later, not in this setup card.
export function EveningReflectionCard({
  style,
  onStyleChange,
  prompts,
  onPromptChange,
  days,
  onToggleDay,
  time,
  onTimeChange,
  reminder,
  onReminderChange,
}: {
  style: ReflectionStyle;
  onStyleChange: (v: ReflectionStyle) => void;
  prompts: string[];
  onPromptChange: (i: number, v: string) => void;
  days: Set<number>;
  onToggleDay: (d: number) => void;
  time: string;
  onTimeChange: (v: string) => void;
  reminder: boolean;
  onReminderChange: (v: boolean) => void;
}) {
  const [timeOpen, setTimeOpen] = useState(false);
  const divider = (
    <div
      style={{ height: 1, background: 'rgba(15,23,42,0.06)', marginLeft: -20, marginRight: -20 }}
    />
  );
  return (
    <>
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          borderRadius: 24,
          padding: '22px 20px',
          background: '#fff',
          border: `1.5px solid ${EVENING_BORDER}`,
          boxShadow: '0 4px 16px -4px rgba(100,74,185,0.12), 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: EVENING_ICON_BG,
            }}
          >
            <Icon
              icon="mdi:weather-night"
              width={24}
              height={24}
              style={{ color: EVENING_ICON_COLOR }}
            />
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: INK }}>
              Evening Reflection
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 13.5,
                fontWeight: 500,
                color: SUBTLE,
                marginTop: 2,
              }}
            >
              Wind down and close your day
            </div>
          </div>
        </div>

        {divider}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {style === 'suggested template' && <SuggestedPrompts />}
          {style === 'your template' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {prompts.map((p, i) => (
                <PromptInput
                  key={i}
                  placeholder={DEFAULT_PROMPTS[i] ?? 'Add a prompt...'}
                  value={p}
                  onChange={(v) => onPromptChange(i, v)}
                />
              ))}
            </div>
          )}
          {style === 'freeform' && (
            <textarea
              rows={5}
              placeholder="Whatever comes up tonight..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: `1.5px solid ${EVENING_BORDER}`,
                background: EVENING_BG,
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 500,
                color: INK,
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.55,
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: SUBTLE,
            }}
          >
            Or make it your own
          </span>
          <StylePicker value={style} onChange={onStyleChange} />
        </div>

        {divider}

        <div style={{ padding: '4px 0' }}>
          <DayPicker selectedDays={days} onToggleDay={onToggleDay} />
        </div>

        {divider}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: SUBTLE,
            }}
          >
            When?
          </span>
          <button
            type="button"
            onClick={() => setTimeOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '14px 20px',
              borderRadius: 18,
              border: `1.5px solid ${BLUE}`,
              background: 'rgba(19,91,235,0.04)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: BLUE }}>
              {formatTime12(time)}
            </span>
            <Icon icon="mdi:clock-outline" width={20} height={20} style={{ color: BLUE }} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
          }}
        >
          <div>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>
              Remind me
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 12.5,
                fontWeight: 500,
                color: SUBTLE,
                marginTop: 1,
              }}
            >
              {reminder ? `Notification at ${formatTime12(time)}` : 'Notifications off'}
            </div>
          </div>
          <Toggle checked={reminder} onChange={onReminderChange} />
        </div>
      </div>

      {timeOpen && (
        <TimePickerSheet value={time} onChange={onTimeChange} onClose={() => setTimeOpen(false)} />
      )}
    </>
  );
}
