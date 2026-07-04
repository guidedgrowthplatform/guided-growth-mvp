import { describe, expect, it } from 'vitest';
import { clampFlushDelayMs, isSemanticEndOfTurn, resolveTurnPauseMs } from './turnDecision';

describe('isSemanticEndOfTurn', () => {
  it('flags trailing conjunctions / articles / infinitives as incomplete', () => {
    for (const t of [
      'I want to talk about my goals and',
      'I skipped it because',
      'tell me about the',
      'I need to',
      'we should go into',
      'that reminds me of my', // possessive awaiting a noun
    ]) {
      expect(isSemanticEndOfTurn(t)).toBe('incomplete');
    }
  });

  it('flags a trailing comma as incomplete', () => {
    expect(isSemanticEndOfTurn('I did the thing,')).toBe('incomplete');
    expect(isSemanticEndOfTurn('there are a few things,')).toBe('incomplete');
  });

  it('flags terminal punctuation as complete', () => {
    for (const t of ['I am done.', 'Let us do it!', 'Why not?', 'He said "go."']) {
      expect(isSemanticEndOfTurn(t)).toBe('complete');
    }
  });

  it('treats a short standalone affirmation as complete', () => {
    for (const t of ['yes', 'okay', 'no thanks', 'sure']) {
      expect(isSemanticEndOfTurn(t)).toBe('complete');
    }
  });

  it('is unsure for an ordinary statement with no terminator', () => {
    for (const t of ['I went to the store', 'hello there friend', 'tell me a story']) {
      expect(isSemanticEndOfTurn(t)).toBe('unsure');
    }
  });

  it('does not over-extend: a sentence ending in an ambiguous word is unsure, not incomplete', () => {
    // "well", "about", pronouns deliberately excluded to avoid false delays.
    expect(isSemanticEndOfTurn('that went really well')).toBe('unsure');
    expect(isSemanticEndOfTurn('what are you thinking about')).toBe('unsure');
    expect(isSemanticEndOfTurn('it was you')).toBe('unsure');
  });

  it('is unsure for empty/whitespace', () => {
    expect(isSemanticEndOfTurn('')).toBe('unsure');
    expect(isSemanticEndOfTurn('   ')).toBe('unsure');
  });

  it('does not let a long affirmation-word phrase count as a short answer', () => {
    // ends in "right" but it's a full clause → not the short-answer path.
    expect(isSemanticEndOfTurn('I think that the plan is right')).toBe('unsure');
  });
});

describe('resolveTurnPauseMs', () => {
  const cfg = { base: 2000, complete: 900, incomplete: 2800 };

  it('maps each verdict to its window', () => {
    expect(resolveTurnPauseMs('I am done.', cfg)).toBe(900);
    expect(resolveTurnPauseMs('I want to go and', cfg)).toBe(2800);
    expect(resolveTurnPauseMs('I went to the store', cfg)).toBe(2000);
  });
});

describe('clampFlushDelayMs', () => {
  const MAX_HOLD = 6000;

  it('no held buffer → the adaptive pause passes through untouched', () => {
    expect(clampFlushDelayMs(2000, null, 10_000, MAX_HOLD)).toBe(2000);
  });

  it('inside the hold window → pause unchanged when it fits', () => {
    // held since t=0, re-armed at t=1000: 2000ms pause ends at 3000 < 6000 cap
    expect(clampFlushDelayMs(2000, 0, 1000, MAX_HOLD)).toBe(2000);
  });

  it('near the cap → delay shrinks to whatever hold remains', () => {
    // held since t=0, re-armed at t=5000: only 1000ms of hold left
    expect(clampFlushDelayMs(2000, 0, 5000, MAX_HOLD)).toBe(1000);
  });

  it('past the cap → flush immediately, never negative', () => {
    expect(clampFlushDelayMs(2000, 0, 7000, MAX_HOLD)).toBe(0);
  });

  it('repeat-cadence livelock breaks: re-arms every 1500ms flush within the cap', () => {
    // The C5 silence shape: a user repeats an utterance every ~1.5s, each
    // repeat re-arming a 2000ms pause — uncapped, the flush never fires.
    const REARM_EVERY_MS = 1500;
    const PAUSE_MS = 2000;

    const flushAtWith = (cap: number | null): number | null => {
      const heldSince = 0;
      let now = 0;
      for (let rearms = 0; rearms < 50; rearms += 1) {
        const delay = cap === null ? PAUSE_MS : clampFlushDelayMs(PAUSE_MS, heldSince, now, cap);
        if (delay <= REARM_EVERY_MS) return now + delay; // timer wins the race → flush
        now += REARM_EVERY_MS; // next repeat lands first and re-arms
      }
      return null; // never flushed
    };

    expect(flushAtWith(null)).toBeNull(); // old behavior: starved forever
    const flushedAt = flushAtWith(MAX_HOLD);
    expect(flushedAt).not.toBeNull();
    expect(flushedAt!).toBeLessThanOrEqual(MAX_HOLD);
  });
});
