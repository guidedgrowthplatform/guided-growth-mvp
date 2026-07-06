// Pure deterministic pattern generators for weekly QA preset seeding.
// ESM version (mirrors src/utils/qa/weeklyPresetPatterns.ts exactly).
// No I/O; no Math.random(); deterministic.

// Deterministic [0,1) float for a given seed string.
// djb2 string fold → mulberry32 finalizer for uniform distribution.
function roll(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  h += 0x6d2b79f5;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  h = (h ^ (h >>> 14)) >>> 0;
  return h / 0x100000000;
}

function clamp15(v) {
  return Math.max(1, Math.min(5, Math.round(v)));
}

/** True when this slug+dayIndex is a gap day (no rows at all). */
export function isGapDay(slug, dayIndex) {
  if (slug === '3w-gaps') return [3, 10, 17].includes(dayIndex);
  if (slug === '1mo-gaps') return dayIndex % 7 >= 5;
  return false;
}

/** Completion status for one (habit, day). null on gap days. */
export function completionStatus(slug, dayIndex, habitIndex) {
  if (isGapDay(slug, dayIndex)) return null;

  const r = roll(`${slug}:${dayIndex}:${habitIndex}`);

  switch (slug) {
    case '1w-consistent':
      return r < 0.9 ? 'done' : 'missed';

    case '1w-inconsistent':
    case '1mo-inconsistent':
      return r < 0.4 ? 'done' : 'missed';

    case '2w-mixed':
      if (habitIndex === 0) return r < 0.8 ? 'done' : 'missed';
      if (habitIndex === 1) return r < 0.2 ? 'done' : 'missed';
      return r < 0.6 ? 'done' : 'missed';

    case '2w-strongstart':
      return dayIndex < 7 ? (r < 0.85 ? 'done' : 'missed') : (r < 0.35 ? 'done' : 'missed');

    case '1mo-strongstart':
      return dayIndex < 14 ? (r < 0.85 ? 'done' : 'missed') : (r < 0.35 ? 'done' : 'missed');

    case '3w-consistent':
    case '3w-gaps':
    case '1mo-consistent':
    case '1mo-gaps':
      return r < 0.85 ? 'done' : 'missed';

    default:
      return r < 0.7 ? 'done' : 'missed';
  }
}

/**
 * Correlated state dims for a logged day.
 * prevSleep: sleep from the prior day (null on first logged day or after a gap).
 * mainHabitDone: whether habitIndex=0 was 'done' today.
 */
export function dayStates(slug, dayIndex, prevSleep, mainHabitDone) {
  const rSleep = roll(`${slug}:${dayIndex}:sleep`);
  const rNoise = roll(`${slug}:${dayIndex}:noise`);
  const rMood  = roll(`${slug}:${dayIndex}:mood`);

  const isGoodPattern = ['1w-consistent', '3w-consistent', '1mo-consistent', '3w-gaps', '1mo-gaps'].includes(slug);
  const isBadPattern  = ['1w-inconsistent', '1mo-inconsistent'].includes(slug);
  const isDecayPhase  = (['2w-strongstart', '1mo-strongstart'].includes(slug)) && dayIndex >= 7;

  const sleepBase = isGoodPattern ? 3.5 : isBadPattern || isDecayPhase ? 2.5 : 3.1;
  const sleep = clamp15(sleepBase + rSleep * 2 - 0.8);

  const energyBase = prevSleep !== null
    ? prevSleep * 0.65 + 1.0 + rNoise * 1.2
    : sleepBase * 0.65 + 1.0 + rNoise * 1.2;
  const energy = clamp15(energyBase);

  const moodBase = mainHabitDone ? 3.0 + rMood * 1.8 : 1.8 + rMood * 1.8;
  const mood = clamp15(moodBase);

  const stress = clamp15(6.2 - sleep + (rNoise - 0.5) * 0.8);

  return { sleep, mood, energy, stress };
}
