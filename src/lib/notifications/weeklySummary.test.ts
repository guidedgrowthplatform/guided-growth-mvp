import { describe, expect, it } from 'vitest';
import { weeklySummaryCopy } from './weeklySummary';

describe('weeklySummaryCopy', () => {
  it('prompts a start when nothing logged', () => {
    expect(weeklySummaryCopy(0, 0)).toMatch(/No habit completions/);
  });

  it('reports the week percentage', () => {
    expect(weeklySummaryCopy(80, 80)).toContain('80% habit completion this week');
  });

  it('shows upward delta vs monthly average', () => {
    expect(weeklySummaryCopy(80, 60)).toContain('up 20%');
  });

  it('shows downward delta vs monthly average', () => {
    expect(weeklySummaryCopy(40, 60)).toContain('20% below');
  });

  it('notes parity with monthly average', () => {
    expect(weeklySummaryCopy(60, 60)).toContain('Right on your monthly average');
  });
});
