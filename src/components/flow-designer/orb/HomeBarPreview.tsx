import { Icon } from '@iconify/react';
import { type MutableRefObject } from 'react';
import { IconChatText, IconMic } from '@/components/icons';
import { Orb, type OrbMic, type OrbStateSel, type OrbTalkStyle } from './Orb';
import type { BarStyle, OrbColors, OrbStates, PulseParams } from './orbPresets';

// The home bar canvas: a self-contained mockup of the app's bottom nav (the real
// one is components/layout/BottomNav.tsx, which needs the router + voice
// providers). It mirrors the tuner live: the orb in the notch is the SAME orb the
// tuner drives (look + talking state), and the phone screen background follows the
// tuner's Background control, so you see the orb on the real app background. Build
// and improve the bar around it here; keep the scoop path matched to BottomNav.

// The scooped bar background in two skins. White mirrors the REAL bar
// (layout/BottomNav.tsx NavBarBackground) 1:1: bg-surface fills + text-surface
// scoop svg + the same drop shadow. Glass is the glassmorph variant (translucent
// + backdrop blur + hairline highlight) that matches the glass orb. The scoop
// path itself is identical in both.
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
      <div className={glass ? 'h-full flex-1' : 'h-full flex-1 bg-surface'} style={sideStyle} />
      <svg
        className={glass ? 'block h-full shrink-0' : 'block h-full shrink-0 text-surface'}
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
      <div className={glass ? 'h-full flex-1' : 'h-full flex-1 bg-surface'} style={sideStyle} />
    </div>
  );
}

// Hex -> rgba, for tinting the bar with the orb's side colors.
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}

// The third bar skin: a detached floating glass pill that KEEPS the scoop notch,
// so the orb still nestles into a dip instead of floating over a flat edge. The
// pill is a rounded, translucent, backdrop-blurred rounded-rect; the same scoop
// path as the other two skins is cut from its top-center. drop-shadow lives on
// the outer wrapper so it follows the scooped + rounded silhouette; overflow +
// border-radius on the inner shell rounds the ends and clips the scoop cutout.
function FloatingBarBackground() {
  const fill = 'rgba(255,255,255,0.5)';
  const sideStyle: React.CSSProperties = {
    background: fill,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  };
  return (
    <div
      className="absolute inset-x-4 bottom-2 top-0"
      style={{ filter: 'drop-shadow(0 12px 32px rgba(20,30,60,0.18))' }}
    >
      <div className="absolute inset-0 flex overflow-hidden rounded-[32px]">
        <div className="h-full flex-1" style={sideStyle} />
        <svg
          className="block h-full shrink-0"
          width="140"
          height="72"
          viewBox="0 0 140 72"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 0 L14 0 C17 0, 19 1, 20 4 C20 28, 42 50, 70 50 C98 50, 120 28, 120 4 C121 1, 123 0, 126 0 L140 0 L140 72 L0 72 Z"
            fill={fill}
          />
        </svg>
        <div className="h-full flex-1" style={sideStyle} />
      </div>
    </div>
  );
}

// Mirrors the real NavTab (layout/BottomNav.tsx): active tab is text-primary,
// inactive is text-content-tertiary. On the glass bar over a dark background the
// inactive tone lightens so it stays readable; active stays primary.
function Tab({
  icon,
  label,
  isActive,
  tone,
}: {
  icon: string;
  label: string;
  isActive?: boolean;
  tone: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-end ${isActive ? 'text-primary' : tone}`}>
      <Icon icon={icon} width={24} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </div>
  );
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
  // Bar skin: the current solid white, or the glassmorph variant.
  barStyle: BarStyle;
  // Side colors, mirrored from the tuner's Colors control.
  colors: OrbColors;
}

export function HomeBarPreview({
  orbState,
  orbStyle,
  params,
  pulse,
  mic,
  screenBg,
  bgKey,
  barStyle,
  colors,
}: HomeBarPreviewProps) {
  const dark = bgKey === 'dark';
  const glass = barStyle === 'glass';
  const floating = barStyle === 'floating';
  const glassy = glass || floating;
  // Inactive-tab tone. White bar = the real bar's text-content-tertiary; on the
  // glassy bars the app background shows through, so the tone follows it.
  const tabTone = glassy ? (dark ? 'text-white/75' : 'text-slate-500') : 'text-content-tertiary';
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
        Home bar (live)
      </div>
      {/* iPhone 17 Pro logical frame: 402 x 874 pt, so the bar spacing reads
          exactly like the real phone instead of a squeezed mock. */}
      <div
        className="relative overflow-hidden rounded-[55px]"
        style={{
          width: 402,
          height: 874,
          background: screenBg,
          boxShadow: '0 18px 50px rgba(20,30,60,.28)',
        }}
      >
        {/* Home content mock, so the bar and orb read in a real context. Cards are
            translucent so they sit on whatever app background is selected. */}
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

        {/* The home bar: scooped background, the live orb in the notch, four tabs. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="relative" style={{ height: 72 }}>
            {floating ? <FloatingBarBackground /> : <BarBackground glass={glass} />}
            {/* Glow bleed: while a side talks, the bar borrows the orb's color
                as a soft gradient rising from the notch, so nav and orb read as
                one piece. Fades out at idle. */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2"
              style={{
                width: 240,
                height: '100%',
                background: `radial-gradient(130px 80px at 50% 0%, ${hexA(orbState === 'user' ? colors.user : colors.ai, 0.3)}, transparent 72%)`,
                opacity: orbState === 'idle' ? 0 : 1,
                transition: 'opacity 0.5s ease',
              }}
            />
            <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
              <Orb
                size={91}
                state={orbState}
                style={orbStyle}
                params={params}
                pulse={pulse}
                mic={mic}
                colors={colors}
                flat
                overlayIcons={{ left: <IconChatText size={24} />, right: <IconMic size={24} /> }}
              />
            </div>
            <div
              className={
                floating
                  ? 'relative grid h-full grid-cols-5 items-center px-6 pb-2'
                  : 'relative grid h-full grid-cols-5 items-end px-6 pb-2'
              }
            >
              <Tab icon="ic:round-home" label="Home" isActive tone={tabTone} />
              <Tab icon="ic:round-leaderboard" label="Progress" tone={tabTone} />
              <div />
              <Tab icon="mingcute:stopwatch-fill" label="Focus" tone={tabTone} />
              <Tab icon="ic:round-person" label="Profile" tone={tabTone} />
            </div>
          </div>
          {/* Safe-area strip. The real bar uses env(safe-area-inset-bottom); in
              this mock we emulate the iPhone's 34pt home-indicator inset so the
              bar sits exactly like it does on the phone. */}
          <div
            className={glassy ? 'relative' : 'relative bg-surface'}
            style={{
              height: 34,
              ...(glass ? { background: 'rgba(255,255,255,0.42)' } : {}),
            }}
          >
            <div
              className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-slate-900/70"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
