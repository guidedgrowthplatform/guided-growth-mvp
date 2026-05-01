/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { computeProgressSegments } from '../dailyProgress';

describe('computeProgressSegments', () => {
  it('returns zeros when total is 0', () => {
    expect(computeProgressSegments(0, 0)).toEqual({
      segmentCount: 0,
      filledSegments: 0,
      percent: 0,
    });
  });

  it('1 of 1 -> 1 segment, fully filled, 100%', () => {
    expect(computeProgressSegments(1, 1)).toEqual({
      segmentCount: 1,
      filledSegments: 1,
      percent: 100,
    });
  });

  it('3 of 5 -> 5 segments, 3 filled, 60%', () => {
    expect(computeProgressSegments(3, 5)).toEqual({
      segmentCount: 5,
      filledSegments: 3,
      percent: 60,
    });
  });

  it('caps at 8 segments when total > 8 and scales filled', () => {
    // 5 of 10 -> 8 cells, round(0.5 * 8) = 4 filled, 50%
    expect(computeProgressSegments(5, 10)).toEqual({
      segmentCount: 8,
      filledSegments: 4,
      percent: 50,
    });
  });

  it('handles all-completed with capped segments', () => {
    expect(computeProgressSegments(12, 12)).toEqual({
      segmentCount: 8,
      filledSegments: 8,
      percent: 100,
    });
  });

  it('clamps completed greater than total', () => {
    expect(computeProgressSegments(9, 5)).toEqual({
      segmentCount: 5,
      filledSegments: 5,
      percent: 100,
    });
  });

  it('clamps negative completed to 0', () => {
    expect(computeProgressSegments(-2, 5)).toEqual({
      segmentCount: 5,
      filledSegments: 0,
      percent: 0,
    });
  });
});
