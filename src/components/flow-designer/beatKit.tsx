import { useEffect, useState, type ReactNode } from 'react';

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

// Reveals words one at a time while `active`, dimming the not-yet-spoken ones so
// the line reads like it is being spoken. Shows the whole line when inactive.
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
  let seen = 0;
  return (
    <>
      {parts.map((p, i) => {
        if (!/\S/.test(p)) return <span key={i}>{p}</span>;
        seen += 1;
        const shown = seen <= n;
        return (
          <span key={i} style={{ opacity: shown ? 1 : 0.25, transition: 'opacity 160ms ease-out' }}>
            {p}
          </span>
        );
      })}
    </>
  );
}

// Plays a beat's steps in order: each fades in, coach lines karaoke, and the
// next step waits for the spoken line to finish.
export function BeatPlayer({ steps }: { steps: BeatStep[] }) {
  const sig = steps.map((s) => `${s.speaker}:${s.say ?? ''}`).join('|');
  const [revealed, setRevealed] = useState(1);
  useEffect(() => {
    setRevealed(1);
  }, [sig]);
  useEffect(() => {
    if (revealed >= steps.length) return;
    const cur = steps[revealed - 1];
    const dwell = cur?.say ? 650 + cur.say.split(/\s+/).length * 110 : 450;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(steps.length, r + 1)), dwell);
    return () => window.clearTimeout(t);
  }, [revealed, steps.length]);
  return (
    <div className="flex flex-col gap-4">
      {steps.slice(0, revealed).map((s, i) => {
        const last = i === revealed - 1;
        return (
          <div key={s.id} className="flex animate-fade-in flex-col gap-3">
            {s.speaker === 'coach' && s.say && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-[14px] font-medium leading-[1.45] text-content shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.12)]">
                <Karaoke text={s.say} active={last} />
              </div>
            )}
            {s.render}
            {s.speaker === 'user' && s.say && (
              <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[rgba(19,91,236,0.9)] px-4 py-2.5 text-[14px] font-medium text-white shadow-card">
                <Karaoke text={s.say} active={last} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
