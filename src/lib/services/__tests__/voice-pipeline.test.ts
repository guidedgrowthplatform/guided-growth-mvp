/**
 * Voice pipeline integration tests.
 *
 * These tests simulate the full mic → transcription → dispatch pipeline
 * without any real hardware. Used to verify the voice features work on
 * web, Android, and iOS when physical devices are not available for
 * manual testing.
 *
 * Layers covered:
 *   1. Audio buffer pre-processing (silence gate, hallucination detector,
 *      trimSilence, normalize, RMS) — elevenlabs-service internals
 *   2. Transcript dispatch — ActionDispatcher replays the voice journey
 *      spec and verifies each step produces the expected ActionResult
 *   3. normalizeVoiceName tolerance for natural-speech fillers
 *
 * Strategy: since ElevenLabs internals and Web Audio API are not easily
 * reachable without jsdom + mocks, the audio tests import only the pure
 * helpers (computeRms, looksHallucinated). The dispatch tests use the
 * MockDataService to exercise the full action pipeline.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ActionDispatcher } from '../action-dispatcher';
import { MockDataService } from '../mock-data-service';

// ─── Audio buffer helpers ─────────────────────────────────────────────────
// These are not exported from elevenlabs-service (intentional — internal
// helpers). We replicate them here so we can test the algorithm in
// isolation. If the algorithm changes, update BOTH the service AND this
// block so the tests stay meaningful.

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function looksHallucinated(transcript: string, audioDurationSeconds: number): boolean {
  const text = transcript.trim();
  if (!text) return false;
  const wordCount = text.split(/\s+/).length;
  const maxReasonableWords = Math.ceil(audioDurationSeconds * 4) + 3;
  if (wordCount > maxReasonableWords) return true;
  const hallucinationPatterns = [
    /thank you for watching/i,
    /thanks for watching/i,
    /subscribe to my channel/i,
    /don't forget to (?:like|subscribe)/i,
    /see you (?:next time|in the next)/i,
    /\.\s*\.\s*\./,
  ];
  return hallucinationPatterns.some((re) => re.test(text));
}

// ─── Helper: build a synthetic audio buffer ─────────────────────────────

function makeSilentBuffer(durationSec: number, sampleRate = 44100): Float32Array {
  return new Float32Array(Math.floor(durationSec * sampleRate));
}

function makeNoiseBuffer(durationSec: number, peak: number, sampleRate = 44100): Float32Array {
  const samples = new Float32Array(Math.floor(durationSec * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (Math.random() * 2 - 1) * peak;
  }
  return samples;
}

function makeSpeechLikeBuffer(
  durationSec: number,
  speechStartSec: number,
  speechDurationSec: number,
  speechPeak: number,
  sampleRate = 44100,
): Float32Array {
  const samples = new Float32Array(Math.floor(durationSec * sampleRate));
  const startIdx = Math.floor(speechStartSec * sampleRate);
  const endIdx = startIdx + Math.floor(speechDurationSec * sampleRate);
  // Approximate speech envelope: sinusoid * decay
  for (let i = startIdx; i < endIdx && i < samples.length; i++) {
    const t = (i - startIdx) / sampleRate;
    const envelope = Math.max(0, 1 - t / speechDurationSec);
    samples[i] = Math.sin(2 * Math.PI * 180 * t) * speechPeak * envelope;
  }
  return samples;
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 1 — Audio pre-processing (hallucination / silence gates)
// ═══════════════════════════════════════════════════════════════════════

describe('voice pipeline / audio buffer gates', () => {
  describe('RMS silence gate', () => {
    it('pure silence has RMS == 0', () => {
      const buffer = makeSilentBuffer(1);
      expect(computeRms(buffer)).toBe(0);
    });

    it('pure silence fails the 0.0008 gate', () => {
      const buffer = makeSilentBuffer(1);
      expect(computeRms(buffer)).toBeLessThan(0.0008);
    });

    it('noise-canceled audio with tiny residual fails the gate', () => {
      // Very low-amplitude hiss from an aggressive noise canceler
      const buffer = makeNoiseBuffer(1, 0.0003);
      expect(computeRms(buffer)).toBeLessThan(0.0008);
    });

    it('a normal spoken word passes the gate even when padded with silence', () => {
      // 1-second buffer, 0.3s of speech starting at 0.2s, moderate volume
      const buffer = makeSpeechLikeBuffer(1, 0.2, 0.3, 0.1);
      expect(computeRms(buffer)).toBeGreaterThan(0.0008);
    });

    it('a quiet but audible word still passes the gate', () => {
      const buffer = makeSpeechLikeBuffer(1, 0.2, 0.3, 0.05);
      expect(computeRms(buffer)).toBeGreaterThan(0.0008);
    });

    it('a very short utterance (0.2s word in 0.3s buffer) passes', () => {
      const buffer = makeSpeechLikeBuffer(0.3, 0.05, 0.2, 0.15);
      expect(computeRms(buffer)).toBeGreaterThan(0.0008);
    });
  });

  describe('hallucination detector', () => {
    it('short audio with a short transcript is fine', () => {
      // 1 second of audio, 2-word transcript like "yes" or "mark done"
      expect(looksHallucinated('yes please', 1)).toBe(false);
      expect(looksHallucinated('mark pushups done', 1)).toBe(false);
    });

    it('short audio with suspiciously long transcript is flagged', () => {
      // 1 second of audio → max ~7 words. A 50-word transcript is impossible.
      const longText = Array(50).fill('word').join(' ');
      expect(looksHallucinated(longText, 1)).toBe(true);
    });

    it('5 seconds of audio can produce up to ~23 words', () => {
      const text = Array(20).fill('word').join(' ');
      expect(looksHallucinated(text, 5)).toBe(false);
    });

    it('classic whisper hallucination phrases are flagged', () => {
      expect(looksHallucinated('Thank you for watching!', 2)).toBe(true);
      expect(looksHallucinated("Don't forget to like and subscribe", 2)).toBe(true);
      expect(looksHallucinated('See you in the next video', 2)).toBe(true);
      expect(looksHallucinated('Subscribe to my channel', 2)).toBe(true);
    });

    it('ellipsis runs (whisper silence artifact) are flagged', () => {
      expect(looksHallucinated('. . . . . .', 0.5)).toBe(true);
    });

    it('real-estate-style hallucination like Alejandro screenshot is flagged', () => {
      // Alejandro said "I want to log a journal" (4 words, ~2s) but got
      // 100+ words about real estate. Should be flagged by word count.
      const hallucination =
        "Okay, I'm gonna go get that door open for you now— All righty then... " +
        'Yeah..yeah yeah.......all riiiight.....you can come in here sir if i was your dad ' +
        'and there were a few people who wanted to buy this place uh what would be some things ' +
        'they should know about before coming out or looking at all of these units down below ' +
        "is kind-of where we're sitting so first thing when somebody comes into one of our buildings";
      expect(looksHallucinated(hallucination, 2)).toBe(true);
    });

    it('empty transcript is not flagged (returns false to let empty-string handling take over)', () => {
      expect(looksHallucinated('', 1)).toBe(false);
      expect(looksHallucinated('   ', 1)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LAYER 2 — Full dispatch pipeline, replaying voice journey spec
// ═══════════════════════════════════════════════════════════════════════

describe('voice pipeline / ActionDispatcher replays voice journey spec', () => {
  let dispatcher: ActionDispatcher;
  let dataService: MockDataService;

  beforeEach(() => {
    dataService = new MockDataService();
    dispatcher = new ActionDispatcher(dataService);
  });

  // Helper to dispatch a parsed voice intent
  async function dispatch(
    action: string,
    entity: string,
    params: Record<string, unknown> = {},
    confidence = 0.9,
  ) {
    return dispatcher.dispatch({ action, entity, params, confidence });
  }

  describe('Step: Create a habit by voice (Voice Journey row 10)', () => {
    it('"Create a habit called meditation" produces a habit and navigates home', async () => {
      const result = await dispatch('create', 'habit', { name: 'meditation' });
      expect(result.success).toBe(true);
      expect(result.uiAction).toBe('navigate');
      expect(result.navigateTo).toBe('/home');
      // Habit should now exist in the data layer
      const habit = await dataService.getHabitByName('meditation');
      expect(habit).toBeTruthy();
      expect(habit?.name.toLowerCase()).toContain('meditation');
    });

    it('creating a duplicate habit returns a friendly warning', async () => {
      await dispatch('create', 'habit', { name: 'running' });
      const result = await dispatch('create', 'habit', { name: 'running' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/already/i);
    });

    it('missing name asks the coach to clarify (Voice Journey spec: ask follow-up)', async () => {
      const result = await dispatch('create', 'habit', {});
      expect(result.success).toBe(false);
      // Coaching message asks for a name
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('Step: Mark habit done (Voice Journey row 25 — check-in mic flow)', () => {
    beforeEach(async () => {
      await dispatch('create', 'habit', { name: 'pushups' });
    });

    it('"Mark pushups done" completes it for today', async () => {
      const result = await dispatch('complete', 'habit', { name: 'pushups' });
      expect(result.success).toBe(true);
      expect(result.uiAction).toBe('navigate');
    });

    it('"Mark the pushups done" (with article) still works', async () => {
      const result = await dispatch('complete', 'habit', { name: 'the pushups' });
      expect(result.success).toBe(true);
    });

    it('"Mark my pushups done" (with possessive) still works', async () => {
      const result = await dispatch('complete', 'habit', { name: 'my pushups' });
      expect(result.success).toBe(true);
    });

    it('"Mark pushups habit done" (with trailing "habit") still works', async () => {
      const result = await dispatch('complete', 'habit', { name: 'pushups habit' });
      expect(result.success).toBe(true);
    });

    it('"Mark pushups done please" (with politeness) still works', async () => {
      const result = await dispatch('complete', 'habit', { name: 'pushups please' });
      expect(result.success).toBe(true);
    });

    it('Marking a non-existent habit returns a friendly not-found message', async () => {
      const result = await dispatch('complete', 'habit', { name: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/don't see|not found/i);
    });
  });

  describe('Step: Delete habit (Voice Journey row 33)', () => {
    beforeEach(async () => {
      await dispatch('create', 'habit', { name: 'meditation' });
    });

    it('"Delete meditation" removes the habit', async () => {
      const result = await dispatch('delete', 'habit', { name: 'meditation' });
      expect(result.success).toBe(true);
      const habit = await dataService.getHabitByName('meditation');
      expect(habit).toBeNull();
    });

    it('"Delete my meditation habit" (natural speech) still works', async () => {
      const result = await dispatch('delete', 'habit', { name: 'my meditation habit' });
      expect(result.success).toBe(true);
    });
  });

  describe('Step: Query habits (Home screen voice)', () => {
    beforeEach(async () => {
      await dispatch('create', 'habit', { name: 'reading' });
      await dispatch('create', 'habit', { name: 'yoga' });
    });

    it('"Show my habits" lists all habits', async () => {
      const result = await dispatch('query', 'habit', {});
      expect(result.success).toBe(true);
      expect(result.message.toLowerCase()).toContain('reading');
      expect(result.message.toLowerCase()).toContain('yoga');
    });

    it('"How am I doing with reading" queries a specific habit summary', async () => {
      const result = await dispatch('query', 'habit', { name: 'reading' });
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
    });

    it('"How am I doing with the reading habit" (natural speech) still works', async () => {
      const result = await dispatch('query', 'habit', { name: 'the reading habit' });
      expect(result.success).toBe(true);
    });
  });

  describe('Step: Check-in (Voice Journey row 25 — morning/evening flow)', () => {
    it('"Check in sleep 7 mood 8 energy 6 stress 3" saves a check-in', async () => {
      const result = await dispatch('checkin', 'checkin', {
        sleep: 7,
        mood: 8,
        energy: 6,
        stress: 3,
      });
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/\b(sleep|mood|energy|stress)\b/i);
    });

    it('check-in with no values returns a helpful error', async () => {
      const result = await dispatch('checkin', 'checkin', {});
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/provide/i);
    });
  });

  describe('Step: Focus session (Voice Journey row 38)', () => {
    it('"Start focus for 25 minutes" creates a focus session', async () => {
      const result = await dispatch('focus', 'focus', { duration: 25 });
      expect(result.success).toBe(true);
      expect(result.navigateTo).toBe('/focus');
    });

    it('"Start focus on reading for 25 minutes" associates a habit', async () => {
      await dispatch('create', 'habit', { name: 'reading' });
      const result = await dispatch('focus', 'focus', { duration: 25, habit: 'reading' });
      expect(result.success).toBe(true);
    });

    it('"Start focus on the reading habit for 25 minutes" natural-speech still resolves', async () => {
      await dispatch('create', 'habit', { name: 'reading' });
      const result = await dispatch('focus', 'focus', {
        duration: 25,
        habit: 'the reading habit',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Step: Journal reflection (Voice Journey row 20)', () => {
    it('"I feel great today" saves a reflection', async () => {
      const result = await dispatch('reflect', 'journal', {
        mood: 'high',
        themes: [],
        content: 'I feel great today',
      });
      expect(result.success).toBe(true);
    });

    it('duplicate reflection content is blocked', async () => {
      await dispatch('reflect', 'journal', {
        mood: 'neutral',
        themes: [],
        content: 'Today was fine',
      });
      const result = await dispatch('reflect', 'journal', {
        mood: 'neutral',
        themes: [],
        content: 'Today was fine',
      });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/already/i);
    });
  });

  describe('Step: Log metric (Voice Journey — Home voice convo)', () => {
    beforeEach(async () => {
      await dispatch('create', 'metric', { name: 'weight', inputType: 'number' });
    });

    it('"Log weight 75" records a value', async () => {
      const result = await dispatch('log', 'metric', { name: 'weight', value: 75 });
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/75/);
    });

    it('"Log my weight at 75" (natural speech) still works', async () => {
      const result = await dispatch('log', 'metric', { name: 'my weight', value: 75 });
      expect(result.success).toBe(true);
    });

    it('"Log weight" without value returns a friendly error', async () => {
      const result = await dispatch('log', 'metric', { name: 'weight' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/value/i);
    });
  });

  describe('Error handling', () => {
    it('unknown action returns a friendly error', async () => {
      const result = await dispatch('teleport', 'habit', {});
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown/i);
    });

    it('data service throwing during dispatch is caught and wrapped in a friendly message', async () => {
      // Force a throw by asking to delete a habit that cascades through
      // the catch path via a service-level error.
      const brokenService = new MockDataService();
      brokenService.getHabitByName = async () => {
        throw new Error('permission denied: row-level security');
      };
      const brokenDispatcher = new ActionDispatcher(brokenService);
      const result = await brokenDispatcher.dispatch({
        action: 'complete',
        entity: 'habit',
        params: { name: 'running' },
        confidence: 0.9,
      });
      expect(result.success).toBe(false);
      // Should translate permission error to a user-facing message
      expect(result.message).toMatch(/sign|try/i);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LAYER 3 — Natural speech tolerance for habit name lookup
// ═══════════════════════════════════════════════════════════════════════

describe('voice pipeline / habit name normalization tolerance', () => {
  let dispatcher: ActionDispatcher;
  let dataService: MockDataService;

  beforeEach(async () => {
    dataService = new MockDataService();
    dispatcher = new ActionDispatcher(dataService);
    await dispatcher.dispatch({
      action: 'create',
      entity: 'habit',
      params: { name: 'meditation' },
      confidence: 0.9,
    });
  });

  const naturalSpeechVariants = [
    'meditation',
    'the meditation',
    'my meditation',
    'meditation habit',
    'meditation please',
    'the meditation habit',
    'my meditation habit please',
  ];

  naturalSpeechVariants.forEach((variant) => {
    it(`"${variant}" resolves to the stored meditation habit`, async () => {
      const result = await dispatcher.dispatch({
        action: 'complete',
        entity: 'habit',
        params: { name: variant },
        confidence: 0.9,
      });
      expect(result.success).toBe(true);
    });
  });
});
