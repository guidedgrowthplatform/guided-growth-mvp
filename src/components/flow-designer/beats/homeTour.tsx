import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { formatTime12 } from '@/components/ui/TimePicker';
import { useAnimations, useIsPlaying, type BeatDef } from '../beatKit';
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

// The reveal beats, in order. Each tap on the coach caption advances one stage;
// LIVE is the finished home with the captions gone.
const STAGE = { TOP: 0, CONNECT: 1, HABITS: 2, FEEDBACK: 3, CHAT: 4, LIVE: 5 } as const;
type Stage = (typeof STAGE)[keyof typeof STAGE];

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

// The coach's voice for the tour: a bottom bar (the same place the live app's
// coach subtitle sits) with the orb, the line, and a tap-to-continue chevron.
// Tapping it anywhere advances the reveal.
function CoachCaption({
  text,
  isLast,
  onNext,
}: {
  text: string;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onNext}
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
        cursor: 'pointer',
        textAlign: 'left',
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
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          color: BLUE,
        }}
      >
        {isLast ? 'Done' : 'Next'}
        <Icon
          icon={isLast ? 'mdi:check' : 'mdi:chevron-right'}
          width={18}
          height={18}
          style={{ color: BLUE }}
        />
      </span>
    </button>
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

// The open/close coach chat overlay. Slides up over the home and closes back to
// it, so the user feels the model: the chat is the default surface, the home is
// the visual one, and you move between them. This is a light stand-in for the
// real CoachChatOverlay (which needs the full voice runtime); it shows the
// thread + a composer so the open/close behavior reads true.
function ChatOverlay({ name, onClose }: { name: string; onClose: () => void }) {
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 16px 12px',
        }}
      >
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

      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bubble who="coach">
          {name ? `I'm right here, ${name}.` : "I'm right here."} What's on your mind?
        </Bubble>
        {sent.map((m, i) => (
          <Bubble key={i} who="user">
            {m}
          </Bubble>
        ))}
      </div>

      {/* Composer */}
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
  const playing = useIsPlaying();
  const anims = useAnimations();

  const name = props?.userName && props.userName !== '{name}' ? props.userName : '';

  // Live, tappable state mirroring the real home.
  const [selectedDate, setSelectedDate] = useState(() => {
    // Avoid Date.now() noise: just default to "today" via the strip's own logic.
    return new Date().toISOString().slice(0, 10);
  });
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [feedbackAck, setFeedbackAck] = useState(false);
  const [habitStatus, setHabitStatus] = useState<Record<string, 'done' | 'missed' | 'none'>>({});

  // The plan to show, real where we have it, sample otherwise.
  const habits = flow && flow.habits.length > 0 ? flow.habits : SAMPLE_HABITS;
  const cfgs = useMemo<Record<string, HabitScheduleCfg>>(
    () => (flow && Object.keys(flow.habitConfigs).length > 0 ? flow.habitConfigs : SAMPLE_CFGS),
    [flow],
  );

  // Reveal state machine. In a live play with animations we start at the top
  // and tap through; on the static canvas (or animations off) we show the
  // finished home so the tile reads complete.
  const live = playing && anims;
  const [stage, setStage] = useState<Stage>(live ? STAGE.TOP : STAGE.LIVE);
  useEffect(() => {
    setStage(live ? STAGE.TOP : STAGE.LIVE);
  }, [live]);

  const next = () => setStage((s) => (Math.min(STAGE.LIVE, s + 1) as Stage));

  // The coach's line for the current reveal stage. Woven with the name and the
  // real plan so the landing reflects what they just built, not a generic line.
  const captions: Record<number, string> = {
    [STAGE.TOP]: name
      ? `Welcome home, ${name}. This is your space now.`
      : 'Welcome home. This is your space now.',
    [STAGE.CONNECT]: 'Everything we just did lives here. The chat is always a tap away.',
    [STAGE.HABITS]:
      habits.length > 0
        ? 'These are your habits. Tap one done when you finish it.'
        : 'Your habits will show up right here.',
    [STAGE.FEEDBACK]: "This button is for me. Tell me what's working, or not, anytime.",
    [STAGE.CHAT]: "The chat's always right here. This view just lets you see and tap things.",
  };

  const revealing = stage !== STAGE.LIVE;

  return (
    <div style={{ position: 'relative', height: 792 }}>
      {/* The home itself, revealed a piece at a time. It scrolls inside the
          full-bleed frame (above the bottom nav) while the coach caption +
          floating buttons + nav stay pinned. Reserve bottom space so the last
          habit is never hidden behind them. */}
      <div
        className="flex flex-col gap-5 pt-1"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 64,
          overflowY: 'auto',
          paddingBottom: revealing ? 140 : 92,
        }}
      >
        {/* TOP HALF: header + dates + the two quick-action cards. */}
        <Reveal show={stage >= STAGE.TOP}>
          <div
            style={{
              borderRadius: 24,
              outline: stage === STAGE.CONNECT ? `2px solid ${BLUE}` : '2px solid transparent',
              outlineOffset: 6,
              transition: 'outline-color 320ms ease-out',
            }}
            className="flex flex-col gap-5"
          >
            <HomeHeader userName={name || 'there'} />
            <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
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
        </Reveal>

        {/* The connect-to-chat moment: a soft ribbon links the screen to the
            chat, so the visual app and the chat read as the same space. */}
        {stage === STAGE.CONNECT && (
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

        {/* BOTTOM HALF: the habit list, with the real schedule they set. */}
        <Reveal show={stage >= STAGE.HABITS}>
          <div className="flex flex-col gap-3">
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
                  isCompleted={(habitStatus[h] ?? 'none') === 'done'}
                  status={habitStatus[h] ?? 'none'}
                  onToggleComplete={() =>
                    setHabitStatus((p) => ({ ...p, [h]: (p[h] ?? 'none') === 'done' ? 'none' : 'done' }))
                  }
                  onMarkMissed={() =>
                    setHabitStatus((p) => ({ ...p, [h]: (p[h] ?? 'none') === 'missed' ? 'none' : 'missed' }))
                  }
                />
              ))}
            </div>

            {/* Journaling, under the habits, same as the real home. */}
            <RecentReflections />
          </div>
        </Reveal>
      </div>

      {/* Floating feedback button (bottom-left). While the coach is pointing it
          out it floats above the caption; once live it settles just above the
          nav, its real home position. */}
      <div
        style={{ position: 'absolute', left: 8, bottom: revealing ? 152 : 78, zIndex: 30, transition: 'bottom 320ms ease-out' }}
      >
        <Reveal show={stage >= STAGE.FEEDBACK}>
          <FeedbackButton onPress={() => setFeedbackAck(true)} />
        </Reveal>
      </div>

      {/* Floating open-chat button (bottom-right), revealed last, settles above the nav. */}
      <div
        style={{ position: 'absolute', right: 8, bottom: revealing ? 152 : 78, zIndex: 30, transition: 'bottom 320ms ease-out' }}
      >
        <Reveal show={stage >= STAGE.CHAT}>
          <OpenChatButton onPress={() => setChatOpen(true)} />
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

      {/* The coach caption that drives the reveal (hidden once live). */}
      {revealing && (
        <CoachCaption text={captions[stage]} isLast={stage === STAGE.CHAT} onNext={next} />
      )}

      {/* The home's bottom nav, pinned to the bottom of the frame. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        <HomeBottomNav />
      </div>

      {/* The open/close chat overlay (covers the whole frame, including the nav). */}
      {chatOpen && <ChatOverlay name={name} onClose={() => setChatOpen(false)} />}

      <style>{`
        @keyframes ggTourCaptionIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes ggTourChatIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
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
