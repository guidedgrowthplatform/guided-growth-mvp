/**
 * Presentational pieces for the home-tour engine adapter.
 *
 * Ported from the flow-designer beat (src/components/flow-designer/beats/homeTour.tsx),
 * stripped of its designer-only deps (beatKit / flowStateCtx). These render the
 * reconstructed home (not the live HomePage) plus the tour's inline overlay
 * mechanics: Reveal, the coach caption, the chat peek, and the open/close chat.
 *
 * NO EM DASHES in this file.
 */
import { Icon } from '@iconify/react';
import { useState, type ReactNode } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { SectionHeader } from '@/components/home/SectionHeader';
import { formatTime12 } from '@/components/ui/TimePicker';

export const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const BLUE = 'rgb(19, 91, 235)';

// The reveal beats, in order. Index drives the reveal level; LIVE is the finished
// home with the caption gone.
export const TOUR_STAGES = ['land', 'connect', 'reveal', 'chat', 'live'] as const;
export type TourStage = (typeof TOUR_STAGES)[number];

export function stageIndex(s?: string): number {
  const i = TOUR_STAGES.indexOf((s ?? 'live') as TourStage);
  // unknown / unset => the finished home
  return i < 0 ? TOUR_STAGES.length - 1 : i;
}

export type HabitScheduleCfg = { days: number[]; time: string; reminder: boolean };

// Fallback plan shown when no upstream selection exists (the tour is static sample data).
export const SAMPLE_HABITS = ['Morning walk', 'Read 10 pages', 'No screens after 10'];
export const SAMPLE_CFGS: Record<string, HabitScheduleCfg> = {
  'Morning walk': { days: [1, 2, 3, 4, 5, 6, 0], time: '07:00', reminder: false },
  'Read 10 pages': { days: [1, 2, 3, 4, 5], time: '21:00', reminder: false },
  'No screens after 10': { days: [1, 2, 3, 4, 5, 6, 0], time: '22:00', reminder: false },
};

function cadence(days: number[]): string {
  const s = new Set(days);
  if (s.size >= 7) return 'Every day';
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return 'Weekdays';
  if (s.size === 2 && s.has(0) && s.has(6)) return 'Weekends';
  return `${s.size}x / week`;
}

export function scheduleSubtitle(cfg?: HabitScheduleCfg): string | undefined {
  if (!cfg) return undefined;
  return `${cadence(cfg.days)} · ${formatTime12(cfg.time)}`;
}

// Fades + lifts a section into place when its stage is reached. Once shown it
// stays shown (no flicker on later stages).
export function Reveal({
  show,
  children,
  delay = 0,
}: {
  show: boolean;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'none' : 'translateY(14px)',
        transition: `opacity 320ms ease-out ${delay}ms, transform 320ms ease-out ${delay}ms`,
        pointerEvents: show ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

// The coach's voice for the tour: a docked caption bar (the minimized chat) with
// the orb + the line. When `onTap` is set, tapping it advances the beat (the
// gesture the tour uses to progress); a chevron cues the tap.
export function CoachCaption({ text, onTap }: { text: string; onTap?: () => void }) {
  const tappable = !!onTap;
  return (
    <div
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onClick={onTap}
      onKeyDown={
        tappable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTap?.();
              }
            }
          : undefined
      }
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 72,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 20,
        border: '1.5px solid rgba(19,91,235,0.16)',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 10px 30px -10px rgba(15,23,42,0.22)',
        textAlign: 'left',
        cursor: tappable ? 'pointer' : 'default',
        animation: 'ggTourCaptionIn 280ms ease-out',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, #5b9bff, ${BLUE})`,
          boxShadow: '0 4px 12px -2px rgba(19,91,235,0.45)',
        }}
      />
      <span
        style={{
          flex: 1,
          fontFamily: FONT,
          fontSize: 14.5,
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'rgb(15,23,42)',
        }}
      >
        {text}
      </span>
      {tappable && (
        <Icon
          icon="mdi:chevron-right"
          width={22}
          height={22}
          style={{ flexShrink: 0, color: BLUE }}
        />
      )}
    </div>
  );
}

// The brief chat "peek" the chat beat plays: a panel rises over the home, holds,
// then docks back down. Non-interactive, one-shot.
export function ChatPeek({ name }: { name: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, #eaf1ff 0%, #f7faff 70%, #ffffff 100%)',
        animation: 'ggChatPeek 2400ms cubic-bezier(0.22,1,0.36,1) forwards',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #5b9bff, ${BLUE})`,
          }}
        />
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: 'rgb(15,23,42)' }}>
          Coach
        </div>
      </div>
      <Bubble who="coach">{name ? `Right here, ${name}.` : 'Right here.'} Open me whenever.</Bubble>
    </div>
  );
}

// The live, tappable state-check card the check-in action reveals (same four-row
// sleep / mood / energy / stress card the onboarding state check uses).
export function LiveStateCheck() {
  const [sel, setSel] = useState<Record<string, number>>({});
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      {checkInDimensions.map((dim) => (
        <div key={dim.key} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-content-subtle">{dim.label}</span>
          <div className="flex w-full justify-between">
            {dim.options.map((o) => (
              <EmojiOptionButton
                key={o.value}
                icon={o.icon}
                label={o.label}
                color={o.color}
                isSelected={sel[dim.key] === o.value}
                onClick={() => setSel((p) => ({ ...p, [dim.key]: o.value }))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The open/close coach chat overlay. Slides up over the home and closes back to
// it. A light stand-in for the real CoachChatOverlay (which needs the full voice
// runtime); shows the thread + a composer so the open/close behavior reads true.
export function ChatOverlay({ name, onClose }: { name: string; onClose: () => void }) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setSent((p) => [...p, t]);
    setDraft('');
  };
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #eaf1ff 0%, #f7faff 60%, #ffffff 100%)',
        animation: 'ggTourChatIn 320ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 12px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #5b9bff, ${BLUE})`,
            boxShadow: '0 4px 12px -2px rgba(19,91,235,0.45)',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: 'rgb(15,23,42)' }}>
            Coach
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: BLUE }}>
            Here whenever you need me
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(15,23,42,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon icon="mdi:close" width={20} height={20} style={{ color: 'rgb(71,85,105)' }} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Bubble who="coach">
          {name ? `I'm right here, ${name}.` : "I'm right here."} What's on your mind?
        </Bubble>
        {sent.map((m, i) => (
          <Bubble key={i} who="user">
            {m}
          </Bubble>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px calc(14px + env(safe-area-inset-bottom))',
          borderTop: '1px solid rgba(15,23,42,0.06)',
          background: '#fff',
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Type a message..."
          style={{
            flex: 1,
            border: '1.5px solid rgba(15,23,42,0.10)',
            borderRadius: 22,
            padding: '11px 16px',
            fontFamily: FONT,
            fontSize: 14.5,
            outline: 'none',
          }}
        />
        <button
          type="button"
          aria-label="Send"
          onClick={send}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: BLUE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon icon="mdi:arrow-up" width={22} height={22} style={{ color: '#fff' }} />
        </button>
      </div>
    </div>
  );
}

function Bubble({ who, children }: { who: 'coach' | 'user'; children: ReactNode }) {
  const isCoach = who === 'coach';
  return (
    <div
      style={{
        alignSelf: isCoach ? 'flex-start' : 'flex-end',
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: 18,
        borderBottomLeftRadius: isCoach ? 4 : 18,
        borderBottomRightRadius: isCoach ? 18 : 4,
        background: isCoach ? '#fff' : BLUE,
        color: isCoach ? 'rgb(15,23,42)' : '#fff',
        fontFamily: FONT,
        fontSize: 14.5,
        fontWeight: 500,
        lineHeight: 1.4,
        boxShadow: isCoach ? '0 2px 10px -4px rgba(15,23,42,0.14)' : 'none',
      }}
    >
      {children}
    </div>
  );
}

// Journaling section under the habits. The real RecentReflectionsSection renders
// nothing for a brand-new user, so the tour shows an inviting empty state so the
// home reads complete.
export function RecentReflections() {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Recent Reflections" />
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-4">
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(100,74,185,0.10)',
          }}
        >
          <Icon
            icon="mdi:weather-night"
            width={20}
            height={20}
            style={{ color: 'rgb(100,74,185)' }}
          />
        </div>
        <span className="text-sm font-medium text-content-secondary">
          Your reflections show up here after your first evening reflection.
        </span>
      </div>
    </div>
  );
}

// A presentational bottom nav so the tour reads as the real home. The real
// BottomNav needs the full voice runtime, so this is a faithful static stand-in
// (Home active). The coach lives in the floating Open Chat button.
export function HomeBottomNav() {
  const tab = (icon: string, label: string, active = false) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        color: active ? BLUE : 'rgb(148,163,184)',
      }}
    >
      <Icon icon={icon} width={22} height={22} />
      <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700 }}>{label}</span>
    </div>
  );
  return (
    <div
      style={{
        height: 64,
        background: '#fff',
        boxShadow: '0 -4px 16px -8px rgba(15,23,42,0.12)',
        borderTop: '1px solid rgba(15,23,42,0.05)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        alignItems: 'center',
        padding: '0 26px',
      }}
    >
      {tab('ic:round-home', 'Home', true)}
      {tab('ic:round-leaderboard', 'Progress')}
      {tab('mingcute:stopwatch-fill', 'Focus')}
      {tab('ic:round-person', 'Profile')}
    </div>
  );
}

export function TourKeyframes() {
  return (
    <style>{`
      @keyframes ggTourCaptionIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes ggTourChatIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
      @keyframes ggHomeCollapse { from { opacity: .55; transform: scaleY(1); } to { opacity: 0; transform: scaleY(0); } }
      @keyframes ggChatPeek { 0% { transform: translateY(100%); } 24% { transform: translateY(0); } 60% { transform: translateY(0); } 100% { transform: translateY(104%); } }
    `}</style>
  );
}
