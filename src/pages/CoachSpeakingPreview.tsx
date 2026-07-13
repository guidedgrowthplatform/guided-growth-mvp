import { Icon } from '@iconify/react';

// The "coach is speaking" moment for a Library reset, as an immersive, calming
// surface (ref: the moving-gradient mood screen). A full-bleed gradient that
// slowly drifts, soft glow blobs, concentric organic rings that rotate and
// breathe, a twinkling star, and a glass card carrying the coach's line + the
// player. All CSS animation, no deps. Mock.

const KEYFRAMES = `
@keyframes csHue { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes csDriftA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8%,-6%) scale(1.18)} }
@keyframes csDriftB { 0%,100%{transform:translate(0,0) scale(1.1)} 50%{transform:translate(-7%,5%) scale(0.95)} }
@keyframes csSpin { to { transform: rotate(360deg) } }
@keyframes csSpinRev { to { transform: rotate(-360deg) } }
@keyframes csBreathe { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.08);opacity:1} }
@keyframes csTwinkle { 0%,100%{opacity:.45;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
@keyframes csGlow { 0%,100%{opacity:.55} 50%{opacity:.9} }
`;

function Ring({
  size,
  radius,
  duration,
  reverse,
}: {
  size: number;
  radius: string;
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div
      aria-hidden
      className="absolute rounded-full border border-white/25"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        animation: `${reverse ? 'csSpinRev' : 'csSpin'} ${duration}s linear infinite`,
      }}
    />
  );
}

export function CoachSpeakingPreview() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-white">
      {/* Moving gradient base */}
      <div
        className="absolute inset-0 -z-30"
        style={{
          background: 'linear-gradient(150deg, #16255e 0%, #2b47b3 32%, #5b7cf0 62%, #a9c6ff 100%)',
          backgroundSize: '220% 220%',
          animation: 'csHue 20s ease-in-out infinite',
        }}
      />
      {/* Drifting glow blobs */}
      <div
        className="absolute -left-24 top-10 -z-20 h-80 w-80 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(180,205,255,0.55), transparent 70%)',
          animation: 'csDriftA 16s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-20 top-52 -z-20 h-72 w-72 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(120,150,255,0.45), transparent 70%)',
          animation: 'csDriftB 19s ease-in-out infinite',
        }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur"
        >
          <Icon icon="ic:round-arrow-back" width={20} />
        </button>
        <span style={{ animation: 'csTwinkle 3.5s ease-in-out infinite' }}>
          <Icon icon="ph:sparkle-fill" width={22} className="text-white" />
        </span>
        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur"
        >
          <Icon icon="ic:round-menu" width={20} />
        </button>
      </div>

      {/* Presence + organic rings */}
      <div className="relative flex flex-1 items-center justify-center">
        <div
          className="absolute h-56 w-56 rounded-full blur-2xl"
          style={{
            background: 'radial-gradient(circle, rgba(220,235,255,0.75), transparent 65%)',
            animation: 'csGlow 6s ease-in-out infinite',
          }}
        />
        <div
          style={{ animation: 'csBreathe 7s ease-in-out infinite' }}
          className="relative flex items-center justify-center"
        >
          <Ring size={240} radius="47% 53% 50% 50%" duration={26} />
          <Ring size={196} radius="52% 48% 54% 46%" duration={20} reverse />
          <Ring size={150} radius="48% 52% 46% 54%" duration={16} />
          <span className="relative" style={{ animation: 'csTwinkle 4s ease-in-out infinite' }}>
            <Icon icon="ph:sparkle-fill" width={26} className="text-white" />
          </span>
        </div>
      </div>

      {/* Glass card: the coach speaking + player */}
      <div className="bg-white/12 mx-4 mb-[max(1.5rem,env(safe-area-inset-bottom))] rounded-[2rem] p-6 ring-1 ring-white/20 backdrop-blur-xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
          Coach
        </p>
        <p className="mt-2 text-center text-lg font-medium leading-relaxed text-white">
          Let the breath slow. There is nothing to fix right now.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-xs tabular-nums text-white/70">0:48</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-2/5 rounded-full bg-white/80" />
          </div>
          <span className="text-xs tabular-nums text-white/70">2:00</span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-8">
          <Icon icon="mingcute:rewind-backward-15-line" width={26} className="text-white/80" />
          <button
            type="button"
            aria-label="Pause"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#2b47b3] shadow-lg"
          >
            <Icon icon="mingcute:pause-fill" width={28} />
          </button>
          <Icon icon="mingcute:rewind-forward-15-line" width={26} className="text-white/80" />
        </div>
      </div>

      <style>{KEYFRAMES}</style>
    </div>
  );
}
