import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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

// THE APP TOUR (the second half of onboarding).
//
// The onboarding chat ends with the first state check, the chat closes, and the
// user lands here: the real HOME PAGE, built from the real home components
// (HomeHeader, DateStrip, QuickActionCards, the habit rows, the feedback +
// open-chat buttons). Instead of dumping the whole screen at once, the coach
// reveals it a piece at a time and the user taps to move on. Everything that is
// revealed is LIVE and tappable as it appears, so it genuinely IS the app, the
// coach is just narrating over it. When the tour finishes you are left on the
// real, persistent home, with the coach chat one tap away as an open/close
// overlay.
//
// On the static build canvas (not playing) the tour shows its finished state so
// the tile reads as the completed home.

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

// The real coach-chat gradient (from CoachChatView): a blurred blue rising into
// white, semi-transparent so the home shows through above it.
const CHAT_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

// The reveal beats, in order. Each tap on the coach caption advances one stage;
// LIVE is the finished home with the captions gone.
// The tour is five beats, each placed in the App tour flow with a `stage` prop.
// The single home-tour beat reads its stage and renders the home at that reveal
// level with the chat in the right form. Order matters (index drives reveal).
const TOUR_STAGES = ['land', 'connect', 'reveal', 'chat', 'live'] as const;
type TourStage = (typeof TOUR_STAGES)[number];
function stageIndex(s?: string): number {
  const i = TOUR_STAGES.indexOf((s ?? 'live') as TourStage);
  return i < 0 ? TOUR_STAGES.length - 1 : i; // unknown / unset => the finished home
}

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

// Fades + lifts a section into place when its stage is reached. Once shown it
// stays shown (no flicker on later stages).
function Reveal({
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

type ChatMsg = { role: 'user' | 'ai'; text: string };

// The coach's chat in the tour, built from the REAL chat pieces: the same
// blurred blue gradient, the real ChatBubble speech bubbles, the real DualButton
// orb + composer, and the fade mask. The orb is ALWAYS anchored at the bottom
// (the coach's constant presence). The gradient + bubbles panel sits at the
// bottom by default, or at the TOP (`pos="top"`) for beats that show the lower
// home, so the bubbles never cover the habits. `heightPct` is ~40-50; `full`
// makes it the whole-screen open chat.
function TourChat({
  name,
  messages,
  heightPct = 46,
  pos = 'bottom',
  full = false,
  showComposer = false,
  onClose,
}: {
  name: string;
  messages: ChatMsg[];
  heightPct?: number;
  pos?: 'top' | 'bottom';
  full?: boolean;
  showComposer?: boolean;
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

      {/* The orb, always at the screen bottom-center (the constant coach). */}
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
// stand-in (Home active). The coach lives in the floating Open Chat button.
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

  // This beat is placed once per tour stage; its stage prop drives what shows.
  const idx = stageIndex(props?.stage);
  const showHabits = idx >= 2; // reveal, chat, live
  const showButtons = idx >= 3; // chat, live
  const isLive = idx === 4;
  const connectRing = idx === 1;

  // The coach lives in the real chat: always ~40-50% of the screen (never less),
  // with the orb anchored at the bottom. It sits at the BOTTOM while the chat
  // leads and the home's top is the focus (land + connect), and moves to the TOP
  // for the beats that reveal the lower home (habits) so the bubbles never cover
  // them. On the live beat it docks to the Open Chat button. FRAME_H matches the
  // beat's fixed height.
  const FRAME_H = 792;
  const chatPos: 'top' | 'bottom' = idx <= 1 ? 'bottom' : 'top';
  const chatPct = isLive ? 0 : idx <= 1 ? 48 : 42;
  const chatPx = Math.round((FRAME_H * chatPct) / 100);
  const showChat = !isLive; // the docked coach chat (narration) shows until live

  // Interactive home state. Habit toggles + the selected date lift to flow state
  // so they survive moving between the tour's beats (each beat is its own mount);
  // on the static canvas (no flow provider) they fall back to local state.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [localDate, setLocalDate] = useState(today);
  const [localStatus, setLocalStatus] = useState<Record<string, 'done' | 'missed' | 'none'>>({});
  const selectedDate = flow ? (flow.tourSelectedDate ?? today) : localDate;
  const onSelectDate = (d: string) => (flow ? flow.setTourSelectedDate(d) : setLocalDate(d));
  const habitStatus = flow ? flow.tourHabitStatus : localStatus;
  const setHabitStatus = (nx: Record<string, 'done' | 'missed' | 'none'>) =>
    flow ? flow.setTourHabitStatus(nx) : setLocalStatus(nx);

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [feedbackAck, setFeedbackAck] = useState(false);

  // The plan to show, real where we have it, sample otherwise.
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;
  const cfgs = useMemo<Record<string, HabitScheduleCfg>>(
    () => (flow && Object.keys(flow.habitConfigs).length > 0 ? flow.habitConfigs : SAMPLE_CFGS),
    [flow],
  );

  const coachLine =
    props?.coachLine && props.coachLine.trim()
      ? props.coachLine
      : name
        ? `Welcome home, ${name}. This is your space.`
        : 'Welcome home. This is your space.';

  const toggle = (h: string, kind: 'done' | 'missed') => {
    const cur = habitStatus[h] ?? 'none';
    setHabitStatus({ ...habitStatus, [h]: cur === kind ? 'none' : kind });
  };

  // When the chat sits at the top (the habit-reveal beats), scroll the home so
  // the habits sit in the space below it, not the greeting that is now covered.
  // Scroll the home container itself (via scrollTop), NOT scrollIntoView, which
  // would also scroll the outer phone and shove the whole frame off-screen.
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatPos !== 'top' || isLive) return;
    const t = window.setTimeout(() => {
      const c = homeScrollRef.current;
      const h = habitsRef.current;
      if (!c || !h) return;
      c.scrollTop += h.getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
    }, 80);
    return () => window.clearTimeout(t);
  }, [chatPos, isLive, idx]);

  return (
    <div style={{ position: 'relative', height: 792 }}>
      {/* The home, scrolling in the space the chat leaves: above a bottom chat,
          below a top chat (so the habits show), or the full frame when live. */}
      <div
        ref={homeScrollRef}
        className="flex flex-col gap-5 pt-1"
        style={{
          position: 'absolute',
          top: chatPos === 'top' && !isLive ? chatPx : 0,
          left: 0,
          right: 0,
          bottom: isLive ? 64 : chatPos === 'top' ? 88 : chatPx,
          overflowY: 'auto',
          paddingBottom: isLive ? 92 : 16,
        }}
      >
        {/* TOP HALF: header + dates + the two quick-action cards (every stage). */}
        <div
          style={{
            borderRadius: 24,
            outline: connectRing ? `2px solid ${BLUE}` : '2px solid transparent',
            outlineOffset: 6,
            transition: 'outline-color 320ms ease-out',
          }}
          className="flex flex-col gap-5"
        >
          <HomeHeader userName={name || 'there'} />
          <DateStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
          <div>
            <QuickActionCards
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
        </div>

        {/* The connect-to-chat moment: a soft ribbon ties the screen to the chat. */}
        {connectRing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              padding: '7px 14px',
              borderRadius: 999,
              background: 'rgba(19,91,235,0.10)',
              border: '1px solid rgba(19,91,235,0.22)',
              animation: 'ggTourCaptionIn 280ms ease-out',
            }}
          >
            <Icon icon="mdi:message-text-outline" width={15} height={15} style={{ color: BLUE }} />
            <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: BLUE }}>
              Same space as the chat
            </span>
          </div>
        )}

        {/* BOTTOM HALF: habits (real schedule) + journaling. The habits get a
            soft highlight on the beat where the coach points them out. */}
        <Reveal show={showHabits}>
          <div
            ref={habitsRef}
            className="flex flex-col gap-3 scroll-mt-2"
            style={{
              borderRadius: 18,
              outline: idx === 2 ? `2px solid ${BLUE}` : '2px solid transparent',
              outlineOffset: 6,
              boxShadow: idx === 2 ? '0 0 0 6px rgba(19,91,236,0.10)' : 'none',
              transition: 'outline-color 360ms ease-out, box-shadow 360ms ease-out',
              animation: idx === 2 ? 'ggGlow 1800ms ease-in-out infinite' : 'none',
            }}
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="text-base font-bold text-content">Today's habits</span>
            </div>
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

            {/* Journaling, under the habits, same as the real home. */}
            <RecentReflections />
          </div>
        </Reveal>
      </div>

      {/* Floating feedback + open-chat buttons. While the coach narrates they
          float above the caption; on the live beat they settle above the nav. */}
      <div
        style={{ position: 'absolute', left: 8, bottom: 78, zIndex: 58, transition: 'bottom 320ms ease-out', display: chatOpen ? 'none' : undefined }}
      >
        <Reveal show={showButtons}>
          <span style={{ borderRadius: 999, animation: idx === 3 ? 'ggGlow 1800ms ease-in-out infinite' : 'none' }}>
            <FeedbackButton onPress={() => setFeedbackAck(true)} />
          </span>
        </Reveal>
      </div>
      <div
        style={{ position: 'absolute', right: 8, bottom: 78, zIndex: 58, transition: 'bottom 320ms ease-out', display: chatOpen ? 'none' : undefined }}
      >
        <Reveal show={showButtons}>
          <span style={{ borderRadius: 999, animation: idx === 3 ? 'ggGlow 1800ms ease-in-out infinite' : 'none' }}>
            <OpenChatButton onPress={() => setChatOpen(true)} />
          </span>
        </Reveal>
      </div>

      {/* Feedback acknowledgement toast. */}
      {feedbackAck && (
        <div
          onClick={() => setFeedbackAck(false)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 210,
            zIndex: 45,
            padding: '12px 16px',
            borderRadius: 16,
            background: 'rgb(15,23,42)',
            color: '#fff',
            fontFamily: FONT,
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.4,
            boxShadow: '0 12px 30px -10px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            animation: 'ggTourCaptionIn 240ms ease-out',
          }}
        >
          Thanks, that's how this gets better. Tap to dismiss.
        </div>
      )}

      {/* The coach's chat: the real chat (gradient + real speech bubbles + orb),
          about half the screen, at the bottom while the chat leads or at the top
          for the habit-reveal beats. Keyed per stage so it re-animates. */}
      {showChat && (
        <TourChat
          key={idx}
          name={name}
          heightPct={chatPct}
          pos={chatPos}
          messages={[{ role: 'ai', text: coachLine }]}
        />
      )}

      {/* The home's bottom nav, shown on the live home (the chat covers it during
          the tour, where the orb is the bottom presence instead). */}
      {isLive && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <HomeBottomNav />
        </div>
      )}

      {/* The full open/close chat overlay (the real chat, covers the frame). */}
      {chatOpen && (
        <TourChat
          name={name}
          full
          showComposer
          messages={[
            {
              role: 'ai',
              text: name ? `I'm right here, ${name}. What's on your mind?` : "I'm right here. What's on your mind?",
            },
          ]}
          onClose={() => setChatOpen(false)}
        />
      )}

      <style>{`
        @keyframes ggTourCaptionIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes ggChatRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes ggGlow { 0%,100% { box-shadow: 0 0 0 3px rgba(19,91,236,0.16), 0 6px 22px -6px rgba(19,91,236,0.30); } 50% { box-shadow: 0 0 0 5px rgba(19,91,236,0.28), 0 10px 30px -6px rgba(19,91,236,0.48); } }
      `}</style>
    </div>
  );
}

const homeTourBeat: BeatDef = {
  type: 'home-tour',
  group: 'Onboarding',
  label: 'Home tour (land + reveal the app)',
  Comp: HomeTourBeat,
};

export default homeTourBeat;
