// Thin re-export derived from the ONE source (beatsSource.ts). The text -> clip
// path map is built from the script lines' words + clipPath, so there is no
// second hand-authored clip list to drift. speak() consults clipSrc() so Play
// voices the real recorded clip, not the browser voice.
import { BEATS_SOURCE } from './beatsSource';

const CLIPS = new Map<string, string>();
for (const beat of BEATS_SOURCE) {
  for (const line of beat.script) {
    if (line.clipPath && line.words) CLIPS.set(line.words.trim(), line.clipPath);
  }
}

export function clipSrc(text: string): string | null {
  return CLIPS.get((text || '').trim()) ?? null;
}
