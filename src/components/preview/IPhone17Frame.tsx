import { Icon } from '@iconify/react';

// A realistic iPhone 17 device frame (titanium bezel, Dynamic Island, 9:41
// status bar, home indicator) that hosts a LIVE screen via an iframe pointed at
// one of the app's own preview routes. Because it is the real route inside the
// frame, everything stays interactive (the in-screen state toggles work), the
// same way the annotated onboarding render shows each beat on a phone.

interface IPhone17FrameProps {
  /** App route to render inside the phone, e.g. "/__screentime". */
  src: string;
  /** Accessible/title label for the framed screen. */
  title: string;
}

// iPhone 17 logical points: 402 x 874 (2025). Kept 1:1 so the screen renders at
// true device size and nothing is scaled.
const SCREEN_W = 402;
const SCREEN_H = 874;
const STATUS_H = 50;

export function IPhone17Frame({ src, title }: IPhone17FrameProps) {
  return (
    <div
      className="relative rounded-[3.6rem] bg-neutral-800 p-[14px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      style={{ width: SCREEN_W + 28 }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-[2.9rem] bg-white"
        style={{ width: SCREEN_W, height: SCREEN_H }}
      >
        {/* Status bar */}
        <div
          className="relative z-10 flex shrink-0 items-end justify-between px-8 pb-1.5 text-black"
          style={{ height: STATUS_H }}
        >
          <span className="text-[15px] font-semibold tracking-tight">9:41</span>
          <div className="flex items-center gap-1.5">
            <Icon icon="ph:cell-signal-full-fill" width={17} />
            <Icon icon="ph:wifi-high-fill" width={17} />
            <Icon icon="ph:battery-full-fill" width={22} />
          </div>
        </div>

        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-2.5 z-30 h-[34px] w-[112px] -translate-x-1/2 rounded-full bg-black" />

        {/* Live screen */}
        <iframe src={src} title={title} className="w-full flex-1 border-0" loading="lazy" />

        {/* Home indicator */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center">
          <div className="h-1.5 w-[136px] rounded-full bg-black/25" />
        </div>
      </div>
    </div>
  );
}
