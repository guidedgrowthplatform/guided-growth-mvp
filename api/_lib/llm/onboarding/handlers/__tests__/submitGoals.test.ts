import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goalsByCategory } from '@gg/shared/data/onboardingGoals';

vi.mock('../../../../db.js', () => ({ default: { query: vi.fn() } }));

const pool = (await import('../../../../db.js')).default as { query: ReturnType<typeof vi.fn> };
const { submitGoals } = await import('../submitGoals.js');

const ANON = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitGoals', () => {
  it('persists a canonical goal for the chosen category', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ category: 'Sleep better' }] })
      .mockResolvedValueOnce({ rows: [{ data: { goals: ['Wake up earlier'] }, current_step: 5 }] });

    const result = await submitGoals({ anon_id: ANON }, { goals: ['Wake up earlier'] });

    expect(result.ok).toBe(true);
  });

  it('rejects a paraphrase and returns the exact allowed labels', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ category: 'Sleep better' }] });

    const result = await submitGoals({ anon_id: ANON }, { goals: ['Create a bedtime routine'] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Fall asleep earlier');
    expect(result.message).toContain('Sleep more deeply');
    expect(goalsByCategory['Sleep better']).toContain('Fall asleep earlier');
  });
});
