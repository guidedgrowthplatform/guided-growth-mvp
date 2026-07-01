import { type MutableRefObject } from 'react';
import { Icon } from '@iconify/react';
import { IconChatText, IconMic } from '@/components/icons';
import { Orb, type OrbMic, type OrbStateSel, type OrbTalkStyle } from './Orb';
import type { OrbStates, PulseParams } from './orbPresets';

// The home bar canvas: a self-contained mockup of the app's bottom nav (the real
// one is components/layout/BottomNav.tsx, which needs the router + voice
// providers). The orb in the notch is the SAME live orb the tuner drives, so any
// change to the orb shows here too. Build and improve the bar around it here;
// keep the DualButton geometry and the scoop path matched to BottomNav.

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
}

export function HomeBarPreview({ orbState, orbStyle, params, pulse, mic }: HomeBarPreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="text-[11px] font-semibold uppercase"
        style={{ color: '#8a92a8', letterSpacing: '.09em' }}
      >
        Home bar (live)
      </div>
      <div
        className="relative overflow-hidden rounded-[34px] bg-white"
        style={{ width: 340, height: 560, boxShadow: '0 18px 50px rgba(20,30,60,.28)' }}
      >
        {/* Content placeholder: swap for the real home page while building. */}
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="h-7 w-40 rounded-md bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-50" />
          <div className="h-28 rounded-2xl bg-slate-50" />
          <div className="h-28 rounded-2xl bg-slate-50" />
        </div>

        {/* The home bar: scooped background, the live orb in the notch, four tabs. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="relative" style={{ height: 72 }}>
            <BarBackground />
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
              <Tab icon="ic:round-home" label="Home" />
              <Tab icon="ic:round-leaderboard" label="Progress" />
              <div />
              <Tab icon="mingcute:stopwatch-fill" label="Focus" />
              <Tab icon="ic:round-person" label="Profile" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
