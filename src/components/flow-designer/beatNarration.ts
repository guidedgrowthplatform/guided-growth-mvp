// Shared beat narration driver. The SAME speak + reveal logic runs the full Play
// view (FlowPlay, all beats in order) and the per-beat Play in the annotated view
// (one beat played in place). Voice is the browser SpeechSynthesis reading the
// lines, a stand-in for the recorded MP3 / Cartesia clip; the word boundaries it
// emits drive the on-screen text + card reveals so the sync is visible.

import type { ScriptLine } from './beatsSource';
import { clipSrc } from './voiceClips';

export type Kind = 'beatplayer' | 'card' | 'grid' | 'coachonly';

// Two beats build their reveal from BeatPlayer steps (the coach greeting/tiles).
const BEATPLAYER = new Set(['profile-beat', 'why-intro']);
// Section cards: a coach bubble + a card whose rows bloom one per spoken line.
const CARD = new Set([
  'state-check',
  'morning-checkin-setup',
  'reflection-card',
  'habit-schedule',
  'advanced-frequency',
]);
// Choice grids: the tiles stagger in over the opener, no per-element line.
const GRID = new Set(['category-grid', 'goals-list', 'habit-picker', 'path-selection']);

export function kindOf(type: string): Kind {
  if (BEATPLAYER.has(type)) return 'beatplayer';
  if (CARD.has(type)) return 'card';
  if (GRID.has(type)) return 'grid';
  return 'coachonly';
}

const NAME = 'Yair';
export function sample(t?: string | null): string {
  return t ? t.split('{name}').join(NAME) : '';
}
export function wait(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}
export function raf() {
  return new Promise<void>((r) => window.requestAnimationFrame(() => r()));
}

// Speak a line with the browser voice; resolve when it finishes (or a length-based
// fallback, in case onend never fires). Muted or unsupported falls back to a timer
// so the reveal still paces itself like the voice would. onWord fires per spoken
// word so the active bubble can karaoke in step with the audio.
export function speak(text: string, muted: boolean, onWord?: (n: number) => void): Promise<void> {
  // If this exact line has a recorded clip (Yair's voice), play it and let the
  // karaoke ride the audio. Otherwise fall back to the browser voice.
  const src = clipSrc(text);
  if (src) return playClip(src, text, muted, onWord);
  return new Promise((res) => {
    const total = text.split(/\s+/).filter(Boolean).length;
    if (!text) {
      res();
      return;
    }
    const ss = window.speechSynthesis;
    if (muted || !ss) {
      let i = 0;
      const id = window.setInterval(() => {
        i += 1;
        onWord?.(i);
        if (i >= total) window.clearInterval(id);
      }, 240);
      window.setTimeout(
        () => {
          window.clearInterval(id);
          onWord?.(total);
          res();
        },
        Math.max(700, total * 240 + 200),
      );
      return;
    }
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      let done = false;
      let wi = 0;
      const finish = () => {
        if (!done) {
          done = true;
          onWord?.(total);
          res();
        }
      };
      u.onboundary = (e) => {
        if (e.name === 'word') {
          wi += 1;
          onWord?.(wi);
        }
      };
      u.onend = finish;
      u.onerror = finish;
      ss.speak(u);
      window.setTimeout(finish, total * 380 + 1600);
    } catch {
      window.setTimeout(res, text.length * 42);
    }
  });
}

export function stopSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  stopClip();
}

// The currently-playing real audio clip (the recorded MP3), so a cancel or a new
// beat can stop it. Only one plays at a time.
let currentClip: HTMLAudioElement | null = null;

export function stopClip() {
  if (currentClip) {
    try {
      currentClip.pause();
      currentClip.src = '';
    } catch {
      /* ignore */
    }
    currentClip = null;
  }
  // Belt and suspenders: pause any DOM <audio> still playing (the greeting
  // component plays its own, and it must never bleed into the next line).
  try {
    document.querySelectorAll('audio').forEach((a) => {
      if (!a.paused) a.pause();
    });
  } catch {
    /* ignore */
  }
}

// Play a real recorded clip (the production MP3) and drive the karaoke by the
// audio's own playback time: words fill across the clip's duration so the bubble
// stays in step with the actual voice. Resolves when the clip ends (or errors, so
// the flow never stalls on a missing file).
export function playClip(
  src: string,
  text: string,
  muted: boolean,
  onWord?: (n: number) => void,
): Promise<void> {
  return new Promise((res) => {
    const total = text.split(/\s+/).filter(Boolean).length;
    stopClip();
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(src);
    } catch {
      res();
      return;
    }
    audio.muted = !!muted;
    currentClip = audio;
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (raf) cancelAnimationFrame(raf);
      if (currentClip === audio) currentClip = null;
      onWord?.(total);
      res();
    };
    const tick = () => {
      const d = audio.duration;
      if (d && isFinite(d) && d > 0) {
        const frac = Math.min(1, audio.currentTime / d);
        onWord?.(Math.min(total, Math.max(0, Math.round(frac * total))));
      }
      raf = requestAnimationFrame(tick);
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio
      .play()
      .then(() => {
        raf = requestAnimationFrame(tick);
      })
      .catch(finish);
    // Safety net in case onended never fires.
    window.setTimeout(finish, 60000);
  });
}

export interface NarrationSeg {
  say: string;
  reveal?: number;
  clip?: string;
  bubble?: number;
  // A real recorded clip URL. When present, this segment plays the actual MP3
  // (the production voice) instead of the browser stand-in, and the karaoke syncs
  // to the audio's own time.
  audioSrc?: string;
}

// Run ONE beat's narration: drive stepReveal (BeatPlayer steps) + elementReveal
// (per-element bloom) + syncWords (karaoke) off the spoken line. `shouldStop`
// is polled between awaits so a cancel (new beat pressed, unmount) bails cleanly.
export async function runBeatNarration(opts: {
  narration?: NarrationSeg[];
  kind: Kind;
  opener: string;
  lines: string[];
  muted: boolean;
  setStepReveal: (n: number | null) => void;
  setElementReveal: (n: number | null) => void;
  setSyncWords: (n: number | null) => void;
  shouldStop: () => boolean;
}): Promise<void> {
  const {
    narration,
    kind,
    opener,
    lines,
    muted,
    setStepReveal,
    setElementReveal,
    setSyncWords,
    shouldStop,
  } = opts;

  // Meshed narration: one flowing script where a `bubble` segment is a coach
  // bubble that types in step with the voice, and a `reveal` segment blooms a card
  // row (its line, if any, spoken verbal-only, never added to a bubble).
  if (narration && narration.length) {
    setStepReveal(0);
    setElementReveal(0);
    setSyncWords(null);
    await raf();
    await wait(40);
    if (shouldStop()) return;
    let cardShown = false;
    for (const seg of narration) {
      if (shouldStop()) return;
      if (seg.bubble != null) {
        setStepReveal(seg.bubble);
        setSyncWords(0);
        if (seg.audioSrc) {
          await playClip(seg.audioSrc, sample(seg.say), muted, (n) => setSyncWords(n));
        } else {
          await speak(sample(seg.say), muted, (n) => setSyncWords(n));
        }
      } else {
        if (!cardShown) {
          setStepReveal(99);
          setSyncWords(null);
          cardShown = true;
          await wait(180);
        }
        if (seg.reveal != null) setElementReveal(seg.reveal);
        if (seg.audioSrc) await playClip(seg.audioSrc, sample(seg.say), muted);
        else if (seg.say) await speak(sample(seg.say), muted);
        else await wait(220);
      }
      await wait(120);
      if (shouldStop()) return;
    }
    setSyncWords(null);
    await wait(500);
    return;
  }

  // Fresh, empty state for the beat, then let the remount settle.
  setStepReveal(0);
  setElementReveal(null);
  await raf();
  await wait(40);
  if (shouldStop()) return;

  // The opener: the coach bubble appears and types in as it is spoken.
  setStepReveal(1);
  if (opener) await speak(opener, muted);
  else await wait(500);
  if (shouldStop()) return;

  if (kind === 'beatplayer') {
    for (let j = 0; j < lines.length; j++) {
      setStepReveal(2 + j);
      await speak(lines[j], muted);
      await wait(120);
      if (shouldStop()) return;
    }
    setStepReveal(99);
  } else if (kind === 'card') {
    setStepReveal(99);
    setElementReveal(0);
    await wait(300);
    for (let j = 0; j < lines.length; j++) {
      setElementReveal(j + 1);
      await speak(lines[j], muted);
      await wait(120);
      if (shouldStop()) return;
    }
  } else if (kind === 'grid') {
    setStepReveal(99);
    setElementReveal(null);
    await wait(1400);
  } else {
    setStepReveal(99);
    await wait(500);
  }
  await wait(400);
}

// Where a script line reveals to on the phone. `opener` and `opener-line` are the
// coach's opening bubble (step 1). `bubble-N` is a coach bubble at step N (karaoke
// in step with the voice). `reveal-N` blooms card row N (verbal-only, no karaoke;
// 99 shows the whole card). Any other component line just speaks verbal-only after
// the card/grid is shown.
function scriptTarget(line: ScriptLine): { bubbleStep: number | null; reveal: number | null } {
  const el = line.bindsTo.element;
  if (line.bindsTo.kind === 'bubble') {
    if (el === 'opener' || el === 'opener-line') return { bubbleStep: 1, reveal: null };
    const m = /^bubble-(\d+)$/.exec(el);
    if (m) return { bubbleStep: Number(m[1]), reveal: null };
    return { bubbleStep: 1, reveal: null };
  }
  // component
  if (el === 'opener' || el === 'opener-line') return { bubbleStep: 1, reveal: null };
  const r = /^reveal-(\d+)$/.exec(el);
  if (r) return { bubbleStep: null, reveal: Number(r[1]) };
  return { bubbleStep: null, reveal: null };
}

// Play a single line's audio. L8: clip-by-text is the default resolve. The line's
// words are looked up in the text -> clip map first (derived from every line's
// words + clipPath), falling back to its own clipPath, so a broken or missing
// clipPath can never silently drop a recorded line to the browser voice.
function playLine(line: ScriptLine, muted: boolean, onWord?: (n: number) => void): Promise<void> {
  const words = sample(line.words);
  const src = line.voice !== null ? (clipSrc(line.words) ?? line.clipPath) : null;
  if (src) return playClip(src, words, muted, onWord);
  return speak(words, muted, onWord);
}

// Run ONE beat straight off its script[] (the one-source driver). Iterates lines
// by seq: a bubble line types into a coach bubble in step with the voice; a
// component line blooms its card row (verbal-only). Same stepReveal / elementReveal
// / syncWords seam the annotated render and the recorded clips already drive, so
// playback reads from script instead of the legacy narration/elements.
// A choice grid can stagger at most this many tiles; the component caps to its
// real option count, so ramping to this covers every category / goal.
const GRID_TILE_MAX = 14;

export async function runBeatScript(opts: {
  script: readonly ScriptLine[];
  muted: boolean;
  setStepReveal: (n: number | null) => void;
  setElementReveal: (n: number | null) => void;
  setSyncWords: (n: number | null) => void;
  shouldStop: () => boolean;
  beatType?: string;
}): Promise<void> {
  const { script, muted, setStepReveal, setElementReveal, setSyncWords, shouldStop, beatType } =
    opts;

  const lines = [...script].sort((a, b) => a.seq - b.seq);

  setStepReveal(0);
  setElementReveal(0);
  setSyncWords(null);
  await raf();
  await wait(40);
  if (shouldStop()) return;

  // No script (splash, get-started, sign-up): show the beat and hold.
  if (lines.length === 0) {
    setStepReveal(99);
    await wait(500);
    return;
  }

  // Choice grids (category / goals / habits pickers): the opener is a long clip,
  // so the option tiles must NOT stagger in on a fixed timer while it plays. Speak
  // the opener bubble(s) fully first, THEN reveal the grid and bloom the tiles,
  // gated on the opener clip END (not a fixed wait). Any component line (e.g. the
  // "create your own" nudge) speaks verbal-only after the tiles are in.
  if (beatType && kindOf(beatType) === 'grid') {
    const bubbles = lines.filter((l) => scriptTarget(l).bubbleStep != null);
    const rest = lines.filter((l) => scriptTarget(l).bubbleStep == null);
    for (const line of bubbles) {
      if (shouldStop()) return;
      const step = scriptTarget(line).bubbleStep ?? 1;
      setStepReveal(step);
      setSyncWords(0);
      await playLine(line, muted, (n) => setSyncWords(n));
      setSyncWords(null);
      await wait(120);
    }
    if (shouldStop()) return;
    // Opener done: reveal the grid step, then bloom the tiles one by one.
    setStepReveal(99);
    await wait(160);
    for (let k = 1; k <= GRID_TILE_MAX; k += 1) {
      if (shouldStop()) return;
      setElementReveal(k);
      await wait(300);
    }
    for (const line of rest) {
      if (shouldStop()) return;
      if (line.words) await playLine(line, muted);
      await wait(120);
    }
    await wait(400);
    return;
  }

  let cardShown = false;
  for (const line of lines) {
    if (shouldStop()) return;
    const { bubbleStep, reveal } = scriptTarget(line);
    if (bubbleStep != null) {
      setStepReveal(bubbleStep);
      setSyncWords(0);
      await playLine(line, muted, (n) => setSyncWords(n));
      setSyncWords(null);
    } else {
      // A card row: reveal the card once, then bloom this row and speak it
      // verbal-only (no bubble karaoke).
      if (!cardShown) {
        setStepReveal(99);
        setSyncWords(null);
        cardShown = true;
        await wait(180);
      }
      if (reveal != null) setElementReveal(reveal);
      if (line.words) await playLine(line, muted);
      else await wait(220);
    }
    await wait(120);
    if (shouldStop()) return;
  }
  setSyncWords(null);
  await wait(500);
}
