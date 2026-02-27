export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <main className="relative z-10 flex max-w-2xl flex-col items-center gap-8 text-center">
        {/* Logo / Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-10 w-10 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 10v2a7 7 0 0 1-14 0v-2"
            />
            <line x1="12" x2="12" y1="19" y2="22" strokeLinecap="round" />
          </svg>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Guided Growth
          </h1>
          <p className="text-lg text-indigo-200/70">
            Voice-Led Life OS Prototype
          </p>
        </div>

        {/* Description */}
        <p className="max-w-md text-base leading-relaxed text-slate-400">
          Tap the floating mic button in the bottom-right corner to start voice
          input. Speak naturally — your transcript will appear in real-time.
        </p>

        {/* Feature cards */}
        <div className="mt-4 grid w-full gap-4 sm:grid-cols-3">
          <FeatureCard
            icon="🎙️"
            title="Voice Input"
            description="Web Speech API for browser-native speech recognition"
          />
          <FeatureCard
            icon="📱"
            title="Mobile Ready"
            description="Capacitor for iOS and Android native builds"
          />
          <FeatureCard
            icon="⚡"
            title="Lightweight"
            description="Zustand state management, zero-cost voice capture"
          />
        </div>

        {/* Hint */}
        <div className="mt-8 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-400">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
          Click the mic button to begin
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10">
      <span className="text-2xl">{icon}</span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  );
}
