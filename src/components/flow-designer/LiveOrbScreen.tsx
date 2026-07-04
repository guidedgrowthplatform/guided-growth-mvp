import { Icon } from '@iconify/react';
import { BeatOrb } from './BeatOrb';

// A dedicated preview screen: a full phone with the app bottom bar and the live,
// interactive orb in the notch, so you can see the orb in context and click each
// side on/off. Same canonical orb, animated (live). Not a flow beat, just a
// standalone view at the top of the builder.

const APP_BLUE =
  'linear-gradient(to top, rgba(19,91,236,0.72) 0%, rgba(123,164,236,0.34) 50%, rgba(216,228,248,0.82) 100%), #ffffff';

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
      <Icon icon={icon} width={22} />
      <span className="mt-0.5 text-[9px] font-bold">{label}</span>
    </div>
  );
}

export function LiveOrbScreen() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-[10px] font-semibold uppercase"
        style={{ color: '#8a92a8', letterSpacing: '.09em' }}
      >
        Live orb
      </span>
      <div
        className="relative overflow-hidden rounded-[40px]"
        style={{
          width: 300,
          height: 620,
          background: APP_BLUE,
          boxShadow: '0 18px 50px rgba(20,30,60,.28)',
          border: '6px solid #0b0e16',
        }}
      >
        {/* Home content mock so the orb reads in context. */}
        <div className="flex h-full flex-col gap-3 p-5 pb-24">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Good morning</div>
            <div className="text-[17px] font-bold text-slate-800">Let&apos;s grow today</div>
          </div>
          <div className="h-24 rounded-2xl bg-white/60" />
          <div className="h-20 rounded-2xl bg-white/50" />
          <div className="h-20 rounded-2xl bg-white/50" />
        </div>

        {/* Bottom bar with the live, interactive orb in the notch. */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="relative" style={{ height: 72 }}>
            <BarBackground />
            <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
              <BeatOrb size={88} live />
            </div>
            <div className="relative grid h-full grid-cols-5 items-end px-5 pb-2">
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
