import { describe, it, expect } from 'vitest';
import { classifyTarget, PROJECT_REFS } from '../projectRefs.js';

describe('classifyTarget', () => {
  it('matches the prod ref', () => {
    expect(classifyTarget(PROJECT_REFS.prod)).toBe('prod');
  });

  it('matches the staging ref', () => {
    expect(classifyTarget(PROJECT_REFS.staging)).toBe('staging');
  });

  it('classifies a prod pooler DATABASE_URL', () => {
    expect(
      classifyTarget(
        'postgresql://postgres.pmunbflbjpoawicgimyc:x@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('prod');
  });

  it('returns unknown for empty or garbage input', () => {
    expect(classifyTarget('')).toBe('unknown');
    expect(classifyTarget('not-a-real-ref')).toBe('unknown');
  });
});
