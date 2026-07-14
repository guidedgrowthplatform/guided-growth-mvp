import { Icon } from '@iconify/react';
import { type MutableRefObject } from 'react';
import { Orb, type OrbMic, type OrbStateSel, type OrbTalkStyle } from '@/components/orb/Orb';
import type { BarStyle, OrbStates, PulseParams } from './orbPresets';

// The home bar canvas: a self-contained mockup of the app's bottom nav (the real
// one is components/layout/BottomNav.tsx, which needs the router + voice
// providers). It mirrors the tuner live: the orb in the notch is the SAME orb the
// tuner drives (look + talking state), and the phone screen background follows the
// tuner's Background control, so you see the orb on the real app background. Build
// and improve the bar around it here; keep the scoop path matched to BottomNav.

// The scooped bar in two skins. White mirrors the real bar; Glass is the
// glassmorph variant (translucent + backdrop blur) that matches the glass orb.
function BarBackground({ glass }: { glass: boolean }) {
  const glassFill = 'rgba(255,255,255,0.42)';
  const sideStyle: React.CSSProperties | undefined = glass
    ? {
        background: glassFill,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
      }
    : undefined;
  return (
    <div
      className="absolute inset-0 flex"
      style={{
        filter: glass
          ? 'drop-shadow(0px -6px 18px rgba(20,30,60,0.14))'
          : 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))',
      }}
    >
      <div className={glass ? 'h-full flex-1' : 'h-full flex-1 bg-white'} style={sideStyle} />
      <svg
        className={glass ? 'block h-full shrink-0' : 'block h-full shrink-0 text-white'}
        width="140"
        height="72"
        viewBox="0 0 140 72"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0 L14 0 C17 0, 19 1, 20 4 C20 28, 42 50, 70 50 C98 50, 120 28, 120 4 C121 1, 123 0, 126 0 L140 0 L140 72 L0 72 Z"
          fill={glass ? glassFill : 'currentColor'}
        />
      </svg>
      <div className={glass ? 'h-full flex-1' : 'h-full flex-1 bg-white'} style={sideStyle} />
    </div>
  );
}

// The scoop bite masked out of the center piece only (same curve, filled white,
// so as a mask it shows the piece everywhere except the bite).
const FLOATING_SCOOP_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='72' viewBox='0 0 140 72' preserveAspectRatio='none'%3E%3Cpath d='M0 0 L14 0 C17 0 19 1 20 4 C20 28 42 50 70 50 C98 50 120 28 120 4 C121 1 123 0 126 0 L140 0 L140 72 L0 72 Z' fill='%23fff'/%3E%3C/svg%3E\")";

// The third skin: a detached floating glass pill that keeps the scoop notch, so
// the orb nestles into a dip. All three pieces share the same glass so seams are
// invisible; only the center piece carries the scoop mask.
function FloatingBarBackground() {
  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.5)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  };
  return (
    <div
      className="absolute inset-x-4 bottom-2 top-0"
      style={{ filter: 'drop-shadow(0 12px 32px rgba(20,30,60,0.18))' }}
    >
      <div className="absolute inset-0 flex overflow-hidden rounded-[32px]">
        <div className="h-full flex-1" style={glass} />
        <div
          className="h-full shrink-0"
          style={{
            ...glass,
            width: 140,
            maskImage: FLOATING_SCOOP_MASK,
            WebkitMaskImage: FLOATING_SCOOP_MASK,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
        <div className="h-full flex-1" style={glass} />
      </div>
    </div>
  );
}

function Tab({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-end ${isActive ? 'text-primary' : 'text-slate-400'}`}
    >
      <Icon icon={icon} width={24} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </button>
  );
}

// A feature tab in app-shell mode.
export interface AppTab {
  icon: string;
  label: string;
}

interface HomeBarPreviewProps {
  orbState: OrbStateSel;
  orbStyle: OrbTalkStyle;
  params: OrbStates;
  pulse: PulseParams;
  mic: MutableRefObject<OrbMic>;
  // The app screen background, mirrored from the tuner's Background control.
  screenBg: string;
  bgKey: string; // 'light' | 'blue' | 'yellow' | 'dark' (drives text contrast)
  // Bar skin: solid white, glassmorph, or the detached floating pill.
  barStyle?: BarStyle;
  // App-shell mode (optional). When `screen` is set, it replaces the home mock,
  // and `tabs` (4 entries) replaces the default nav tabs, so the same bar + orb
  // wrap a real feature screen with feature tabs.
  screen?: React.ReactNode;
  tabs?: AppTab[];
  activeTab?: number;
  onTabChange?: (i: number) => void;
  label?: string;
}

export function HomeBarPreview({
  orbState,
  orbStyle,
  params,
  pulse,
  mic,
  screenBg,
  bgKey,
  barStyle = 'white',
  screen,
  tabs,
  activeTab = 0,
  onTabChange,
  label = 'Home bar (live)',
}: HomeBarPreviewProps) {
  const dark = bgKey === 'dark';
  const glass = barStyle === 'glass';
  const floating = barStyle === 'floating';
  const subText = dark ? 'text-white/60' : 'text-slate-500';
  const titleText = dark ? 'text-white' : 'text-slate-800';
  const itemText = dark ? 'text-white/90' : 'text-slate-700';
  const card = dark ? 'bg-white/10' : 'bg-white/60';
  const block = dark ? 'bg-white/15' : 'bg-white/50';
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="text-[11px] font-semibold uppercase"
        style={{ color: '#8a92a8', letterSpacing: '.09em' }}
      >
        {label}
      </div>
      <div
        className="relative overflow-hidden rounded-[44px]"
        style={{
          width: 340,
          height: 720,
          background: screenBg,
          boxShadow: '0 18px 50px rgba(20,30,60,.28)',
          border: '6px solid #0b0e16',
        }}
      >
        {/* App-shell mode: a real feature screen fills the phone, scrolling under
            the bar. Otherwise the home content mock renders as before. */}
        {screen ? (
          <div className="h-full overflow-y-auto" style={{ paddingBottom: 110 }}>
            {screen}
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4 p-5 pb-24">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-[11px] font-semibold ${subText}`}>Good morning</div>
                <div className={`text-[18px] font-bold ${titleText}`}>Let&apos;s grow today</div>
              </div>
              <div className={`h-9 w-9 rounded-full ${block}`} />
            </div>

            {/* Coach hero card: the orb below is how you reach it. */}
            <div
              className="rounded-3xl p-4 text-white"
              style={{ background: 'linear-gradient(135deg,#2f6bff,#5b8cff)' }}
            >
              <div className="text-[12px] font-semibold opacity-90">Your coach</div>
              <div className="mt-1 text-[15px] font-bold leading-snug">
                Tap the orb to talk it through
              </div>
              <div className="mt-3 h-1.5 w-24 rounded-full bg-white/30" />
            </div>

            {/* A few home items so the layout feels lived-in. */}
            <div className="flex flex-col gap-3">
              {['Morning focus', 'Reflect on yesterday', 'Plan your day'].map((t) => (
                <div key={t} className={`flex items-center gap-3 rounded-2xl p-3 ${card}`}>
                  <div className={`h-9 w-9 shrink-0 rounded-xl ${block}`} />
                  <div className="flex-1">
                    <div className={`text-[13px] font-semibold ${itemText}`}>{t}</div>
                    <div className={`mt-1 h-2 w-2/3 rounded-full ${block}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The home bar: scooped background, the live orb in the notch, four tabs. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="relative" style={{ height: 72 }}>
            {floating ? <FloatingBarBackground /> : <BarBackground glass={glass} />}
            <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
              <Orb
                size={91}
                state={orbState}
                style={orbStyle}
                params={params}
                pulse={pulse}
                mic={mic}
                flat
              />
            </div>
            <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
              {tabs ? (
                <>
                  <Tab
                    icon={tabs[0].icon}
                    label={tabs[0].label}
                    isActive={activeTab === 0}
                    onClick={() => onTabChange?.(0)}
                  />
                  <Tab
                    icon={tabs[1].icon}
                    label={tabs[1].label}
                    isActive={activeTab === 1}
                    onClick={() => onTabChange?.(1)}
                  />
                  <div />
                  <Tab
                    icon={tabs[2].icon}
                    label={tabs[2].label}
                    isActive={activeTab === 2}
                    onClick={() => onTabChange?.(2)}
                  />
                  <Tab
                    icon={tabs[3].icon}
                    label={tabs[3].label}
                    isActive={activeTab === 3}
                    onClick={() => onTabChange?.(3)}
                  />
                </>
              ) : (
                <>
                  <Tab icon="ic:round-home" label="Home" />
                  <Tab icon="ic:round-leaderboard" label="Progress" />
                  <div />
                  <Tab icon="mingcute:stopwatch-fill" label="Focus" />
                  <Tab icon="ic:round-person" label="Profile" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
