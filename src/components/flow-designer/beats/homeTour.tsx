import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@iconify/react';
import { DateStrip } from '@/components/home/DateStrip';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { FeedbackButton } from '@/components/home/FeedbackButton';
import { HabitListItem } from '@/components/home/HabitListItem';
import { HomeHeader } from '@/components/home/HomeHeader';
import { OpenChatButton } from '@/components/home/OpenChatButton';
import { QuickActionCards } from '@/components/home/QuickActionCards';
import { SectionHeader } from '@/components/home/SectionHeader';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { IconChatText, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { formatTime12 } from '@/components/ui/TimePicker';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { type BeatDef } from '../beatKit';
import { useFlowState, type HabitScheduleCfg } from '../flowStateCtx';

// THE APP TOUR (the second half of onboarding, its own flow).
//
// The onboarding chat ends with the first state check, the chat closes, and the
// user lands here: the real HOME PAGE, built from the real home components
// (HomeHeader, DateStrip, QuickActionCards, the habit rows, the feedback +
// open-chat buttons). The coach then walks the home top to bottom, one real
// feature per beat, with the coach chat sitting where it does not cover the part
// being shown. Everything on the home is LIVE and tappable as it appears, so it
// genuinely IS the app, the coach is just narrating over it.
//
// On the static build canvas (no flow provider) each beat renders its own stage
// so the tiles read as the seven steps of the tour.

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// The real coach-chat gradient (from CoachChatView): a blurred blue rising into
// white, semi-transparent so the home shows through above it.
const CHAT_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

// The tour walks the home top to bottom, one real feature per beat. Each beat is
// a `home-tour` placed in the App tour flow with a `stage` prop; the beat reads
// its stage and renders the real home with that feature highlighted and the
// coach chat positioned so it never covers the part being shown. Order matters:
// the index drives which part glows, where the chat sits, and how big it is.
//   add-habit   the + in the header (add a habit) chat bottom 45%
//   morning     the morning check-in card opens  chat bottom 40%
//   evening     the evening reflection card      chat bottom 45%
//   habits      today's habits (say / tap)       chat bottom 45%
//   reflections the recent reflections section   chat top 45%
//   feedback    the feedback button -> a chat    chat top 45%
//   chat        the full open chat               chat full
const TOUR_STAGES = [
  'add-habit',
  'morning',
  'evening',
  'habits',
  'reflections',
  'feedback',
  'chat',
] as const;
type TourStage = (typeof TOUR_STAGES)[number];
function stageIndex(s?: string): number {
  const i = TOUR_STAGES.indexOf((s ?? 'add-habit') as TourStage);
  return i < 0 ? 0 : i;
}

// The coach line each beat falls back to on the static canvas (where the flow
// has not supplied a coachLine prop). User-facing copy, so no em dashes.
const STAGE_LINE: Record<TourStage, string> = {
  'add-habit':
    "Want to track something new later? Press the plus up here, or just tell me, and we'll add it together.",
  morning: "Mornings start with a quick check-in. Tap it, or just say you're ready, and we'll see how you slept and where you're at.",
  evening: 'Evenings, you reflect on the day. Tap it or just start talking to me, how it went, what is on your mind.',
  habits: 'These are your habits. Say it or tap when you finish one, the X if you miss it. Either way works.',
  reflections: "It's empty now, but this is where your reflections will live. After your first evening one, they show up here.",
  feedback:
    "You're one of our 50 founding users, so your feedback is one of the most meaningful things you can do for us. It shapes where this whole product goes. There's a button here for it, and you can also just tell me, anytime you've got something.",
  chat: "Great job getting here. This might be the longest you'll ever be in the app, but it was worth it to set up your foundation. The key now is consistency. It doesn't have to be long, just do it twice a day, and we'll do our best to help you improve and stay consistent. I'm right here anytime, just open the chat.",
};

// Fallback plan shown on the canvas / when no upstream selection exists.
const SAMPLE_HABITS = ['Morning walk', 'Read 10 pages', 'No screens after 10'];
const SAMPLE_CFGS: Record<string, HabitScheduleCfg> = {
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

function scheduleSubtitle(cfg?: HabitScheduleCfg): string | undefined {
  if (!cfg) return undefined;
  return `${cadence(cfg.days)} · ${formatTime12(cfg.time)}`;
}

type ChatMsg = { role: 'user' | 'ai'; text: string };

// The coach's chat in the tour, built from the REAL chat pieces: the same
// blurred blue gradient, the real ChatBubble speech bubbles, the real DualButton
// orb + composer, and the fade mask. The gradient + bubbles panel sits at the
// bottom by default, or at the TOP (`pos="top"`) for beats that show the lower
// home, so the bubbles never cover it. `heightPct` is ~40-50; `full` makes it
// the whole-screen open chat. `hideOrb` drops the floating orb on top-band beats
// so the home's real bottom controls own the bottom.
function TourChat({
  name,
  messages,
  heightPct = 46,
  pos = 'bottom',
  full = false,
  showComposer = false,
  hideOrb = false,
  onClose,
}: {
  name: string;
  messages: ChatMsg[];
  heightPct?: number;
  pos?: 'top' | 'bottom';
  full?: boolean;
  showComposer?: boolean;
  // Top-band narration beats hide the orb so the home's real bottom controls
  // (feedback + open chat + nav) own the bottom while the coach speaks from up top.
  hideOrb?: boolean;
  onClose?: () => void;
}) {
  const atTop = pos === 'top' && !full;
  const panelPos: CSSProperties = full
    ? { top: 0, bottom: 0 }
    : atTop
      ? { top: 0, height: `${heightPct}%` }
      : { bottom: 0, height: `${heightPct}%` };
  // Blue points toward the orb (down) for bottom / full panels; for a top panel
  // it points down too (blue at top, fading into the home below).
  const gradient = atTop
    ? 'linear-gradient(to bottom, rgba(19,91,236,0.72) 0%, rgba(255,255,255,0.72) 58%, rgba(255,255,255,0) 100%)'
    : CHAT_GRADIENT;
  // The thread hugs the home edge of the panel and fades toward it.
  const mask = atTop
    ? 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)'
    : 'linear-gradient(to top, transparent 0px, transparent 84px, black 190px, black 100%)';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 55,
        pointerEvents: full ? 'auto' : 'none',
        animation: 'ggChatRise 380ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* The gradient + speech-bubbles panel (top or bottom band, or full). */}
      <div style={{ position: 'absolute', left: 0, right: 0, ...panelPos, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
        <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(50px)', backgroundImage: gradient }} />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            style={{
              position: 'absolute',
              right: 18,
              top: 14,
              zIndex: 30,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              color: 'rgb(51,65,85)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            Close chat
            <Icon icon="mdi:close" width={18} height={18} />
          </button>
        )}
        <div
          className="absolute inset-0 flex flex-col overflow-y-auto px-5"
          style={{
            justifyContent: atTop ? 'flex-start' : 'flex-end',
            paddingTop: onClose ? 52 : atTop ? 16 : 18,
            paddingBottom: full ? 150 : atTop ? 22 : 120,
            maskImage: mask,
            WebkitMaskImage: mask,
          }}
        >
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              text={m.text}
              userName={name || 'You'}
              eyebrowVariant="dark"
              compact
              animate={false}
            />
          ))}
        </div>
      </div>

      {/* The orb, at the screen bottom-center (the constant coach). Hidden on
          top-band narration beats so the home's real bottom controls show. */}
      {!hideOrb && (
        <div
          style={{ position: 'absolute', left: 0, right: 0, bottom: full && showComposer ? 78 : 16, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <DualButton
              size={74}
              leftActive
              rings
              ringCount={3}
              ringStep={5}
              leftIcon={<IconChatText size={25} />}
              rightIcon={<IconMicMuted size={23} />}
              leftAriaLabel="Chat mode"
              rightAriaLabel="Microphone"
            />
          </div>
        </div>
      )}

      {/* The composer, only on the full open chat. */}
      {full && showComposer && (
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 16, zIndex: 20, pointerEvents: 'auto' }}>
          <ChatComposer
            value=""
            onValueChange={() => {}}
            onSubmit={() => {}}
            placeholder="Type or talk..."
            className="flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
          />
        </div>
      )}
    </div>
  );
}

// The live, tappable state-check card the check-in action reveals (the real
// four-row sleep / mood / energy / stress card, same one the onboarding state
// check uses).
function LiveStateCheck() {
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

// The journaling section under the habits. The real RecentReflectionsSection is
// data-backed and renders nothing for a brand-new user, so the tour shows an
// inviting empty state in the same slot (Recent Reflections header + a soft
// prompt) so the home reads complete.
function RecentReflections() {
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
          <Icon icon="mdi:weather-night" width={20} height={20} style={{ color: 'rgb(100,74,185)' }} />
        </div>
        <span className="text-sm font-medium text-content-secondary">
          Your reflections show up here after your first evening reflection.
        </span>
      </div>
    </div>
  );
}

// A presentational bottom nav so the tour reads as the real home screen. The
// real BottomNav needs the full voice runtime, so this is a faithful static
// stand-in (Home active).
function HomeBottomNav() {
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

function HomeTourBeat(props?: Record<string, string>) {
  const flow = useFlowState();
  const name = props?.userName && props.userName !== '{name}' ? props.userName : '';

  const idx = stageIndex(props?.stage);
  const stage = TOUR_STAGES[idx];
  const isOpenChat = stage === 'chat';

  // Chat geometry: a bottom band while we walk the top of the home (calendar ->
  // habits), a top band for the lower parts (reflections, feedback) so the chat
  // never covers them, then the full open chat last. The morning beat gets a
  // shorter band so the check-in card has room to open.
  const FRAME_H = 792;
  const chatPos: 'top' | 'bottom' = idx <= 3 ? 'bottom' : 'top';
  const chatTop = chatPos === 'top' && !isOpenChat; // narration sits up top
  const chatPct = stage === 'morning' ? 40 : 45;
  const chatPx = Math.round((FRAME_H * chatPct) / 100);

  // Which real home part glows this beat.
  const hl = isOpenChat ? null : stage;

  // Interactive home state, lifted to flow state so it survives moving between
  // beats; on the static canvas (no provider) it falls back to local state.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [localDate, setLocalDate] = useState(today);
  const [localStatus, setLocalStatus] = useState<Record<string, 'done' | 'missed' | 'none'>>({});
  const selectedDate = flow ? (flow.tourSelectedDate ?? today) : localDate;
  const onSelectDate = (d: string) => (flow ? flow.setTourSelectedDate(d) : setLocalDate(d));
  const habitStatus = flow ? flow.tourHabitStatus : localStatus;
  const setHabitStatus = (nx: Record<string, 'done' | 'missed' | 'none'>) =>
    flow ? flow.setTourHabitStatus(nx) : setLocalStatus(nx);

  // The check-in card auto-opens on the morning beat (the demo), closed otherwise.
  const [showCheckIn, setShowCheckIn] = useState(stage === 'morning');
  useEffect(() => {
    setShowCheckIn(stage === 'morning');
  }, [stage]);

  // The full chat opens from the feedback button ('feedback') or the open-chat
  // button ('open'); the last beat IS the open chat.
  const [chat, setChat] = useState<null | 'open' | 'feedback'>(null);
  const showFullChat = isOpenChat || chat !== null;
  const showNarration = !showFullChat;
  const showBottomControls = chatTop && !showFullChat; // feedback + open-chat + nav

  // The plan to show, real where we have it, sample otherwise.
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;
  const cfgs = useMemo<Record<string, HabitScheduleCfg>>(
    () => (flow && Object.keys(flow.habitConfigs).length > 0 ? flow.habitConfigs : SAMPLE_CFGS),
    [flow],
  );

  const coachLine =
    props?.coachLine && props.coachLine.trim() ? props.coachLine : STAGE_LINE[stage];
  const fullGreeting =
    chat === 'feedback'
      ? name
        ? `What's working, ${name}? What's not? Tell me anything.`
        : "What's working? What's not? Tell me anything."
      : isOpenChat
        ? coachLine
        : name
          ? `I'm right here, ${name}. What's on your mind?`
          : "I'm right here. What's on your mind?";

  const toggle = (h: string, kind: 'done' | 'missed') => {
    const cur = habitStatus[h] ?? 'none';
    setHabitStatus({ ...habitStatus, [h]: cur === kind ? 'none' : kind });
  };

  // Scroll the highlighted part into the clear band the chat leaves. Scroll the
  // home container itself (scrollTop), NOT scrollIntoView, which would shove the
  // whole phone frame off-screen.
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  const reflectionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = homeScrollRef.current;
    if (!c) return;
    const id = window.setTimeout(() => {
      if (idx === 0) {
        c.scrollTop = 0;
        return;
      }
      const tgt =
        stage === 'morning' || stage === 'evening'
          ? quickRef.current
          : stage === 'habits'
            ? habitsRef.current
            : stage === 'reflections'
              ? reflectionsRef.current
              : null;
      if (!tgt) {
        c.scrollTop = 0;
        return;
      }
      c.scrollTop += tgt.getBoundingClientRect().top - c.getBoundingClientRect().top - 10;
    }, 90);
    return () => window.clearTimeout(id);
  }, [idx, stage]);

  // The highlighted element glows AND lifts above the blur veil (zIndex 60 > the
  // veil's 44) so it stays sharp while the rest of the home blurs behind it.
  const glow = (on: boolean): CSSProperties => ({
    position: 'relative',
    zIndex: on ? 60 : undefined,
    borderRadius: 18,
    outline: on ? `2px solid ${BLUE}` : '2px solid transparent',
    outlineOffset: 6,
    boxShadow: on ? '0 0 0 6px rgba(19,91,236,0.10)' : 'none',
    transition: 'outline-color 360ms ease-out, box-shadow 360ms ease-out',
    animation: on ? 'ggGlow 1800ms ease-in-out infinite' : 'none',
  });
  // Lift only (no outline glow) for the quick-action row, whose own card glows
  // via the QuickActionCards highlight prop.
  const lift = (on: boolean): CSSProperties | undefined =>
    on ? { position: 'relative', zIndex: 60 } : undefined;

  return (
    <div style={{ position: 'relative', height: 792, overflow: 'hidden' }}>
      {/* The real home, scrolling in the space the chat leaves: above a bottom
          chat, below a top chat, or behind the full open chat. */}
      <div
        ref={homeScrollRef}
        className="flex flex-col gap-5 pt-1"
        style={{
          position: 'absolute',
          top: chatTop ? chatPx : 0,
          left: 0,
          right: 0,
          bottom: isOpenChat ? 0 : chatTop ? 96 : chatPx,
          overflowY: 'auto',
          paddingBottom: 16,
        }}
      >
        <HomeHeader userName={name || 'there'} highlightPlus={hl === 'add-habit'} />
        <div>
          <DateStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
        </div>
        <div ref={quickRef} style={lift(hl === 'morning' || hl === 'evening')}>
          <QuickActionCards
            highlight={hl === 'morning' ? 'checkin' : hl === 'evening' ? 'journal' : undefined}
            onCheckInPress={() => setShowCheckIn((v) => !v)}
            onJournalPress={() => setShowCheckIn((v) => !v)}
          />
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showCheckIn ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <LiveStateCheck />
            </div>
          </div>
        </div>
        <div ref={habitsRef} className="flex flex-col gap-3" style={glow(hl === 'habits')}>
          <span className="px-0.5 text-base font-bold text-content">Today's habits</span>
          <div className="flex flex-col gap-3">
            {habits.map((h) => (
              <HabitListItem
                key={h}
                name={h}
                subtitle={scheduleSubtitle(cfgs[h])}
                streak={0}
                showNote={false}
                isCompleted={(habitStatus[h] ?? 'none') === 'done'}
                status={habitStatus[h] ?? 'none'}
                onToggleComplete={() => toggle(h, 'done')}
                onMarkMissed={() => toggle(h, 'missed')}
              />
            ))}
          </div>
        </div>
        <div ref={reflectionsRef} style={glow(hl === 'reflections')}>
          <RecentReflections />
        </div>
      </div>

      {/* Spotlight veil: on every highlight beat, softly blur + dim the rest of
          the home (and the nav) so the highlighted part, which lifts above this
          veil with its blue glow, is clearly the point. The veil fades in on
          enter; the beat-to-beat dissolve fades it out as you leave. */}
      {hl !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 44,
            background: 'rgba(248,250,252,0.5)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            animation: 'ggScrimIn 420ms ease-out',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* The home's real bottom controls, shown on the top-band beats (the chat
          is up top, so feedback + open chat + nav own the bottom). */}
      {showBottomControls && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 8,
              bottom: 80,
              zIndex: 58,
              animation: hl === 'feedback' ? 'ggPop 460ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}
          >
            <span
              style={{
                borderRadius: 999,
                display: 'inline-block',
                animation: hl === 'feedback' ? 'ggGlow 1800ms ease-in-out infinite' : 'none',
              }}
            >
              <FeedbackButton onPress={() => setChat('feedback')} />
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 8,
              bottom: 80,
              zIndex: 58,
              animation: hl === 'feedback' ? 'ggPop 460ms 70ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}
          >
            <OpenChatButton onPress={() => setChat('open')} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
            <HomeBottomNav />
          </div>
        </>
      )}

      {/* The coach narration: the real chat (~40-50%), bottom while we walk the
          top of the home, top for the lower parts. Keyed per stage so it
          re-animates as it moves. */}
      {showNarration && (
        <TourChat
          key={stage}
          name={name}
          heightPct={chatPct}
          pos={chatPos}
          hideOrb={chatTop}
          messages={[{ role: 'ai', text: coachLine }]}
        />
      )}

      {/* The full open chat: the destination beat, or opened from feedback /
          open-chat on a lower beat. */}
      {showFullChat && (
        <TourChat
          name={name}
          full
          showComposer
          messages={[{ role: 'ai', text: fullGreeting }]}
          onClose={chat !== null ? () => setChat(null) : undefined}
        />
      )}

      <style>{`
        @keyframes ggChatRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes ggGlow { 0%,100% { box-shadow: 0 0 0 3px rgba(19,91,236,0.16), 0 6px 22px -6px rgba(19,91,236,0.30); } 50% { box-shadow: 0 0 0 5px rgba(19,91,236,0.28), 0 10px 30px -6px rgba(19,91,236,0.48); } }
        @keyframes ggScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ggPop { from { opacity: 0; transform: translateY(10px) scale(0.94); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

const homeTourBeat: BeatDef = {
  type: 'home-tour',
  group: 'Onboarding',
  label: 'Home tour (one real feature per beat)',
  Comp: HomeTourBeat,
};

export default homeTourBeat;
