import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import type { CaptionLine } from '@/components/welcome/splashCaptions';

interface CoachIntroBubbleProps {
  /** The coach audio; the bubble fills in following its currentTime, in sync with the voice and waves. */
  audioRef: RefObject<HTMLAudioElement | null>;
  lines: CaptionLine[];
  /** Show only while the coach is speaking. */
  active: boolean;
  /** CSS top for the bubble container (sits below the orb). */
  top?: string;
}

function flatten(lines: CaptionLine[]): { t: number; w: string }[] {
  const words: { t: number; w: string }[] = [];
  for (const l of lines) for (const w of l.words) words.push(w);
  return words;
}

// The coach's words appear inside the real app chat bubble (the blue
// "GUIDED GROWTH COACH" bubble), filling in word by word as the clip plays, the
// way the live chat does it. Reads the audio's currentTime and only re-renders
// when another word lands.
export function CoachIntroBubble({ audioRef, lines, active, top = '12px' }: CoachIntroBubbleProps) {
  const wordsRef = useRef(flatten(lines));
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  countRef.current = count;

  useEffect(() => {
    wordsRef.current = flatten(lines);
  }, [lines]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      const t = el ? el.currentTime : 0;
      const ws = wordsRef.current;
      let c = 0;
      for (let i = 0; i < ws.length; i++) {
        if (t >= ws[i].t) c = i + 1;
        else break;
      }
      if (c !== countRef.current) setCount(c);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  const ws = wordsRef.current;
  const text = ws
    .slice(0, count)
    .map((x) => x.w)
    .join(' ');
  const show = active && count > 0;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        paddingLeft: 16,
        display: 'flex',
        justifyContent: 'flex-start',
        opacity: show ? 1 : 0,
        transition: 'opacity 240ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <ChatBubble role="ai" text={text} streaming animate={false} compact />
    </div>
  );
}
