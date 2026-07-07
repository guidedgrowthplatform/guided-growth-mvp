/**
 * Home-tour engine adapter (componentType 'home-tour').
 *
 * The home-tour flow (flows/home-tour-v1.ts) is five beats, one per reveal stage
 * (land, connect, reveal, chat, live). In the engine each stage is its OWN beat,
 * so this adapter renders ONE stage (node.componentProps.stage) of the
 * reconstructed home, and advances to the next beat via onCapture on the tour's
 * progress gesture: tapping the coach caption (land..chat), or the "Let's go" CTA
 * on the terminal live stage (that completes the flow). readOnly renders inert.
 *
 * Ported from the flow-designer beat (src/components/flow-designer/beats/homeTour.tsx),
 * with its designer state contexts (beatKit / flowStateCtx) dropped: the home is
 * static sample data, and per-beat local state, exactly as the designer fallback did.
 *
 * NO EM DASHES in this file.
 */
import { Icon } from '@iconify/react';
import { useMemo, useRef, useState } from 'react';
import { DateStrip } from '@/components/home/DateStrip';
import { FeedbackButton } from '@/components/home/FeedbackButton';
import { HabitListItem } from '@/components/home/HabitListItem';
import { HomeHeader } from '@/components/home/HomeHeader';
import { OpenChatButton } from '@/components/home/OpenChatButton';
import { QuickActionCards } from '@/components/home/QuickActionCards';
import { Button } from '@/components/ui/Button';
import type { BeatAdapterProps } from '../componentRegistry';
import {
  BLUE,
  ChatOverlay,
  ChatPeek,
  CoachCaption,
  FONT,
  HomeBottomNav,
  LiveStateCheck,
  RecentReflections,
  Reveal,
  SAMPLE_CFGS,
  SAMPLE_HABITS,
  scheduleSubtitle,
  stageIndex,
  TourKeyframes,
} from './homeTourPieces';

type HabitCellStatus = 'done' | 'missed' | 'none';

export function HomeTourAdapter({ node, answers, onCapture, readOnly }: BeatAdapterProps) {
  const props = node.componentProps as {
    stage?: string;
    userName?: string;
    coachLine?: string;
  };

  const advancedRef = useRef(false);
  const advance = () => {
    if (readOnly || advancedRef.current) return;
    advancedRef.current = true;
    onCapture({ data: {} });
  };

  // Active beat animates; a frozen (readOnly) past receipt does not.
  const live = !readOnly;

  const nickname = typeof answers.nickname === 'string' ? answers.nickname : '';
  const name = props.userName && props.userName !== '{name}' ? props.userName : nickname;
  // W3-B: this tour previews the real Home the user is about to land on, so it
  // must reflect the real morning-checkin outcome (server truth, answers.morningCheckin),
  // not always show the card as configured.
  const showMorningCheckin = answers.morningCheckin != null;

  // This beat is placed once per tour stage; the stage prop drives what shows.
  const idx = stageIndex(props.stage);
  const showHabits = idx >= 2; // reveal, chat, live
  const showButtons = idx >= 3; // chat, live
  const isLive = idx === 4;
  const showCaption = !isLive; // the coach narrates every beat except the last
  const connectRing = idx === 1;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [habitStatus, setHabitStatus] = useState<Record<string, HabitCellStatus>>({});
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [feedbackAck, setFeedbackAck] = useState(false);

  const habits = SAMPLE_HABITS;
  const cfgs = SAMPLE_CFGS;

  // Per-stage line: componentProps override, else the beat opener, else a default.
  const coachLine =
    props.coachLine && props.coachLine.trim()
      ? props.coachLine
      : node.voice.openerText && node.voice.openerText.trim()
        ? node.voice.openerText
        : name
          ? `Welcome home, ${name}. This is your space.`
          : 'Welcome home. This is your space.';

  const toggle = (h: string, kind: 'done' | 'missed') => {
    const cur = habitStatus[h] ?? 'none';
    setHabitStatus({ ...habitStatus, [h]: cur === kind ? 'none' : kind });
  };

  return (
    <div style={{ position: 'relative', height: 792, pointerEvents: readOnly ? 'none' : 'auto' }}>
      {/* The home, scrolling inside the frame above the bottom nav. What is
          revealed depends on the beat's stage. */}
      <div
        className="flex flex-col gap-5 pt-1"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 64,
          overflowY: 'auto',
          paddingBottom: showCaption ? 140 : 92,
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
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div>
            <QuickActionCards
              onCheckInPress={() => setShowCheckIn((v) => !v)}
              onJournalPress={() => setShowCheckIn((v) => !v)}
              showMorningCheckin={showMorningCheckin}
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

        {/* BOTTOM HALF: habits (sample schedule) + journaling. */}
        <Reveal show={showHabits}>
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
                  showNote={false}
                  isCompleted={(habitStatus[h] ?? 'none') === 'done'}
                  status={habitStatus[h] ?? 'none'}
                  onToggleComplete={() => toggle(h, 'done')}
                  onMarkMissed={() => toggle(h, 'missed')}
                />
              ))}
            </div>

            <RecentReflections />
          </div>
        </Reveal>
      </div>

      {/* Floating feedback + open-chat buttons. While the coach narrates they float
          above the caption; on the live beat they settle above the nav. */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          bottom: showCaption ? 152 : 78,
          zIndex: 30,
          transition: 'bottom 320ms ease-out',
        }}
      >
        <Reveal show={showButtons}>
          <FeedbackButton onPress={() => setFeedbackAck(true)} />
        </Reveal>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: showCaption ? 152 : 78,
          zIndex: 30,
          transition: 'bottom 320ms ease-out',
        }}
      >
        <Reveal show={showButtons}>
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

      {/* The coach caption (the minimized chat narrating). Tapping it advances the
          beat. Hidden on the live beat. */}
      {showCaption && (
        <CoachCaption key={idx} text={coachLine} onTap={readOnly ? undefined : advance} />
      )}

      {/* Live beat: the terminal "Let's go" CTA completes the flow (no caption). */}
      {isLive && !readOnly && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 78,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Button variant="primary" size="lg" onClick={advance} className="shadow-card">
            Let's go
          </Button>
        </div>
      )}

      {/* Land beat: the onboarding chat settles into the home (a panel collapses down). */}
      {idx === 0 && live && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: 10,
            bottom: 74,
            zIndex: 48,
            borderRadius: 14,
            background: 'linear-gradient(180deg, #eaf1ff 0%, #f7faff 100%)',
            transformOrigin: 'bottom',
            animation: 'ggHomeCollapse 760ms ease-in forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Chat beat: a quick chat peek (rises up, then docks back down to the button). */}
      {idx === 3 && live && <ChatPeek name={name} />}

      {/* The home's bottom nav, pinned to the bottom of the frame. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        <HomeBottomNav />
      </div>

      {/* The open/close chat overlay (covers the whole frame, including the nav). */}
      {chatOpen && <ChatOverlay name={name} onClose={() => setChatOpen(false)} />}

      <TourKeyframes />
    </div>
  );
}
