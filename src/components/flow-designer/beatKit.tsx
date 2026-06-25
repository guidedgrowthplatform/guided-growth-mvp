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

// Reveals words one at a time while `active`, building up like a chat message
// being typed and sent: only the words spoken so far are on screen, the newest
// fading in. Words not yet reached are not rendered (no faint preview). Shows
// the whole line when inactive.
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
  // Typing / fill-up: only the words spoken so far are on screen, building up
  // like a chat message being typed. Words not yet reached are not rendered.
  // The newest word fades in as it lands.
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

// Plays a beat's steps in order: each fades in, coach lines karaoke, and the
// next step waits for the spoken line to finish. When the beat finishes it holds,
// then replays from the top, so the motion loops on the builder canvas (in Play
// you normally advance before it cycles).
export function BeatPlayer({ steps }: { steps: BeatStep[] }) {
  const sig = steps.map((s) => `${s.speaker}:${s.say ?? ''}`).join('|');
  const [revealed, setRevealed] = useState(1);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setRevealed(1);
    setCycle(0);
  }, [sig]);
  useEffect(() => {
    if (revealed >= steps.length) {
      // Beat fully revealed: hold on it, then loop back to the top. Bumping cycle
      // remounts the steps so the karaoke replays from empty.
      const lastSay = steps[steps.length - 1]?.say;
      const revealMs = lastSay ? lastSay.split(/\s+/).length * 110 : 0;
      const t = window.setTimeout(() => {
        setRevealed(1);
        setCycle((c) => c + 1);
      }, revealMs + 1800);
      return () => window.clearTimeout(t);
    }
    const cur = steps[revealed - 1];
    const dwell = cur?.say ? 650 + cur.say.split(/\s+/).length * 110 : 450;
    const t = window.setTimeout(() => setRevealed((r) => Math.min(steps.length, r + 1)), dwell);
    return () => window.clearTimeout(t);
  }, [revealed, steps.length, cycle]);
  return (
    <div className="flex flex-col gap-4">
      {steps.slice(0, revealed).map((s, i) => {
        const last = i === revealed - 1;
        return (
          <div key={`${s.id}-${cycle}`} className="flex animate-fade-in flex-col gap-3">
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
