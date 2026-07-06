import { describe, expect, it } from 'vitest';
import type { NarrationSegment } from '../../types';
import { narrationClipSrc } from './narrationClips';
import {
  cardVisibleAt,
  closeSegments,
  narrationDone,
  REVEAL_ALL,
  revealCountAt,
  scriptSegments,
  silentDwellMs,
  visibleBubbles,
} from './narrationSchedule';

// The state-check shape: two bubbles, then four element reveals.
const STATE_CHECK: NarrationSegment[] = [
  { kind: 'bubble', n: 1, say: 'First framing line.', clip: 'a' },
  { kind: 'bubble', n: 2, say: 'Second framing line.', clip: 'b' },
  { kind: 'reveal', n: 1, say: "How's your sleep?", clip: 'state_sleep' },
  { kind: 'reveal', n: 2, say: "How's your mood?", clip: 'state_mood' },
  { kind: 'reveal', n: 3, say: "How's your energy?", clip: 'state_energy' },
  { kind: 'reveal', n: 4, say: "How's your stress?", clip: 'state_stress' },
];

describe('narrationSchedule', () => {
  it('bubbles appear one at a time, in order', () => {
    expect(visibleBubbles(STATE_CHECK, 0).map((b) => b.segIdx)).toEqual([0]);
    expect(visibleBubbles(STATE_CHECK, 1).map((b) => b.segIdx)).toEqual([0, 1]);
    // Reveal segments never add bubbles.
    expect(visibleBubbles(STATE_CHECK, 5).map((b) => b.segIdx)).toEqual([0, 1]);
  });

  it('card stays hidden through the bubbles, appears at the first reveal', () => {
    expect(cardVisibleAt(STATE_CHECK, 0)).toBe(false);
    expect(cardVisibleAt(STATE_CHECK, 1)).toBe(false);
    expect(cardVisibleAt(STATE_CHECK, 2)).toBe(true);
  });

  it('reveal count climbs with each reveal segment, blooming as it starts', () => {
    expect(revealCountAt(STATE_CHECK, 1)).toBe(0);
    expect(revealCountAt(STATE_CHECK, 2)).toBe(1);
    expect(revealCountAt(STATE_CHECK, 4)).toBe(3);
    expect(revealCountAt(STATE_CHECK, 5)).toBe(4);
  });

  it('reveal 99 means everything', () => {
    const segs: NarrationSegment[] = [
      { kind: 'bubble', n: 1, say: 'Set the days.' },
      { kind: 'reveal', n: REVEAL_ALL },
    ];
    expect(revealCountAt(segs, 1)).toBe(REVEAL_ALL);
  });

  it('narration with no reveal segments shows the card only after the script', () => {
    const segs: NarrationSegment[] = [
      { kind: 'bubble', n: 1, say: 'One.' },
      { kind: 'bubble', n: 2, say: 'Two.' },
    ];
    expect(cardVisibleAt(segs, 1)).toBe(false);
    expect(cardVisibleAt(segs, 2)).toBe(true);
    expect(narrationDone(segs, 2)).toBe(true);
  });

  it('silent dwell scales with the say length (BeatPlayer cadence)', () => {
    expect(silentDwellMs({ kind: 'reveal', n: 1 })).toBe(450);
    expect(silentDwellMs({ kind: 'bubble', n: 1, say: 'three word line' })).toBe(650 + 3 * 110);
  });
});

describe('scriptSegments / closeSegments (the close split)', () => {
  const WITH_CLOSE: NarrationSegment[] = [
    { kind: 'bubble', n: 1, say: 'Read me your list.', clip: 'onboard_advanced_1' },
    { kind: 'reveal', n: REVEAL_ALL },
    { kind: 'close', n: 1, say: 'Those are all in.', clip: 'close' },
  ];

  it('splits the pre-interaction script from the closes, order kept', () => {
    expect(scriptSegments(WITH_CLOSE).map((s) => s.kind)).toEqual(['bubble', 'reveal']);
    expect(closeSegments(WITH_CLOSE).map((s) => s.say)).toEqual(['Those are all in.']);
  });

  it('close segments never appear as script bubbles or reveals', () => {
    const script = scriptSegments(WITH_CLOSE);
    expect(visibleBubbles(script, script.length).map((b) => b.say)).toEqual(['Read me your list.']);
    expect(revealCountAt(script, script.length)).toBe(REVEAL_ALL);
  });
});

describe('narrationClipSrc', () => {
  it('resolves ids to /voice/ob and passes absolute paths through', () => {
    expect(narrationClipSrc('state_sleep')).toBe('/voice/ob/state_sleep.wav');
    expect(narrationClipSrc('/voice/onboard_state_check.mp3')).toBe(
      '/voice/onboard_state_check.mp3',
    );
  });

  it('prefers the beat mp3Assets entry with a matching id (the Lane B model)', () => {
    const assets = [
      { id: 'close', label: 'close', file: '/voice/onboarding/adv_close.mp3', transcript: 'x' },
    ];
    expect(narrationClipSrc('close', assets)).toBe('/voice/onboarding/adv_close.mp3');
    // Unmatched ids still fall through to the path rules.
    expect(narrationClipSrc('state_sleep', assets)).toBe('/voice/ob/state_sleep.wav');
  });
});
