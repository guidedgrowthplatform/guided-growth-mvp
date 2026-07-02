import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// True only while a beat is rendered inside Play (live), so a beat can autoplay
// audio or run a timed animation in Play but stay quiet as a static design tile.
export const PlayingCtx = createContext(false);
export const useIsPlaying = () => useContext(PlayingCtx);

// When false, beats render instantly with no karaoke or step-reveal animation,
// for fast QA of the final state. Provided by the player; defaults to on.
export const AnimationsCtx = createContext(true);
export const useAnimations = () => useContext(AnimationsCtx);

// The shared kit every beat is built from. Import these in a beat file, never
// copy them. A beat is an ordered list of STEPS played in sequence.
//
// A STEP is one part of the beat:
//   - speaker 'coach' + say  -> a white bubble the coach speaks (karaoke reveal)
//   - speaker 'user'  + say  -> a blue bubble the user answers in (karaoke)
//   - render                 -> a component revealed at that step (any palette
//                               component, e.g. an age picker)
// A step can be say only, say + render, or render only (no voice). The player
// fades each step in and waits for the spoken line to finish before the next.

export interface BeatStep {
  id: string;
  speaker: 'coach' | 'user';
  say?: string;
  render?: ReactNode;
}

// One palette entry. Every beat file default-exports exactly one of these, and
// the registry (beats/index.ts) auto-collects them.
export interface BeatDef {
  type: string;
  group: string;
  label: string;
  Comp: (props?: Record<string, string>) => ReactNode;
}

// Types the line in word by word while `active`. Once the player moves on, the
// line shows whole.
export function Karaoke({ text, active }: { text: string; active: boolean }) {
  const parts = text.split(/(\s+)/);
  const total = parts.filter((p) => /\S/.test(p)).length;
  const [n, setN] = useState(active ? 0 : total);
  useEffect(() => {
    if (!active) {
      setN(total);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= total) window.clearInterval(id);
    }, 110);
    return () => window.clearInterval(id);
  }, [text, active, total]);
  const words = parts.filter((p) => /\S/.test(p));
  const shown = words.slice(0, n);
  const head = shown.slice(0, -1).join(' ');
  const last = shown.length ? shown[shown.length - 1] : null;
  return (
    <>
      {head}
      {head && last != null ? ' ' : ''}
      {last != null ? (
        <span key={n} style={{ animation: 'ggWordIn 220ms ease-out' }}>
          {last}
        </span>
      ) : null}
      <style>{`@keyframes ggWordIn{from{opacity:0}to{opacity:1}}`}</style>
    </>
  );
}

// Plays a beat's steps in order. Every step is laid out from the start (its space
// is reserved) and starts invisible, then fades in on its turn, so the layout
// never jumps and each part just fades in. A spoken line gets a read-length pause
// before the next step; a plain step gets a short even beat. When the last step
// has held, it fades back to the top and replays, so the motion loops on the
// builder canvas (in Play you normally advance before it cycles).
export function BeatPlayer({ steps }: { steps: BeatStep[] }) {
  const playing = useIsPlaying();
  const anims = useAnimations();
  const sig = steps.map((s) => `${s.speaker}:${s.say ?? ''}`).join('|');
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    // Animations off: show every step at once. On: start empty and reveal in turn.
    setRevealed(anims ? 0 : steps.length);
  }, [sig, anims, steps.length]);
  useEffect(() => {
    if (!anims) return;
    if (revealed >= steps.length) {
      // In Play, hold the fully revealed beat so the user can act on it. On the
      // static canvas, fade back to the top and replay so the motion loops.
      if (playing) return;
      const t = window.setTimeout(() => setRevealed(0), 2400);
      return () => window.clearTimeout(t);
    }
    const justShown = revealed > 0 ? steps[revealed - 1] : null;
    const dwell =
      revealed === 0 ? 180 : justShown?.say ? 650 + justShown.say.split(/\s+/).length * 110 : 480;
    const t = window.setTimeout(() => setRevealed((r) => r + 1), dwell);
    return () => window.clearTimeout(t);
  }, [revealed, steps.length, playing, anims]);
  return (
    <div className="flex flex-col gap-7">
      {steps.map((s, i) => {
        const shown = i < revealed;
        // A render step (cards, picker) reserves its space from the start and just
        // fades in, so nothing jumps when it appears. A spoken line mounts only
        // when reached, so it still types in from empty (the words, unchanged).
        const reserve = !s.say && !!s.render;
        if (!reserve && !shown) return null;
        return (
          <div
            key={s.id}
            className={reserve ? 'flex flex-col gap-7' : 'flex animate-fade-in flex-col gap-7'}
            style={
              reserve
                ? {
                    opacity: shown ? 1 : 0,
                    transition: 'opacity 520ms ease-out',
                    pointerEvents: shown ? 'auto' : 'none',
                  }
                : undefined
            }
          >
            {s.speaker === 'coach' && s.say && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-[14px] font-medium leading-[1.45] text-content shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.12)]">
                <Karaoke text={s.say} active={anims && i === revealed - 1} />
              </div>
            )}
            {s.render}
            {s.speaker === 'user' && s.say && (
              <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[rgba(19,91,236,0.9)] px-4 py-2.5 text-[14px] font-medium text-white shadow-card">
                <Karaoke text={s.say} active={anims && i === revealed - 1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
