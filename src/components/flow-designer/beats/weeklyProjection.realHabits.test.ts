import { describe, expect, it } from 'vitest';
import {
  projectionRowsForOnboarding,
  type ProjectionState,
} from './weeklyProjection';

describe('weekly projection real-habit handoff', () => {
  it('keeps a selected habit and its exact scheduled days through every frame', () => {
    // This is the same data FlowPlay holds after the user selects “Read 10 pages”
    // and saves its Monday, Wednesday, Friday schedule in the preceding beat.
    const selection = {
      habits: ['Read 10 pages'],
      habitConfigs: { 'Read 10 pages': { days: [1, 3, 5] } },
    };

    const states: ProjectionState[] = ['blank', 'full', 'p78', 'p36', 'gaps'];
    for (const state of states) {
      const result = projectionRowsForOnboarding({
        ...selection,
        state,
        locale: 'en-US',
        startDay: 0,
      });

      expect(result.incompleteHabits).toEqual([]);
      const row = result.rows?.find((candidate) => candidate.name === 'Read 10 pages');
      expect(row?.name).toBe('Read 10 pages');
      // Sunday through Thursday still distinguishes the saved M/W/F schedule.
      // The gaps frame deliberately masks its final two display columns, so its
      // Friday/Saturday cells are both gaps by its own explicit frame contract.
      expect(row?.cells.slice(0, 5).map((cell) => cell !== 'off')).toEqual([
        false,
        true,
        false,
        true,
        false,
      ]);
      expect(row?.cells[5]).not.toBe('off');
      expect(row?.cells[6]).toBe(state === 'gaps' ? 'gap' : 'off');
    }
  });
});
