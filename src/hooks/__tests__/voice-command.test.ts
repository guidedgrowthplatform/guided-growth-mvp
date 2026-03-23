/**
 * Tests for localParse — the offline NLP parser in useVoiceCommand.ts
 *
 * Covers all 19 command patterns described in issue #49 acceptance criteria,
 * plus edge cases (empty string, garbage input, very long strings, etc.).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { localParse } from '../useVoiceCommand';

// ─── Helper type alias for readability ───────────────────────────────────────
type ParseResult = ReturnType<typeof localParse>;

// ─── A) Command Pattern Tests ─────────────────────────────────────────────────

describe('localParse — create habit', () => {
  it('pattern: "create a habit called meditation" → action:create, entity:habit, name:"meditation"', () => {
    const result: ParseResult = localParse('create a habit called meditation');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('habit');
    expect(result.params.name).toBe('meditation');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('pattern: "add a new habit called running" → action:create, entity:habit', () => {
    const result = localParse('add a new habit called running');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('habit');
    expect(result.params.name).toBe('running');
  });

  it('pattern: "new habit journaling" → action:create, entity:habit', () => {
    const result = localParse('new habit journaling');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('habit');
  });

  it('pattern: create habit with frequency "create habit yoga 3 times a week" → frequency:"3x/week", name:"yoga"', () => {
    const result = localParse('create habit yoga 3 times a week');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('habit');
    expect(result.params.name).toBe('yoga');
    expect(result.params.frequency).toBe('3x/week');
  });

  it('defaults to "daily" frequency when no frequency is stated', () => {
    const result = localParse('create a habit called reading');
    expect(result.params.frequency).toBe('daily');
  });

  it('bare "create habit" with no name word produces a name from leftover text or low confidence', () => {
    // Sending just the command trigger words with nothing meaningful after them.
    // The parser either produces a low-confidence result or a short/empty name.
    const result = localParse('create habits');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('habit');
    // name must be a string (may be empty or very short)
    expect(typeof result.params.name).toBe('string');
  });
});

describe('localParse — create metric', () => {
  it('pattern: "create metric mood scale 1 to 10" → entity:metric, name:"mood", scale:[1,10]', () => {
    const result = localParse('create metric mood scale 1 to 10');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('metric');
    expect(result.params.name).toBe('mood');
    expect(result.params.scale).toEqual([1, 10]);
    expect(result.params.inputType).toBe('scale');
  });

  it('pattern: "add metric sleep quality" → entity:metric, inputType:binary (no scale)', () => {
    const result = localParse('add metric sleep quality');
    expect(result.action).toBe('create');
    expect(result.entity).toBe('metric');
    expect(result.params.name).toBe('sleep quality');
    expect(result.params.inputType).toBe('binary');
    expect(result.params.scale).toBeUndefined();
  });

  it('pattern: "new metric stress scale 0 to 5" → scale:[0,5]', () => {
    const result = localParse('new metric stress scale 0 to 5');
    expect(result.params.scale).toEqual([0, 5]);
  });
});

describe('localParse — mark done (complete)', () => {
  it('pattern: "mark meditation done" → action:complete, entity:habit, name:"meditation"', () => {
    const result = localParse('mark meditation done');
    expect(result.action).toBe('complete');
    expect(result.entity).toBe('habit');
    expect(result.params.name).toBe('meditation');
    expect(result.params.date).toBe('today');
  });

  it('pattern: "mark running done for today" → action:complete, name:"running"', () => {
    const result = localParse('mark running done for today');
    expect(result.action).toBe('complete');
    expect(result.params.name).toBe('running');
  });

  it('pattern: "completed exercise" → action:complete', () => {
    const result = localParse('completed exercise');
    expect(result.action).toBe('complete');
  });
});

describe('localParse — delete habit', () => {
  it('pattern: "delete the exercise habit" → action:delete, entity:habit, name:"exercise"', () => {
    const result = localParse('delete the exercise habit');
    expect(result.action).toBe('delete');
    expect(result.entity).toBe('habit');
    expect(result.params.name).toBe('exercise');
  });

  it('pattern: "remove the running habit" → action:delete, entity:habit', () => {
    const result = localParse('remove the running habit');
    expect(result.action).toBe('delete');
    expect(result.entity).toBe('habit');
  });
});

describe('localParse — delete metric', () => {
  it('pattern: "delete sleep quality metric" → action:delete, entity:metric', () => {
    const result = localParse('delete sleep quality metric');
    expect(result.action).toBe('delete');
    expect(result.entity).toBe('metric');
    expect(result.params.name).toBe('sleep quality');
  });

  it('pattern: "remove mood metric" → action:delete, entity:metric', () => {
    const result = localParse('remove mood metric');
    expect(result.action).toBe('delete');
    expect(result.entity).toBe('metric');
  });
});

describe('localParse — show habits (query)', () => {
  it('pattern: "show my habits" → action:query', () => {
    const result = localParse('show my habits');
    expect(result.action).toBe('query');
  });

  it('pattern: "list all habits" → action:query', () => {
    const result = localParse('list all habits');
    expect(result.action).toBe('query');
  });
});

describe('localParse — log metric', () => {
  it('pattern: "log sleep quality as 8" → action:log, entity:metric, name:"sleep quality", value:8', () => {
    const result = localParse('log sleep quality as 8');
    expect(result.action).toBe('log');
    expect(result.entity).toBe('metric');
    expect(result.params.name).toBe('sleep quality');
    expect(result.params.value).toBe(8);
  });

  it('pattern: "record mood 7" (without "as") → action:log, name:"mood", value:7', () => {
    const result = localParse('record mood 7');
    expect(result.action).toBe('log');
    expect(result.entity).toBe('metric');
    expect(result.params.name).toBe('mood');
    expect(result.params.value).toBe(7);
  });

  it('pattern: "log energy at 6" → action:log, value:6', () => {
    const result = localParse('log energy at 6');
    expect(result.action).toBe('log');
    expect(result.params.value).toBe(6);
  });

  it('handles decimal values "log weight as 72.5" → value:72.5', () => {
    const result = localParse('log weight as 72.5');
    expect(result.params.value).toBe(72.5);
  });
});

describe('localParse — query stats', () => {
  it('pattern: "how am I doing with meditation this week" → action:query, name contains "meditation"', () => {
    const result = localParse('how am I doing with meditation this week');
    expect(result.action).toBe('query');
    expect(result.params.name).toBe('meditation');
    expect(result.params.period).toBe('week');
  });

  it('pattern: "how\'s my exercise this month" → action:query, period:"month"', () => {
    const result = localParse("how's my exercise this month");
    expect(result.action).toBe('query');
    expect(result.params.period).toBe('month');
  });

  it('period defaults to "week" when no time modifier is present', () => {
    const result = localParse('how am I doing with yoga');
    expect(result.action).toBe('query');
    expect(result.params.period).toBe('week');
  });
});

describe('localParse — longest streak', () => {
  it('pattern: "what\'s my longest streak" → action:query, metric:"streak", sort:"longest"', () => {
    const result = localParse("what's my longest streak");
    expect(result.action).toBe('query');
    expect(result.params.metric).toBe('streak');
    expect(result.params.sort).toBe('longest');
  });

  it('pattern: "what is my longest streak" → action:query, metric:"streak"', () => {
    const result = localParse('what is my longest streak');
    expect(result.action).toBe('query');
    expect(result.params.metric).toBe('streak');
  });
});

describe('localParse — reflect / journal', () => {
  it('pattern: "I feel stressed" → action:reflect, mood includes stress theme', () => {
    const result = localParse('I feel stressed');
    expect(result.action).toBe('reflect');
    expect(result.entity).toBe('journal');
    const themes = result.params.themes as string[];
    expect(themes).toContain('stress');
  });

  it('pattern: "I feel tired" → action:reflect, themes includes "fatigue"', () => {
    const result = localParse('I feel tired');
    expect(result.action).toBe('reflect');
    const themes = result.params.themes as string[];
    expect(themes).toContain('fatigue');
  });

  it('mood is "low" when transcript contains negative sentiment words', () => {
    const result = localParse('I feel terrible today');
    expect(result.action).toBe('reflect');
    expect(result.params.mood).toBe('low');
  });

  it('mood is "high" when transcript contains positive sentiment words', () => {
    const result = localParse('I feel great today');
    expect(result.action).toBe('reflect');
    expect(result.params.mood).toBe('high');
  });

  it('mood defaults to "neutral" when no strong sentiment is detected', () => {
    const result = localParse('I feel okay');
    expect(result.action).toBe('reflect');
    expect(result.params.mood).toBe('neutral');
  });

  it('sleep theme is captured', () => {
    const result = localParse('I slept badly last night');
    expect(result.action).toBe('reflect');
    const themes = result.params.themes as string[];
    expect(themes).toContain('sleep');
  });
});

describe('localParse — suggest', () => {
  it('pattern: "suggest a habit" → action:suggest, entity:habit', () => {
    const result = localParse('suggest a habit');
    expect(result.action).toBe('suggest');
    expect(result.entity).toBe('habit');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('pattern: "recommend a habit for me" → action:suggest', () => {
    const result = localParse('recommend a habit for me');
    expect(result.action).toBe('suggest');
  });
});

describe('localParse — help', () => {
  it('pattern: "help" → action:help, high confidence', () => {
    const result = localParse('help');
    expect(result.action).toBe('help');
    expect(result.entity).toBe('command');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('pattern: "what can I do" → action:help', () => {
    const result = localParse('what can I do');
    expect(result.action).toBe('help');
  });

  it('pattern: "available commands" → action:help', () => {
    const result = localParse('available commands');
    expect(result.action).toBe('help');
  });

  it('pattern: "how do I use this" → action:help', () => {
    const result = localParse('how do I use this');
    expect(result.action).toBe('help');
  });
});

describe('localParse — summary/report', () => {
  it('pattern: "give me a summary" → action:query, entity:summary', () => {
    const result = localParse('give me a summary');
    expect(result.action).toBe('query');
    expect(result.entity).toBe('summary');
  });

  it('pattern: "weekly report" → action:query, entity:summary', () => {
    const result = localParse('weekly report');
    expect(result.action).toBe('query');
    expect(result.entity).toBe('summary');
  });
});

// ─── A.5) Sprint 2 — Check-in & Focus ────────────────────────────────────────

describe('localParse — check-in', () => {
  it('pattern: "check in sleep 4 mood 3 energy 5 stress 2" → action:checkin with all values', () => {
    const result = localParse('check in sleep 4 mood 3 energy 5 stress 2');
    expect(result.action).toBe('checkin');
    expect(result.entity).toBe('checkin');
    expect(result.params.sleep).toBe(4);
    expect(result.params.mood).toBe(3);
    expect(result.params.energy).toBe(5);
    expect(result.params.stress).toBe(2);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('pattern: "check-in mood 7 energy 6" → partial check-in, missing values are null', () => {
    const result = localParse('check-in mood 7 energy 6');
    expect(result.action).toBe('checkin');
    expect(result.params.mood).toBe(7);
    expect(result.params.energy).toBe(6);
    expect(result.params.sleep).toBeNull();
    expect(result.params.stress).toBeNull();
  });

  it('pattern: "checkin sleep 8" → only sleep provided', () => {
    const result = localParse('checkin sleep 8');
    expect(result.action).toBe('checkin');
    expect(result.params.sleep).toBe(8);
    expect(result.params.mood).toBeNull();
  });
});

describe('localParse — focus', () => {
  it('pattern: "start focus session for 25 minutes" → action:focus, duration:25', () => {
    const result = localParse('start focus session for 25 minutes');
    expect(result.action).toBe('focus');
    expect(result.entity).toBe('focus');
    expect(result.params.duration).toBe(25);
    expect(result.params.habit).toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('pattern: "start focus on meditation for 25 minutes" → action:focus, habit:meditation', () => {
    const result = localParse('start focus on meditation for 25 minutes');
    expect(result.action).toBe('focus');
    expect(result.params.duration).toBe(25);
    expect(result.params.habit).toBe('meditation');
  });

  it('pattern: "begin focus session for 15 mins" → action:focus, duration:15', () => {
    const result = localParse('begin focus session for 15 mins');
    expect(result.action).toBe('focus');
    expect(result.params.duration).toBe(15);
  });

  it('defaults to 25 minutes when no duration specified', () => {
    const result = localParse('start focus session');
    expect(result.action).toBe('focus');
    expect(result.params.duration).toBe(25);
  });
});

describe('localParse — journal quick entry', () => {
  it('pattern: "journal I had a productive morning" → action:reflect with content', () => {
    const result = localParse('journal I had a productive morning');
    expect(result.action).toBe('reflect');
    expect(result.entity).toBe('journal');
    expect(result.params.content).toBe('i had a productive morning');
    expect(result.params.mood).toBe('neutral');
  });
});

// ─── B) Edge Cases ────────────────────────────────────────────────────────────

describe('localParse — edge cases', () => {
  it('empty string → low confidence fallback', () => {
    const result = localParse('');
    expect(result.confidence).toBeLessThanOrEqual(0.4);
    // Should not throw and must return the standard shape
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('entity');
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('confidence');
  });

  it('whitespace-only string → low confidence fallback', () => {
    const result = localParse('   ');
    expect(result.confidence).toBeLessThanOrEqual(0.4);
  });

  it('garbage/unrecognized input "asdfghjkl" → low confidence', () => {
    const result = localParse('asdfghjkl');
    expect(result.confidence).toBeLessThanOrEqual(0.4);
  });

  it('numbers only "12345" → low confidence', () => {
    const result = localParse('12345');
    expect(result.confidence).toBeLessThanOrEqual(0.4);
  });

  it('very long string (200+ chars) → does not throw, returns valid shape', () => {
    const longString = 'create a habit called '.concat('a'.repeat(200));
    expect(() => localParse(longString)).not.toThrow();
    const result = localParse(longString);
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('confidence');
  });

  it('special characters "!@#$%^&*()" → does not throw, returns valid shape', () => {
    expect(() => localParse('!@#$%^&*()')).not.toThrow();
    const result = localParse('!@#$%^&*()');
    expect(result).toHaveProperty('action');
  });

  it('unicode / emoji input "🧘 create habit" → does not throw', () => {
    expect(() => localParse('🧘 create habit meditation')).not.toThrow();
  });

  it('mixed-case input is handled case-insensitively', () => {
    const lower = localParse('create a habit called Yoga');
    const upper = localParse('CREATE A HABIT CALLED YOGA');
    expect(lower.action).toBe(upper.action);
    expect(lower.entity).toBe(upper.entity);
  });

  it('SQL-like special chars "create habit called \'; DROP TABLE habits; --" → does not throw', () => {
    expect(() => localParse("create habit called '; DROP TABLE habits; --")).not.toThrow();
  });

  it('return value always has all four required fields', () => {
    const inputs = [
      '',
      'hello',
      'create',
      'delete',
      'log',
      'help',
      'suggest a habit',
      'mark meditation done',
    ];
    for (const input of inputs) {
      const result = localParse(input);
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('entity');
      expect(result).toHaveProperty('params');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.action).toBe('string');
      expect(typeof result.entity).toBe('string');
      expect(typeof result.params).toBe('object');
      expect(typeof result.confidence).toBe('number');
    }
  });

  it('confidence is always a number between 0 and 1 (inclusive)', () => {
    const inputs = [
      'create a habit called water',
      'mark yoga done',
      'help',
      'suggest a habit',
      'garbage xyz 123',
    ];
    for (const input of inputs) {
      const { confidence } = localParse(input);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});
