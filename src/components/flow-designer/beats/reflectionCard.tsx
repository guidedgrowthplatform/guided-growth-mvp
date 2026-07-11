import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { WEEKDAYS, toggleSetItem } from '@/components/onboarding/constants';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import { BeatPlayer, Bloom, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY as BLUE, INK, SUBTLE } from './_beatStyle';

// Evening palette: deep indigo-purple tones, warm and winding-down.
const EVENING_BG = 'rgba(67, 47, 120, 0.06)';
const EVENING_ICON_BG = 'rgba(67, 47, 120, 0.12)';
const EVENING_ICON_COLOR = 'rgb(100, 74, 185)';
const EVENING_BORDER = 'rgba(100, 74, 185, 0.15)';

// Style names are locked to these exact strings everywhere in this file.
// The spec requires: "suggested template" | "your template" | "freeform"
type ReflectionStyle = 'suggested template' | 'your template' | 'freeform';

const DEFAULT_PROMPTS = ["I'm proud of...", 'I forgive...', "I'm grateful for..."];

// The suggested-template questions, shown as their own components (not a label) when
// the suggested template is chosen.
const SUGGESTED_PROMPTS = [
  'What am I proud of?',
  'What do I forgive myself for?',
  'What am I grateful for?',
];

// The three suggested prompts, each its own numbered card. Each blooms in turn as
// its clip plays (proud, then forgive, then grateful): prompt i shows at reveal > i.
function SuggestedPrompts({ reveal }: { reveal: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {SUGGESTED_PROMPTS.map((p, i) => (
        <Bloom key={i} show={reveal > i}>
          <div
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
            <span style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>
              {p}
            </span>
          </div>
        </Bloom>
      ))}
    </div>
  );
}

// Style choice pill, compact horizontal tabs that feel like a segmented control.
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

// Description card beneath the style picker: icon + title + subtitle.
function StyleDescription({ style }: { style: ReflectionStyle }) {
  const meta: Record<ReflectionStyle, { icon: string; title: string; sub: string }> = {
    'suggested template': {
      icon: 'mdi:chat-question-outline',
      title: 'Suggested template',
      sub: 'The coach walks you through a set of reflection questions each evening.',
    },
    'your template': {
      icon: 'mdi:text-box-edit-outline',
      title: 'Your template',
      sub: 'Write up to 3 prompts you want to answer every night.',
    },
    freeform: {
      icon: 'mdi:microphone-variant',
      title: 'Freeform',
      sub: 'Speak freely, no prompts, no structure. Whatever comes up.',
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
        <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>{m.title}</div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 500,
            color: SUBTLE,
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

// Editable prompt row for "your template" style.
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

// The full evening setup card: style picker + optional custom prompts + time + reminder.
function EveningSetupCard({
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
  // Reveal order: the three suggested questions bloom one by one (1, 2, 3), then
  // the "make your own / just talk freely" switcher (4), then the schedule blooms
  // in as the coach introduces it: days (5), time (6), reminder (7).
  const reveal = useElementReveal(7);

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

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'rgba(15,23,42,0.06)',
            marginLeft: -20,
            marginRight: -20,
          }}
        />

        {/* The reflection itself. The default is the three suggested questions,
            each blooming as its clip plays. "Make your own" swaps in editable
            prompts; "Just talk freely" swaps in a freeform box. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {style === 'suggested template' && <SuggestedPrompts reveal={reveal} />}

          {style === 'your template' && (
            <Bloom show={reveal > 0}>
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
            </Bloom>
          )}

          {style === 'freeform' && (
            <Bloom show={reveal > 0}>
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
            </Bloom>
          )}
        </div>

        {/* Or make your own, or just talk freely: the switcher sits under the
            questions, so the suggested three lead and the alternatives follow. */}
        <Bloom show={reveal > 3}>
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
        </Bloom>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'rgba(15,23,42,0.06)',
            marginLeft: -20,
            marginRight: -20,
          }}
        />

        {/* Days */}
        <Bloom show={reveal > 4}>
          <div style={{ padding: '4px 0' }}>
            <DayPicker selectedDays={days} onToggleDay={onToggleDay} />
          </div>
        </Bloom>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'rgba(15,23,42,0.06)',
            marginLeft: -20,
            marginRight: -20,
          }}
        />

        {/* Time */}
        <Bloom show={reveal > 5}>
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
        </Bloom>

        {/* Remind me toggle. Reminder is ON by default per spec. */}
        <Bloom show={reveal > 6}>
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
        </Bloom>
      </div>

      {timeOpen && (
        <TimePickerSheet value={time} onChange={onTimeChange} onClose={() => setTimeOpen(false)} />
      )}
    </>
  );
}

function ReflectionCardBeat(props?: Record<string, string>) {
  const flow = useFlowState();

  // Default style is "suggested template". Reminder starts ON per spec.
  const [style, setStyle] = useState<ReflectionStyle>('suggested template');
  const [prompts, setPrompts] = useState<string[]>(['', '', '']);
  const [days, setDays] = useState<Set<number>>(new Set(WEEKDAYS));
  const [time, setTime] = useState('21:30');
  const [reminder, setReminder] = useState(true);
  const toggleDay = (d: number) => setDays((p) => toggleSetItem(p, d));

  // Lift the chosen evening time to shared flow state so the plan recap and
  // home tour show the real time the user set, not a placeholder.
  useEffect(() => {
    flow?.setEveningTime(time);
    // react to time only; flow is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

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
        'One more. An evening reflection, a minute and a half to close out your day. Use these three questions, make it your own, or just talk freely.',
    },
  ];
  // Optional second coach bubble (the time recommendation, before bed).
  if (props?.coachLine2) {
    steps.push({ id: 'ask2', speaker: 'coach', say: props.coachLine2 });
  }
  steps.push({
    id: 'setup',
    speaker: 'coach',
    render: (
      <EveningSetupCard
        style={style}
        onStyleChange={setStyle}
        prompts={prompts}
        onPromptChange={handlePromptChange}
        days={days}
        onToggleDay={toggleDay}
        time={time}
        onTimeChange={setTime}
        reminder={reminder}
        onReminderChange={setReminder}
      />
    ),
  });

  return <BeatPlayer steps={steps} />;
}

const reflectionCardBeat: BeatDef = {
  type: 'reflection-card',
  group: 'Onboarding',
  label: 'Evening reflection setup',
  Comp: ReflectionCardBeat,
};

export default reflectionCardBeat;
