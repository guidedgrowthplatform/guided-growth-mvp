// @vitest-environment jsdom
// Proves SupabaseDataService.createHabit derives habit_type from the NAME via
// @gg/shared (dbHabitType) instead of hardcoding 'binary_build', so a Break
// habit persists 'binary_break' through the frontend data-service seam.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let capturedInsert: Record<string, unknown> | null = null;

// Minimal thenable-free supabase builder. getHabitByName ends in .limit(1)
// (dup check -> empty); createHabit ends in .insert(...).select().single().
function makeBuilder(): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.ilike = chain;
  builder.is = chain;
  builder.order = chain;
  builder.limit = () => Promise.resolve({ data: [], error: null });
  builder.single = () =>
    Promise.resolve({
      data: {
        id: 'h1',
        name: (capturedInsert?.name as string) ?? 'x',
        cadence: 'daily',
        schedule_days: null,
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      },
      error: null,
    });
  builder.insert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
    capturedInsert = Array.isArray(payload) ? payload[0] : payload;
    return builder;
  };
  return builder;
}

vi.mock('../../supabase', () => ({
  supabase: { from: () => makeBuilder() },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ anonId: 'anon-1', user: { id: 'u1' } }) },
}));

const { SupabaseDataService } = await import('../supabase-data-service');

beforeEach(() => {
  capturedInsert = null;
});

describe('SupabaseDataService.createHabit — polarity persistence', () => {
  it('persists binary_break for a predefined Break habit', async () => {
    const svc = new SupabaseDataService();
    await svc.createHabit('No sugary drink after lunch');
    expect(capturedInsert?.habit_type).toBe('binary_break');
  });

  it('persists binary_build for a predefined Build habit', async () => {
    const svc = new SupabaseDataService();
    await svc.createHabit('Read 10 pages before bed');
    expect(capturedInsert?.habit_type).toBe('binary_build');
  });
});
