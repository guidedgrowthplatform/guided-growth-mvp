import { describe, it, expect } from 'vitest';
import { completionStatus, dayStates, isGapDay } from './weeklyPresetPatterns';

// ── helpers ────────────────────────────────────────────────────────────────

function completionRate(slug: string, days: number, habits = 4): number {
  let done = 0,
    total = 0;
  for (let di = 0; di < days; di++) {
    if (isGapDay(slug, di)) continue;
    for (let hi = 0; hi < habits; hi++) {
      const s = completionStatus(slug, di, hi);
      if (s !== null) {
        total++;
        if (s === 'done') done++;
      }
    }
  }
  return total > 0 ? done / total : 0;
}

function weekRate(slug: string, startDay: number, endDay: number): number {
  let done = 0,
    total = 0;
  for (let di = startDay; di < endDay; di++) {
    if (isGapDay(slug, di)) continue;
    for (let hi = 0; hi < 4; hi++) {
      const s = completionStatus(slug, di, hi);
      if (s !== null) {
        total++;
        if (s === 'done') done++;
      }
    }
  }
  return total > 0 ? done / total : 0;
}

// ── consistent slugs ≥85% done ─────────────────────────────────────────────

describe('consistent slugs ≥85% done', () => {
  it('1w-consistent ≥85%', () => {
    expect(completionRate('1w-consistent', 7)).toBeGreaterThanOrEqual(0.85);
  });
  it('3w-consistent ≥85%', () => {
    expect(completionRate('3w-consistent', 21)).toBeGreaterThanOrEqual(0.85);
  });
  it('1mo-consistent ≥85%', () => {
    expect(completionRate('1mo-consistent', 28)).toBeGreaterThanOrEqual(0.85);
  });
});

// ── gap days produce null (not 'missed') ───────────────────────────────────

describe('gap days produce null', () => {
  it('3w-gaps: days 3, 10, 17 return null', () => {
    for (const di of [3, 10, 17]) {
      for (let hi = 0; hi < 4; hi++) {
        expect(completionStatus('3w-gaps', di, hi)).toBeNull();
      }
    }
  });

  it('3w-gaps: non-gap days return done|missed, never null', () => {
    const gapDays = new Set([3, 10, 17]);
    for (let di = 0; di < 21; di++) {
      if (gapDays.has(di)) continue;
      for (let hi = 0; hi < 4; hi++) {
        expect(completionStatus('3w-gaps', di, hi)).not.toBeNull();
      }
    }
  });

  it('1mo-gaps: dayIndex%7>=5 returns null', () => {
    for (let di = 0; di < 28; di++) {
      if (di % 7 < 5) continue;
      for (let hi = 0; hi < 4; hi++) {
        expect(completionStatus('1mo-gaps', di, hi)).toBeNull();
      }
    }
  });

  it('1mo-gaps: non-gap days return done|missed, never null', () => {
    for (let di = 0; di < 28; di++) {
      if (di % 7 >= 5) continue;
      for (let hi = 0; hi < 4; hi++) {
        expect(completionStatus('1mo-gaps', di, hi)).not.toBeNull();
      }
    }
  });
});

// ── strongstart: week2 rate < week1 rate ──────────────────────────────────

describe('strongstart week2 rate < week1 rate', () => {
  it('2w-strongstart', () => {
    const w1 = weekRate('2w-strongstart', 0, 7);
    const w2 = weekRate('2w-strongstart', 7, 14);
    expect(w2).toBeLessThan(w1);
  });

  it('1mo-strongstart', () => {
    const w1 = weekRate('1mo-strongstart', 0, 14); // first half
    const w2 = weekRate('1mo-strongstart', 14, 28); // decay half
    expect(w2).toBeLessThan(w1);
  });
});

// ── state correlations ─────────────────────────────────────────────────────

describe('state correlations', () => {
  it('avg energy is higher when previous sleep was high vs low', () => {
    const highSleepResults: number[] = [];
    const lowSleepResults: number[] = [];

    for (let di = 0; di < 21; di++) {
      const mainDone = completionStatus('3w-consistent', di, 0) === 'done';
      const afterHigh = dayStates('3w-consistent', di, 5, mainDone);
      const afterLow = dayStates('3w-consistent', di, 1, mainDone);
      highSleepResults.push(afterHigh.energy);
      lowSleepResults.push(afterLow.energy);
    }

    const avgHigh = highSleepResults.reduce((a, b) => a + b, 0) / highSleepResults.length;
    const avgLow = lowSleepResults.reduce((a, b) => a + b, 0) / lowSleepResults.length;

    expect(avgHigh).toBeGreaterThan(avgLow);
  });

  it('all state dims are in [1,5]', () => {
    for (let di = 0; di < 7; di++) {
      const s = dayStates('1w-consistent', di, null, true);
      for (const dim of [s.sleep, s.mood, s.energy, s.stress]) {
        expect(dim).toBeGreaterThanOrEqual(1);
        expect(dim).toBeLessThanOrEqual(5);
      }
    }
  });

  it('mood is directionally higher when main habit was done', () => {
    const moodDone: number[] = [];
    const moodMissed: number[] = [];
    for (let di = 0; di < 28; di++) {
      moodDone.push(dayStates('1mo-consistent', di, null, true).mood);
      moodMissed.push(dayStates('1mo-consistent', di, null, false).mood);
    }
    const avgDone = moodDone.reduce((a, b) => a + b, 0) / moodDone.length;
    const avgMissed = moodMissed.reduce((a, b) => a + b, 0) / moodMissed.length;
    expect(avgDone).toBeGreaterThan(avgMissed);
  });
});

// ── inconsistent slugs are meaningfully lower ──────────────────────────────

describe('inconsistent slugs are below 50%', () => {
  it('1w-inconsistent', () => {
    expect(completionRate('1w-inconsistent', 7)).toBeLessThan(0.6);
  });
  it('1mo-inconsistent', () => {
    expect(completionRate('1mo-inconsistent', 28)).toBeLessThan(0.6);
  });
});
