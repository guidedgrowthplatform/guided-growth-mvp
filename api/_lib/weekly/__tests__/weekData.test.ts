import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWeekData, buildWeekGridPayload, renderWeekDataBlock } from '../weekData.js';

const ANON_ID = '11111111-1111-4111-8111-111111111111';
const WEEK_END = '2026-06-14'; // Sunday; window = 2026-06-08 .. 2026-06-14

type Row = Record<string, unknown>;

// Route a fake pg client by matching FROM/table keywords against the SQL text.
function makeClient(routes: Array<[RegExp, Row[]]>) {
  return {
    query: vi.fn(async (sql: string) => {
      for (const [re, rows] of routes) {
        if (re.test(sql)) return { rows };
      }
      return { rows: [] };
    }),
  };
}

function emptyRoutes(overrides: Partial<Record<string, Row[]>> = {}) {
  return [
    [/FROM user_habits/, overrides.habits ?? []],
    [/FROM habit_completions/, overrides.completions ?? []],
    [/FROM daily_checkins/, overrides.checkins ?? []],
    [/FROM journal_entries/, overrides.journal ?? []],
    [/FROM weekly_sessions WHERE anon_id = \$1$/, overrides.sessionCount ?? [{ n: 0 }]],
    [/FROM weekly_sessions[\s\S]*completed_at IS NOT NULL/, overrides.lastWeek ?? []],
  ] as Array<[RegExp, Row[]]>;
}

beforeEach(() => vi.clearAllMocks());

describe('buildWeekData: polarity tolerance', () => {
  it('treats binary_do and binary_build as build', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          { id: 'h1', name: 'Gym', habit_type: 'binary_do', cadence: 'daily', schedule_days: null },
          {
            id: 'h2',
            name: 'Reading',
            habit_type: 'binary_build',
            cadence: 'daily',
            schedule_days: null,
          },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.habits.map((h) => h.polarity)).toEqual(['build', 'build']);
  });

  it('treats binary_avoid and binary_break as break', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          {
            id: 'h1',
            name: 'No news',
            habit_type: 'binary_avoid',
            cadence: 'daily',
            schedule_days: null,
          },
          {
            id: 'h2',
            name: 'No sugar',
            habit_type: 'binary_break',
            cadence: 'daily',
            schedule_days: null,
          },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.habits.map((h) => h.polarity)).toEqual(['break', 'break']);
  });
});

describe('buildWeekData: 3-state day mapping', () => {
  it('maps done/missed rows and pending (no row) correctly, respecting schedule', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          {
            id: 'h1',
            name: 'Gym',
            habit_type: 'binary_do',
            cadence: '3x/week',
            schedule_days: [1, 3, 5], // Mon, Wed, Fri
          },
        ],
        completions: [
          { habit_id: 'h1', date: '2026-06-08', status: 'done' }, // Monday
          { habit_id: 'h1', date: '2026-06-10', status: 'missed' }, // Wednesday
          // 2026-06-12 (Friday) has no row -> pending
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    const gym = week.habits[0];
    const byDate = new Map(gym.days.map((d) => [d.date, d]));

    expect(byDate.get('2026-06-08')).toMatchObject({ scheduled: true, status: 'done' });
    expect(byDate.get('2026-06-10')).toMatchObject({ scheduled: true, status: 'missed' });
    expect(byDate.get('2026-06-12')).toMatchObject({ scheduled: true, status: 'pending' });
    // Tuesday is not in schedule_days -> unscheduled, and never counted as pending-problem.
    expect(byDate.get('2026-06-09')).toMatchObject({ scheduled: false, status: 'pending' });

    expect(gym.doneCount).toBe(1);
    expect(gym.scheduledCount).toBe(3); // Mon, Wed, Fri in the window
  });

  it('null/empty schedule_days means scheduled every day (cadence-default daily)', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          {
            id: 'h1',
            name: 'Meditate',
            habit_type: 'binary_do',
            cadence: 'daily',
            schedule_days: [],
          },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.habits[0].scheduledCount).toBe(7);
    expect(week.habits[0].days.every((d) => d.scheduled)).toBe(true);
  });
});

describe('buildWeekData: thinData flag', () => {
  it('is true when fewer than 3 days in the window have any evidence', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          { id: 'h1', name: 'Gym', habit_type: 'binary_do', cadence: 'daily', schedule_days: null },
        ],
        completions: [{ habit_id: 'h1', date: '2026-06-08', status: 'done' }],
        checkins: [{ date: '2026-06-09', sleep: 4, mood: 3, energy: null, stress: null }],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.loggedDays).toBe(2);
    expect(week.thinData).toBe(true);
  });

  it('is false at exactly 3 logged days', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          { id: 'h1', name: 'Gym', habit_type: 'binary_do', cadence: 'daily', schedule_days: null },
        ],
        completions: [
          { habit_id: 'h1', date: '2026-06-08', status: 'done' },
          { habit_id: 'h1', date: '2026-06-09', status: 'missed' },
        ],
        checkins: [{ date: '2026-06-10', sleep: 4, mood: null, energy: null, stress: null }],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.loggedDays).toBe(3);
    expect(week.thinData).toBe(false);
  });

  it('counts a reflection-only day as logged evidence', async () => {
    const client = makeClient(
      emptyRoutes({
        journal: [
          { id: 'j1', date: '2026-06-11', field_key: 'body', content: 'A good day overall.' },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.loggedDays).toBe(1);
    expect(week.reflections).toEqual([{ date: '2026-06-11', text: 'A good day overall.' }]);
  });

  it('drops reflection content that looks like leftover ciphertext', async () => {
    const client = makeClient(
      emptyRoutes({
        journal: [
          {
            id: 'j1',
            date: '2026-06-11',
            field_key: 'content',
            content: 'YWJjZGVmZ2hpams=.bXVjaGxvbmdlcmNpcGhlcnRleHRibG9iaGVyZQ==',
          },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.reflections).toEqual([]);
    // Ciphertext dropped means no evidence for that day either.
    expect(week.loggedDays).toBe(0);
  });
});

describe('buildWeekData: last week + week number', () => {
  it('reports weekNumber as prior completed session count + 1', async () => {
    const client = makeClient(emptyRoutes({ sessionCount: [{ n: 4 }] }));
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.weekNumber).toBe(5);
  });

  it('surfaces the most recent completed session as lastWeek', async () => {
    const client = makeClient(
      emptyRoutes({
        lastWeek: [
          { focus: 'Sleep consistency', changes: [{ habit: 'Gym', action: 'lower_frequency' }] },
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.lastWeek).toEqual({
      focus: 'Sleep consistency',
      changes: [{ habit: 'Gym', action: 'lower_frequency' }],
    });
  });

  it('lastWeek is null when no completed session exists', async () => {
    const client = makeClient(emptyRoutes());
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    expect(week.lastWeek).toBeNull();
  });
});

describe('buildWeekGridPayload: cell mapping', () => {
  it('maps done/missed/gap/off correctly and sums overall stats', async () => {
    const client = makeClient(
      emptyRoutes({
        habits: [
          {
            id: 'h1',
            name: 'Gym',
            habit_type: 'binary_do',
            cadence: '3x/week',
            schedule_days: [1, 3, 5], // Mon, Wed, Fri
          },
        ],
        completions: [
          { habit_id: 'h1', date: '2026-06-08', status: 'done' }, // Mon
          { habit_id: 'h1', date: '2026-06-10', status: 'missed' }, // Wed
          // Fri (06-12) pending -> gap; Tue/Thu/Sat/Sun unscheduled -> off
        ],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    const grid = buildWeekGridPayload(week);

    expect(grid.rows).toHaveLength(1);
    const row = grid.rows[0];
    expect(row.name).toBe('Gym');
    // window order oldest first: Mon Tue Wed Thu Fri Sat Sun
    expect(row.cells).toEqual(['done', 'off', 'missed', 'off', 'gap', 'off', 'off']);
    expect(row.done).toBe(1);
    expect(row.scheduled).toBe(3);

    expect(grid.overallDone).toBe(1);
    expect(grid.overallScheduled).toBe(3);
    expect(grid.overallPercent).toBe(33); // round(1/3 * 100)
  });

  it('overallPercent is 0 when nothing is scheduled (no divide-by-zero)', async () => {
    const client = makeClient(emptyRoutes());
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    const grid = buildWeekGridPayload(week);
    expect(grid.overallScheduled).toBe(0);
    expect(grid.overallPercent).toBe(0);
  });
});

describe('renderWeekDataBlock', () => {
  it('stays compact and contains no em dash characters', async () => {
    const habits = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`,
      name: `Habit ${i}`,
      habit_type: i % 2 === 0 ? 'binary_do' : 'binary_avoid',
      cadence: 'daily',
      schedule_days: null,
    }));
    const client = makeClient(
      emptyRoutes({
        habits,
        checkins: [{ date: '2026-06-08', sleep: 4, mood: 3, energy: 2, stress: 5 }],
        journal: [
          { id: 'j1', date: '2026-06-09', field_key: 'body', content: 'Solid week, felt good.' },
        ],
        lastWeek: [{ focus: 'Consistency', changes: [] }],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    const block = renderWeekDataBlock(week);

    const lineCount = block.split('\n').length;
    expect(lineCount).toBeLessThan(120);
    expect(block).not.toMatch(/—/); // no em dash
    expect(block).toContain('WEEK DATA');
    expect(block).toContain('Habit 0');
    expect(block).toContain('Last week:');
  });

  it('renders a meta line with week number, logged days, and thin-data flag', async () => {
    const client = makeClient(
      emptyRoutes({
        completions: [],
        checkins: [{ date: '2026-06-08', sleep: 4, mood: null, energy: null, stress: null }],
      }),
    );
    const week = await buildWeekData(client, ANON_ID, WEEK_END);
    const block = renderWeekDataBlock(week);
    expect(block).toMatch(/Meta: week 1, 1 of 7 days logged, thin data\./);
  });
});
