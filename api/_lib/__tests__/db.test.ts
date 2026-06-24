import { describe, expect, it, vi } from 'vitest';

const onMock = vi.fn();

vi.mock('pg', () => {
  class Pool {
    query = vi.fn();
    on = onMock;
    connect = vi.fn();
  }
  return { default: { Pool } };
});

await import('../db.js');

describe('db pool', () => {
  it('registers an idle-client error listener (else an idle error crashes the function)', () => {
    expect(onMock).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
