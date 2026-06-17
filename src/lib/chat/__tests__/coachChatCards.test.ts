import { describe, expect, it } from 'vitest';
import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';
import {
  buildHabitCards,
  cardFromEvent,
  DEFAULT_WEEK,
  messageHasHabitCompletion,
  messageHasTodayHabits,
} from '../coachChatCards';

function evt(name: string, payload: unknown, ok = true): LLMToolEvent {
  return { id: `t-${name}`, name, args: {}, result: { ok, payload } };
}

function evtArgs(name: string, args: Record<string, unknown>, ok = true): LLMToolEvent {
  return { id: `t-${name}`, name, args, result: { ok, payload: { result: {} } } };
}

describe('cardFromEvent', () => {
  it('builds a card from create_habit using the returned day array', () => {
    const days = [true, false, true, false, true, false, false];
    const card = cardFromEvent(
      evt('create_habit', { result: { habit: { name: 'meditate', days } } }),
    );
    expect(card).toEqual({ name: 'meditate', days });
  });

  it('builds a card from update_habit', () => {
    const card = cardFromEvent(
      evt('update_habit', {
        result: { habit: { name: 'run', days: [false, true, true, true, true, true, false] } },
      }),
    );
    expect(card?.name).toBe('run');
  });

  it('falls back to the default week when days is missing/malformed', () => {
    const card = cardFromEvent(evt('create_habit', { result: { habit: { name: 'walk' } } }));
    expect(card).toEqual({ name: 'walk', days: [...DEFAULT_WEEK] });
  });

  it('falls back to the default week when days contains non-booleans', () => {
    const card = cardFromEvent(
      evt('create_habit', { result: { habit: { name: 'walk', days: [1, 0, 1, 0, 1, 0, 0] } } }),
    );
    expect(card).toEqual({ name: 'walk', days: [...DEFAULT_WEEK] });
  });

  it('builds a default-week card from suggest_habit (name only)', () => {
    const card = cardFromEvent(evt('suggest_habit', { result: { suggestion: 'stretch' } }));
    expect(card).toEqual({ name: 'stretch', days: [...DEFAULT_WEEK] });
  });

  it('returns null for non-card tools', () => {
    expect(cardFromEvent(evt('record_checkin', { result: { recorded: true } }))).toBeNull();
    expect(cardFromEvent(evt('complete_habit', { result: { completed: true } }))).toBeNull();
  });

  it('returns null for a failed tool result', () => {
    expect(
      cardFromEvent(evt('create_habit', { result: { habit: { name: 'x' } } }, false)),
    ).toBeNull();
  });

  it('returns null when there is no result payload', () => {
    expect(cardFromEvent({ id: 't', name: 'create_habit', args: {} })).toBeNull();
  });

  it('returns null for suggest_habit with a non-string suggestion', () => {
    expect(cardFromEvent(evt('suggest_habit', { result: { suggestion: 42 } }))).toBeNull();
    expect(cardFromEvent(evt('suggest_habit', { result: {} }))).toBeNull();
  });
});

describe('buildHabitCards', () => {
  const msg = (toolEvents: LLMToolEvent[]): LLMChatMessage => ({
    id: 'm1',
    role: 'assistant',
    content: 'ok',
    toolEvents,
  });

  it('returns undefined when there are no card-producing events', () => {
    expect(
      buildHabitCards(msg([evt('record_checkin', { result: {} })]), new Map()),
    ).toBeUndefined();
    expect(
      buildHabitCards({ id: 'm', role: 'assistant', content: 'hi' }, new Map()),
    ).toBeUndefined();
  });

  it('returns undefined for an empty toolEvents array', () => {
    expect(buildHabitCards(msg([]), new Map())).toBeUndefined();
  });

  it('applies a day override keyed by messageId:cardIndex', () => {
    const override = [true, true, true, true, true, true, true];
    const cards = buildHabitCards(
      msg([
        evt('create_habit', { result: { habit: { name: 'meditate', days: [...DEFAULT_WEEK] } } }),
      ]),
      new Map([['m1:0', override]]),
    );
    expect(cards?.[0]).toEqual({ name: 'meditate', days: override });
  });

  it('indexes multiple cards independently for overrides', () => {
    const cards = buildHabitCards(
      msg([
        evt('create_habit', { result: { habit: { name: 'a', days: [...DEFAULT_WEEK] } } }),
        evt('suggest_habit', { result: { suggestion: 'b' } }),
      ]),
      new Map([['m1:1', [true, false, false, false, false, false, false]]]),
    );
    expect(cards?.[0].name).toBe('a');
    expect(cards?.[1]).toEqual({
      name: 'b',
      days: [true, false, false, false, false, false, false],
    });
  });
});

describe('messageHasTodayHabits — drives the interactive checklist card', () => {
  const msg = (toolEvents: LLMToolEvent[]): LLMChatMessage => ({
    id: 'm1',
    role: 'assistant',
    content: 'here are your habits',
    toolEvents,
  });

  it('is true for a successful query_habits with scope:"today"', () => {
    expect(messageHasTodayHabits(msg([evtArgs('query_habits', { scope: 'today' })]))).toBe(true);
  });

  it('is false for a bare query_habits (no scope → defaults to "all" server-side)', () => {
    expect(messageHasTodayHabits(msg([evtArgs('query_habits', {})]))).toBe(false);
  });

  it('is false for scope:"all" (read-back, not the check-in checklist)', () => {
    expect(messageHasTodayHabits(msg([evtArgs('query_habits', { scope: 'all' })]))).toBe(false);
  });

  it('is false for a failed query_habits', () => {
    expect(messageHasTodayHabits(msg([evtArgs('query_habits', { scope: 'today' }, false)]))).toBe(
      false,
    );
  });

  it('is false when there is no query_habits event', () => {
    expect(messageHasTodayHabits(msg([evt('record_checkin', { result: {} })]))).toBe(false);
    expect(messageHasTodayHabits({ id: 'm', role: 'assistant', content: 'hi' })).toBe(false);
  });
});

describe('messageHasHabitCompletion', () => {
  const msg = (toolEvents: LLMToolEvent[]): LLMChatMessage => ({
    id: 'm1',
    role: 'assistant',
    content: 'nice',
    toolEvents,
  });

  it('is true for a successful complete_habit', () => {
    expect(messageHasHabitCompletion(msg([evt('complete_habit', { result: {} })]))).toBe(true);
  });

  it('is false for a failed complete_habit', () => {
    expect(messageHasHabitCompletion(msg([evt('complete_habit', { result: {} }, false)]))).toBe(
      false,
    );
  });
});
