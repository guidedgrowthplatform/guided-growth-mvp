import { Icon } from '@iconify/react';
import { type MutableRefObject } from 'react';
import { Orb, type OrbMic, type OrbStateSel, type OrbTalkStyle } from '@/components/orb/Orb';
import type { OrbStates, PulseParams } from './orbPresets';

// The home bar canvas: a self-contained mockup of the app's bottom nav (the real
// one is components/layout/BottomNav.tsx, which needs the router + voice
// providers). It mirrors the tuner live: the orb in the notch is the SAME orb the
// tuner drives (look + talking state), and the phone screen background follows the
// tuner's Background control, so you see the orb on the real app background. Build
// and improve the bar around it here; keep the scoop path matched to BottomNav.

function BarBackground() {
  return (
    <div
      className="absolute inset-0 flex"
      style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))' }}
    >
      <div className="h-full flex-1 bg-white" />
      <svg
        className="block h-full shrink-0 text-white"
        width="140"
        height="72"
        viewBox="0 0 140 72"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0 L14 0 C17 0, 19 1, 20 4 C20 28, 42 50, 70 50 C98 50, 120 28, 120 4 C121 1, 123 0, 126 0 L140 0 L140 72 L0 72 Z"
          fill="currentColor"
        />
      </svg>
      <div className="h-full flex-1 bg-white" />
    </div>
  );
}

function Tab({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-end text-slate-400">
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
  // Orb size in the notch. Defaults to the real bar size (91).
  orbSize?: number;
  // When true, the orb blooms big in the phone body (the coach-greeting state)
  // and the notch stays empty. Used by the Orb states page.
  centered?: boolean;
  // Blank canvas: hide the home-content mock AND the menu bar, leaving just the
  // background and the orb. A clean surface for redesigning the bar / screen.
  blank?: boolean;
  // Caption above the phone.
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
  orbSize = 91,
  centered = false,
  blank = false,
  label = 'Home bar (live)',
}: HomeBarPreviewProps) {
  const dark = bgKey === 'dark';
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
        {/* Home content mock, so the bar and orb read in a real context. Cards are
            translucent so they sit on whatever app background is selected. Hidden
            in blank mode, leaving a clean surface to redesign. */}
        {!blank && (
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

        {/* The big blooming orb: shown in the phone body for the coach-greeting
            (big talking) state. The notch stays empty in this mode. */}
        {centered && (
          <div className="absolute left-1/2 top-[42%] z-40 -translate-x-1/2 -translate-y-1/2">
            <Orb
              size={orbSize}
              state={orbState}
              style={orbStyle}
              params={params}
              pulse={pulse}
              mic={mic}
            />
          </div>
        )}

        {/* The home bar: scooped background, the live orb in the notch, four tabs.
            Hidden in blank mode so the bar can be redesigned from scratch. */}
        {!blank && (
          <div className="absolute inset-x-0 bottom-0">
            <div className="relative" style={{ height: 72 }}>
              <BarBackground />
              {!centered && (
                <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
                  <Orb
                    size={orbSize}
                    state={orbState}
                    style={orbStyle}
                    params={params}
                    pulse={pulse}
                    mic={mic}
                    flat
                  />
                </div>
              )}
              <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
                <Tab icon="ic:round-home" label="Home" />
                <Tab icon="ic:round-leaderboard" label="Progress" />
                <div />
                <Tab icon="mingcute:stopwatch-fill" label="Focus" />
                <Tab icon="ic:round-person" label="Profile" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
