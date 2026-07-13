import { IPhone17Frame } from '@/components/preview/IPhone17Frame';

// Storyboard of the four design-mandate features, each shown LIVE inside an
// iPhone 17 frame -- following the annotated onboarding render, but for the new
// features. Every phone is the real preview route in an iframe, so the on-screen
// state toggles stay interactive during the demo.

interface Screen {
  src: string;
  title: string;
  feature: string;
  note: string;
}

const SCREENS: Screen[] = [
  {
    feature: 'Screen Time',
    src: '/__screentime',
    title: 'Screen Time',
    note: 'Digital wellbeing, not parental control. Toggle Set up / Usage / Blocked in-screen. The block is calm and green, and offers a reset.',
  },
  {
    feature: 'Weekly Coach',
    src: '/__weekly-coach',
    title: 'Weekly Coach',
    note: 'The coach reads your week. Toggle Strong week / Gaps week in-screen. The gaps frame says a reassess is still a win.',
  },
  {
    feature: 'Calendar',
    src: '/__calendar-states',
    title: 'Calendar integration',
    note: 'All five states. Defaults to a separate Guided Growth calendar; coach-read is an explicit, off-by-default consent.',
  },
  {
    feature: 'Library · Browse',
    src: '/__reset-browse',
    title: 'Reset Library browse',
    note: 'The Return. A dynamic duration rail that only shows buckets with tracks. Tap a chip to filter.',
  },
  {
    feature: 'Library · Nudge',
    src: '/__reset-nudge',
    title: 'Reset nudge config',
    note: 'Two nudge slots: a time and a reset track picked from a browse-lite sheet, with the notification preview.',
  },
  {
    feature: 'Library · Coach flow',
    src: '/__reset-flow',
    title: 'Reset coach flow',
    note: 'The coach-guided path: how much time, a recommended reset, the player, and a close-out that feeds the check-in.',
  },
];

export function MockStoryboard() {
  return (
    <div className="min-h-dvh bg-neutral-100 px-6 py-10 sm:px-10">
      <header className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Guided Growth</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Design mockups</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          The four mandate features, live on iPhone 17. Each phone is the real screen, so the
          in-screen toggles work. Built from the app&apos;s own components.
        </p>
      </header>

      <div className="mx-auto mt-12 flex max-w-[1600px] flex-wrap justify-center gap-x-12 gap-y-16">
        {SCREENS.map((s) => (
          <figure key={s.src} className="flex w-[402px] flex-col items-center">
            <IPhone17Frame src={s.src} title={s.title} />
            <figcaption className="mt-5 w-full">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{s.feature}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{s.note}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
