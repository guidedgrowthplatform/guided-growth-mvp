import { describe, expect, it } from 'vitest';
import { joinBrainDumpChunks, mergeBrainDumpChunks } from '../brainDumpTurnMerge.js';

// W2-D / F10 live-path follow-on: the model splits one brain dump across
// multiple submit_brain_dump calls in a single turn (observed 4x and 6x live),
// and the handler's overwrite semantics kept only the LAST chunk. The route
// accumulates chunks with this helper so the row ends the turn with all of them.
describe('mergeBrainDumpChunks', () => {
  it('accumulates per-habit chunks (the observed live failure shape)', () => {
    let chunks: string[] = [];
    chunks = mergeBrainDumpChunks(chunks, 'Walking.');
    chunks = mergeBrainDumpChunks(chunks, 'Reading.');
    chunks = mergeBrainDumpChunks(chunks, 'Drinking more water.');
    expect(chunks).toEqual(['Walking.', 'Reading.', 'Drinking more water.']);
    expect(joinBrainDumpChunks(chunks)).toBe('Walking.\nReading.\nDrinking more water.');
  });

  it('an identical repeat call is a no-op (dedupe)', () => {
    let chunks = mergeBrainDumpChunks([], 'Walking. Reading.');
    chunks = mergeBrainDumpChunks(chunks, 'Walking. Reading.');
    expect(chunks).toEqual(['Walking. Reading.']);
  });

  it('a fragment already covered by an accumulated chunk is a no-op', () => {
    let chunks = mergeBrainDumpChunks([], 'Walking. Reading. Drinking more water.');
    chunks = mergeBrainDumpChunks(chunks, 'Reading.');
    expect(chunks).toEqual(['Walking. Reading. Drinking more water.']);
  });

  it('a superset re-send replaces the chunks it covers (full-dump retry)', () => {
    let chunks = mergeBrainDumpChunks([], 'Walking.');
    chunks = mergeBrainDumpChunks(chunks, 'Walking. Reading. Drinking more water.');
    expect(chunks).toEqual(['Walking. Reading. Drinking more water.']);
  });

  it('containment comparison is case-insensitive', () => {
    let chunks = mergeBrainDumpChunks([], 'walking. reading.');
    chunks = mergeBrainDumpChunks(chunks, 'WALKING. READING.');
    expect(chunks).toEqual(['walking. reading.']);
  });

  it('ignores empty / whitespace-only chunks', () => {
    expect(mergeBrainDumpChunks(['Walking.'], '   ')).toEqual(['Walking.']);
    expect(mergeBrainDumpChunks([], '')).toEqual([]);
  });
});
