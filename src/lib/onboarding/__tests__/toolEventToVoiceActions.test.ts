import { describe, expect, it } from 'vitest';
import type { LLMToolEvent } from '@gg/shared/types/llm';
import { toolEventToVoiceActions } from '../toolEventToVoiceActions';

function evt(name: string, args: Record<string, unknown>): LLMToolEvent {
  return { id: 'call_x', name, args, result: { ok: true, payload: { ok: true, result: {} } } };
}

describe('toolEventToVoiceActions', () => {
  it('returns nothing on failed tool result', () => {
    const e: LLMToolEvent = {
      id: 'call_x',
      name: 'submit_profile',
      args: { nickname: 'alice' },
      result: { ok: false, payload: { ok: false, error: 'x' } },
    };
    expect(toolEventToVoiceActions(e)).toEqual([]);
  });

  it('returns nothing on missing result (call_only event)', () => {
    const e: LLMToolEvent = { id: 'call_x', name: 'submit_profile', args: {} };
    expect(toolEventToVoiceActions(e)).toEqual([]);
  });

  it('returns nothing for unknown tool names', () => {
    expect(toolEventToVoiceActions(evt('not_a_tool', {}))).toEqual([]);
  });

  it('submit_profile fans out one action per field present', () => {
    const out = toolEventToVoiceActions(
      evt('submit_profile', {
        nickname: 'alice',
        age: '28',
        gender: 'Female',
        referral_source: 'Reddit',
      }),
    );
    expect(out).toEqual([
      {
        success: true,
        action: 'fill_field',
        params: { fieldName: 'nickname', value: 'alice' },
        message: '',
        confidence: 1,
      },
      {
        success: true,
        action: 'fill_field',
        params: { fieldName: 'age', value: '28' },
        message: '',
        confidence: 1,
      },
      {
        success: true,
        action: 'select_option',
        params: { fieldName: 'gender', value: 'Female' },
        message: '',
        confidence: 1,
      },
      {
        success: true,
        action: 'select_option',
        params: { fieldName: 'referralSource', value: 'Reddit' },
        message: '',
        confidence: 1,
      },
    ]);
  });

  it('submit_profile with nickname-only emits one action', () => {
    const out = toolEventToVoiceActions(evt('submit_profile', { nickname: 'alice' }));
    expect(out).toHaveLength(1);
    expect(out[0].params).toEqual({ fieldName: 'nickname', value: 'alice' });
  });

  it('submit_path_choice → set_path', () => {
    const out = toolEventToVoiceActions(evt('submit_path_choice', { path: 'simple' }));
    expect(out).toEqual([
      { success: true, action: 'set_path', params: { path: 'simple' }, message: '', confidence: 1 },
    ]);
  });

  it('submit_category → select_option with fieldName=category', () => {
    const out = toolEventToVoiceActions(evt('submit_category', { category: 'Sleep better' }));
    expect(out[0].params).toEqual({ fieldName: 'category', value: 'Sleep better' });
  });

  it('submit_goals → select_multiple with values plural', () => {
    const out = toolEventToVoiceActions(
      evt('submit_goals', { goals: ['Walk more', 'Sleep more deeply'] }),
    );
    expect(out[0]).toMatchObject({
      action: 'select_multiple',
      params: { fieldName: 'goals', values: ['Walk more', 'Sleep more deeply'] },
    });
  });

  it('submit_goals empty array returns nothing', () => {
    expect(toolEventToVoiceActions(evt('submit_goals', { goals: [] }))).toEqual([]);
  });

  it('add_habit passes name + value (Step5 reads either) + schedule details', () => {
    const out = toolEventToVoiceActions(
      evt('add_habit', {
        name: 'Walk',
        days: [1, 2, 3, 4, 5],
        time: '09:00',
        reminder: true,
        schedule: 'Weekday',
      }),
    );
    expect(out[0]).toMatchObject({
      action: 'add_habit',
      params: {
        name: 'Walk',
        value: 'Walk',
        days: [1, 2, 3, 4, 5],
        time: '09:00',
        reminder: true,
        schedule: 'Weekday',
      },
    });
  });

  it('remove_habit → remove_habit with name', () => {
    const out = toolEventToVoiceActions(evt('remove_habit', { name: 'Walk' }));
    expect(out[0]).toEqual({
      success: true,
      action: 'remove_habit',
      params: { name: 'Walk' },
      message: '',
      confidence: 1,
    });
  });

  it('update_habit → update_habit with name + patch of only the provided fields', () => {
    const out = toolEventToVoiceActions(evt('update_habit', { name: 'Meditate', time: '08:00' }));
    expect(out[0]).toEqual({
      success: true,
      action: 'update_habit',
      params: { name: 'Meditate', patch: { time: '08:00' } },
      message: '',
      confidence: 1,
    });
  });

  it('update_habit with name only (no patch fields) emits nothing', () => {
    expect(toolEventToVoiceActions(evt('update_habit', { name: 'Meditate' }))).toEqual([]);
  });

  it('submit_reflection_config preserves the full schedule shape', () => {
    const out = toolEventToVoiceActions(
      evt('submit_reflection_config', {
        time: '21:45',
        days: [1, 2, 3, 4, 5],
        reminder: true,
        schedule: 'Weekday',
      }),
    );
    expect(out[0].params).toEqual({
      time: '21:45',
      days: [1, 2, 3, 4, 5],
      reminder: true,
      schedule: 'Weekday',
    });
  });

  it('submit_reflection_config pushes nothing when no fields are present', () => {
    expect(toolEventToVoiceActions(evt('submit_reflection_config', {}))).toEqual([]);
  });

  it('submit_brain_dump → fill_field with fieldName=brainDumpText', () => {
    const text = 'I want to focus on sleep and exercise.';
    const out = toolEventToVoiceActions(evt('submit_brain_dump', { brain_dump_raw: text }));
    expect(out[0].params).toEqual({ fieldName: 'brainDumpText', value: text });
  });

  it('submit_custom_prompts → set_reflection_config with mode=prompts + prompts array', () => {
    const out = toolEventToVoiceActions(evt('submit_custom_prompts', { prompts: ['a', 'b'] }));
    expect(out).toEqual([
      {
        success: true,
        action: 'set_reflection_config',
        params: { mode: 'prompts', prompts: ['a', 'b'] },
        message: '',
        confidence: 1,
      },
    ]);
  });

  it('record_checkin → record_checkin with only present numeric fields', () => {
    const out = toolEventToVoiceActions(
      evt('record_checkin', { sleep: 4, mood: 3, energy: 5, stress: 2 }),
    );
    expect(out).toEqual([
      {
        success: true,
        action: 'record_checkin',
        params: { sleep: 4, mood: 3, energy: 5, stress: 2 },
        message: '',
        confidence: 1,
      },
    ]);
  });

  it('record_checkin drops non-numeric fields, keeps present ones', () => {
    const out = toolEventToVoiceActions(evt('record_checkin', { mood: 3, energy: '5' }));
    expect(out[0].params).toEqual({ mood: 3 });
  });

  it('record_checkin with no numeric fields emits nothing', () => {
    expect(toolEventToVoiceActions(evt('record_checkin', {}))).toEqual([]);
  });

  it('submit_morning_checkin → set_morning_checkin with schedule shape', () => {
    const out = toolEventToVoiceActions(
      evt('submit_morning_checkin', {
        time: '07:30',
        days: [1, 2, 3, 4, 5],
        reminder: true,
        schedule: 'Weekday',
      }),
    );
    expect(out).toEqual([
      {
        success: true,
        action: 'set_morning_checkin',
        params: { time: '07:30', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
        message: '',
        confidence: 1,
      },
    ]);
  });

  it('submit_morning_checkin with no fields emits nothing', () => {
    expect(toolEventToVoiceActions(evt('submit_morning_checkin', {}))).toEqual([]);
  });

  it('add_habit additionally emits set_habit_schedule when schedule params present', () => {
    const out = toolEventToVoiceActions(
      evt('add_habit', { name: 'Walk', time: '09:00', days: [1, 2, 3] }),
    );
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      action: 'set_habit_schedule',
      params: { time: '09:00', days: [1, 2, 3] },
    });
  });

  it('add_habit does NOT emit set_habit_schedule when only name present', () => {
    const out = toolEventToVoiceActions(evt('add_habit', { name: 'Walk' }));
    expect(out).toHaveLength(1);
    expect(out[0].action).toBe('add_habit');
  });

  it('update_habit additionally emits set_habit_schedule when schedule params present', () => {
    const out = toolEventToVoiceActions(evt('update_habit', { name: 'Walk', time: '09:00' }));
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      action: 'set_habit_schedule',
      params: { time: '09:00' },
    });
  });

  it('record_checkin returns nothing on failed result', () => {
    const e: LLMToolEvent = {
      id: 'call_x',
      name: 'record_checkin',
      args: { mood: 3 },
      result: { ok: false, payload: { ok: false, error: 'x' } },
    };
    expect(toolEventToVoiceActions(e)).toEqual([]);
  });

  it('confirm_plan → confirm_plan action (PlanReviewPage completes)', () => {
    const out = toolEventToVoiceActions(evt('confirm_plan', { reason: 'user said let us go' }));
    expect(out).toEqual([
      { success: true, action: 'confirm_plan', params: {}, message: '', confidence: 1 },
    ]);
  });

  it('ignores non-string / wrong-type fields gracefully', () => {
    const out = toolEventToVoiceActions(
      evt('submit_profile', { nickname: 42, age: true, gender: null }),
    );
    expect(out).toEqual([]);
  });
});
