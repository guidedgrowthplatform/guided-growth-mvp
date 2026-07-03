import { Icon } from '@iconify/react';
import { type MutableRefObject } from 'react';
import { IconChatText, IconMic } from '@/components/icons';
import { Orb, type OrbMic, type OrbStateSel, type OrbTalkStyle } from './Orb';
import type { BarStyle, OrbStates, PulseParams } from './orbPresets';

// The home bar canvas: a self-contained mockup of the app's bottom nav (the real
// one is components/layout/BottomNav.tsx, which needs the router + voice
// providers). It mirrors the tuner live: the orb in the notch is the SAME orb the
// tuner drives (look + talking state), and the phone screen background follows the
// tuner's Background control, so you see the orb on the real app background. Build
// and improve the bar around it here; keep the scoop path matched to BottomNav.

// The scooped bar background in two skins: the current solid white, and a
// glassmorph variant (translucent + backdrop blur + hairline highlight) that
// matches the glass orb. The scoop path itself is identical in both.
function BarBackground({ glass }: { glass: boolean }) {
  const fill = glass ? 'rgba(255,255,255,0.42)' : '#ffffff';
  const sideStyle: React.CSSProperties = glass
    ? {
        background: fill,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
      }
    : { background: fill };
  return (
    <div
      className="absolute inset-0 flex"
      style={{
        filter: glass
          ? 'drop-shadow(0px -6px 18px rgba(20,30,60,0.14))'
          : 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))',
      }}
    >
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
  );
}

function Tab({ icon, label, tone }: { icon: string; label: string; tone: string }) {
  return (
    <div className={`flex flex-col items-center justify-end ${tone}`}>
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
}: HomeBarPreviewProps) {
  const dark = bgKey === 'dark';
  const glass = barStyle === 'glass';
  // On the glass bar the app background shows through, so tab tone follows it.
  const tabTone = glass ? (dark ? 'text-white/75' : 'text-slate-500') : 'text-slate-400';
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
      <div
        className="relative overflow-hidden rounded-[34px]"
        style={{
          width: 340,
          height: 560,
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
            <BarBackground glass={glass} />
            <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
              <Orb
                size={91}
                state={orbState}
                style={orbStyle}
                params={params}
                pulse={pulse}
                mic={mic}
                flat
                overlayIcons={{ left: <IconChatText size={24} />, right: <IconMic size={24} /> }}
              />
            </div>
            <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
              <Tab icon="ic:round-home" label="Home" tone={tabTone} />
              <Tab icon="ic:round-leaderboard" label="Progress" tone={tabTone} />
              <div />
              <Tab icon="mingcute:stopwatch-fill" label="Focus" tone={tabTone} />
              <Tab icon="ic:round-person" label="Profile" tone={tabTone} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
