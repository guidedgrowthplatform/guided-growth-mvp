import { useState } from 'react';
import { Icon } from '@iconify/react';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { Toggle } from '@/components/ui/Toggle';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// Evening palette: deep indigo-purple tones, warm and winding-down.
const EVENING_BG = 'rgba(67, 47, 120, 0.06)';
const EVENING_ICON_BG = 'rgba(67, 47, 120, 0.12)';
const EVENING_ICON_COLOR = 'rgb(100, 74, 185)';
const EVENING_BORDER = 'rgba(100, 74, 185, 0.15)';

type ReflectionStyle = 'guided' | 'custom' | 'freeform';

const DEFAULT_PROMPTS = ["I'm proud of...", "I forgive...", "I'm grateful for..."];

// Style choice pill, compact horizontal tabs that feel like a segmented control.
function StylePicker({
  value,
  onChange,
}: {
  value: ReflectionStyle;
  onChange: (v: ReflectionStyle) => void;
}) {
  const options: { id: ReflectionStyle; label: string; icon: string }[] = [
    { id: 'guided', label: 'Guided', icon: 'mdi:comment-question-outline' },
    { id: 'custom', label: 'Custom', icon: 'mdi:pencil-outline' },
    { id: 'freeform', label: 'Freeform', icon: 'mdi:microphone-outline' },
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
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? BLUE : 'rgb(100,116,139)',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 2px 8px -2px rgba(19,91,235,0.18)' : 'none',
              transition: 'all 160ms ease-out',
            }}
          >
            <Icon icon={opt.icon} width={15} height={15} style={{ flexShrink: 0 }} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Description card beneath the style picker: icon + title + subtitle.
function StyleDescription({ style }: { style: ReflectionStyle }) {
  const meta: Record<ReflectionStyle, { icon: string; title: string; sub: string }> = {
    guided: {
      icon: 'mdi:chat-question-outline',
      title: 'Guided prompts',
      sub: 'The coach asks you a set of questions each evening.',
    },
    custom: {
      icon: 'mdi:text-box-edit-outline',
      title: 'Custom prompts',
      sub: 'Write up to 3 prompts you want to answer every night.',
    },
    freeform: {
      icon: 'mdi:microphone-variant',
      title: 'Open mic',
      sub: 'Just speak freely, no prompts, no structure.',
    },
  };
  const m = meta[style];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 16,
        background: EVENING_BG,
        border: `1.5px solid ${EVENING_BORDER}`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: EVENING_ICON_BG,
        }}
      >
        <Icon icon={m.icon} width={20} height={20} style={{ color: EVENING_ICON_COLOR }} />
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'rgb(15,23,42)' }}>
          {m.title}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 500,
            color: 'rgb(100,116,139)',
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {m.sub}
        </div>
      </div>
    </div>
  );
}

// The full evening setup card: style picker + optional custom prompts + time + reminder.
function EveningSetupCard({
  style,
  onStyleChange,
  prompts,
  onPromptChange,
  time,
  onTimeChange,
  reminder,
  onReminderChange,
}: {
  style: ReflectionStyle;
  onStyleChange: (v: ReflectionStyle) => void;
  prompts: string[];
  onPromptChange: (i: number, v: string) => void;
  time: string;
  onTimeChange: (v: string) => void;
  reminder: boolean;
  onReminderChange: (v: boolean) => void;
}) {
  const [timeOpen, setTimeOpen] = useState(false);

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
          boxShadow:
            '0 10px 30px -5px rgba(100,74,185,0.10), 0 4px 12px -4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
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
            <div
              style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: 'rgb(15,23,42)' }}
            >
              Evening Reflection
            </div>
            <div
              style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 500, color: 'rgb(100,116,139)', marginTop: 2 }}
            >
              Wind down and close your day
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', marginLeft: -20, marginRight: -20 }} />

        {/* Style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: 'rgb(100,116,139)',
            }}
          >
            Reflection style
          </span>
          <StylePicker value={style} onChange={onStyleChange} />
          <StyleDescription style={style} />
        </div>

        {/* Custom prompts, visible only when style is 'custom' */}
        {style === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: 'rgb(100,116,139)',
              }}
            >
              Your prompts
            </span>
            {prompts.map((p, i) => (
              <OnboardingInput
                key={i}
                icon="mdi:format-quote-open"
                placeholder={DEFAULT_PROMPTS[i] ?? 'Add a prompt...'}
                value={p}
                onChange={(v) => onPromptChange(i, v)}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', marginLeft: -20, marginRight: -20 }} />

        {/* Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: 'rgb(100,116,139)',
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

        {/* Remind me toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
          }}
        >
          <div>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: 'rgb(15,23,42)' }}>
              Remind me
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: 'rgb(100,116,139)', marginTop: 1 }}>
              A nudge when it's time to wind down
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

function ReflectionCardBeat(props?: Record<string, string>) {
  const [style, setStyle] = useState<ReflectionStyle>('guided');
  const [prompts, setPrompts] = useState<string[]>(['', '', '']);
  const [time, setTime] = useState('21:30');
  const [reminder, setReminder] = useState(true);

  const handlePromptChange = (i: number, v: string) => {
    setPrompts((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        'Now your evening reflection. How do you want to do it, and when?',
    },
    {
      id: 'setup',
      speaker: 'coach',
      render: (
        <EveningSetupCard
          style={style}
          onStyleChange={setStyle}
          prompts={prompts}
          onPromptChange={handlePromptChange}
          time={time}
          onTimeChange={setTime}
          reminder={reminder}
          onReminderChange={setReminder}
        />
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const reflectionCardBeat: BeatDef = {
  type: 'reflection-card',
  group: 'Onboarding',
  label: 'Daily reflection',
  Comp: ReflectionCardBeat,
};

export default reflectionCardBeat;
