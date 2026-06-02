import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({ default: { query: vi.fn(), connect: vi.fn() } }));

const pool = (await import('../../db.js')).default as {
  connect: ReturnType<typeof vi.fn>;
};
const { createJournalEntry } = await import('../createJournalEntry.js');

const ANON = '11111111-1111-4111-8111-111111111111';

interface Recorded {
  sql: string;
  params: unknown[];
}

function makeClient(opts: { failFieldInsert?: boolean } = {}) {
  const queries: Recorded[] = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (/INSERT INTO journal_entry_fields/.test(sql) && opts.failFieldInsert) {
        throw new Error('field insert blew up');
      }
      if (/INSERT INTO journal_entries/.test(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'entry-1',
              anon_id: ANON,
              type: 'freeform',
              template_id: null,
              title: null,
              date: '2026-06-02',
              habit_id: null,
              created_at: 't',
              updated_at: 't',
            },
          ],
        };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  return { client, queries };
}

beforeEach(() => vi.clearAllMocks());

describe('createJournalEntry', () => {
  it('inserts the entry + each field in a transaction scoped to anon_id', async () => {
    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    const entry = await createJournalEntry({
      anon_id: ANON,
      type: 'freeform',
      title: null,
      date: '2026-06-02',
      fields: { body: 'I felt calm after my walk' },
    });

    const sqls = queries.map((q) => q.sql);
    expect(sqls.some((s) => /BEGIN/.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/.test(s))).toBe(true);

    const parentInsert = queries.find((q) => /INSERT INTO journal_entries/.test(q.sql));
    expect(parentInsert?.params[0]).toBe(ANON);

    const fieldInsert = queries.find((q) => /INSERT INTO journal_entry_fields/.test(q.sql));
    expect(fieldInsert?.params).toEqual(['entry-1', 'body', 'I felt calm after my walk']);

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(entry).toMatchObject({ id: 'entry-1', fields: { body: 'I felt calm after my walk' } });
  });

  it('skips empty/whitespace fields', async () => {
    const { client, queries } = makeClient();
    pool.connect.mockResolvedValue(client);

    await createJournalEntry({
      anon_id: ANON,
      type: 'freeform',
      date: '2026-06-02',
      fields: { body: 'kept', blank: '   ' },
    });

    const fieldInserts = queries.filter((q) => /INSERT INTO journal_entry_fields/.test(q.sql));
    expect(fieldInserts).toHaveLength(1);
    expect(fieldInserts[0].params[1]).toBe('body');
  });

  it('rolls back and rethrows when a field insert fails', async () => {
    const { client, queries } = makeClient({ failFieldInsert: true });
    pool.connect.mockResolvedValue(client);

    await expect(
      createJournalEntry({
        anon_id: ANON,
        type: 'freeform',
        date: '2026-06-02',
        fields: { body: 'boom' },
      }),
    ).rejects.toThrow('field insert blew up');

    expect(queries.some((q) => /ROLLBACK/.test(q.sql))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
