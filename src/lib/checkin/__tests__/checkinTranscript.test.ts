import { describe, expect, it } from 'vitest';
import { buildCheckinTranscript, scriptKeysForStage } from '../checkinTranscript';
import { CHECKIN_SCRIPTS } from '../scriptLibrary';

const DAY = '2026-06-18';

describe('scriptKeysForStage', () => {
  it('morning state leads with greeting + state prompt', () => {
    expect(scriptKeysForStage('morning', 'state')).toEqual([
      'morning_greeting',
      'morning_state_prompt',
    ]);
  });
  it('evening habits leads with greeting+habits + habit prompt', () => {
    expect(scriptKeysForStage('evening', 'habits')).toEqual([
      'evening_greeting_habits',
      'evening_habit_prompt',
    ]);
  });
  it('first reflection stage emits the transition then the proud prompt', () => {
    expect(scriptKeysForStage('evening', 'reflect_proud')).toEqual([
      'reflection_transition',
      'reflection_proud',
    ]);
  });
  it('wrap is mode-specific', () => {
    expect(scriptKeysForStage('morning', 'wrap')).toEqual(['morning_wrap']);
    expect(scriptKeysForStage('evening', 'wrap')).toEqual(['evening_wrap']);
  });
  it('done emits nothing', () => {
    expect(scriptKeysForStage('evening', 'done')).toEqual([]);
  });
});

describe('buildCheckinTranscript', () => {
  it('renders each scripted line as its own coach bubble', () => {
    const t = buildCheckinTranscript('morning', ['state'], DAY);
    expect(t).toHaveLength(2);
    expect(t.every((m) => m.role === 'ai')).toBe(true);
    expect(CHECKIN_SCRIPTS.morning_greeting).toContain(t[0].text);
    expect(CHECKIN_SCRIPTS.morning_state_prompt).toContain(t[1].text);
  });

  it('hangs the 4-scale card off the morning state prompt (today’s date)', () => {
    const t = buildCheckinTranscript('morning', ['state'], DAY);
    expect(t[0].checkinCard).toBeUndefined();
    expect(t[1].checkinCard).toEqual({
      sleep: null,
      mood: null,
      energy: null,
      stress: null,
      date: DAY,
    });
  });

  it('flags the habit card on the evening habit prompt', () => {
    const t = buildCheckinTranscript('evening', ['habits'], DAY);
    expect(t[1].habitReport).toBe(true);
  });

  it('is deterministic for a given day', () => {
    const a = buildCheckinTranscript('evening', ['habits', 'reflect_proud'], DAY);
    const b = buildCheckinTranscript('evening', ['habits', 'reflect_proud'], DAY);
    expect(a).toEqual(b);
  });

  it('reflection prompts render their fixed lines verbatim', () => {
    const t = buildCheckinTranscript(
      'evening',
      ['reflect_proud', 'reflect_forgive', 'reflect_grateful'],
      DAY,
    );
    const texts = t.map((m) => m.text);
    expect(texts).toContain('What are you proud of today?');
    expect(texts).toContain('What do you forgive yourself for today?');
    expect(texts).toContain('What are you grateful for today?');
  });

  it('produces unique message ids per stage+line', () => {
    const t = buildCheckinTranscript('evening', ['habits', 'are_you_done', 'reflect_proud'], DAY);
    const ids = t.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
