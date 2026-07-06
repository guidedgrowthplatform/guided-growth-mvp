/**
 * B53 — "every day" / "every night" phrasing was saved as schedule: "Weekday"
 * (days: [1,2,3,4,5]) by submit_morning_checkin and submit_reflection_config,
 * even though the coach's own spoken recap claimed "daily". Root cause: unlike
 * add_habit (whose description gives a worked "every day" -> days=[0..6],
 * schedule='Every day' example), these two tools' descriptions only said
 * "infer the missing fields from natural defaults (Weekday + reminder on)"
 * with no worked example distinguishing "no cadence stated" from "user
 * explicitly said every day/night" — the model had no signal that an explicit
 * daily intent should override the Weekday default. This test pins the fixed
 * tool descriptions so the guidance can't silently regress.
 *
 * The handlers themselves were already correct (see
 * api/_lib/vapi/__tests__/handlers-reconcile.test.ts — days is authoritative,
 * schedule is reconciled via inferSchedule). This is a prompt/schema-layer
 * fix, not a handler fix.
 */
import { describe, expect, it } from 'vitest';
import { ONBOARDING_TOOLS } from '../tools.onboarding.js';

function toolDescription(name: string): string {
  const tool = ONBOARDING_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool.description;
}

describe('submit_morning_checkin description — explicit daily-cadence guidance', () => {
  const desc = toolDescription('submit_morning_checkin');

  it('tells the model "every day" is explicit input, not a missing field', () => {
    expect(desc).toMatch(/every day/i);
    expect(desc).toMatch(/explicit input/i);
  });

  it('gives the exact days/schedule shape for a daily intent', () => {
    expect(desc).toContain('days=[0,1,2,3,4,5,6]');
    expect(desc).toContain('schedule="Every day"');
  });

  it('includes a worked example calling the tool with the daily shape', () => {
    expect(desc).toMatch(/submit_morning_checkin\(time="\d{2}:\d{2}", days=\[0,1,2,3,4,5,6\]/);
  });

  it('still documents PM/AM time conversion', () => {
    expect(desc).toMatch(/PM/);
    expect(desc).toMatch(/24-hour/);
  });
});

describe('submit_reflection_config description — explicit daily-cadence guidance', () => {
  const desc = toolDescription('submit_reflection_config');

  it('tells the model "every night"/"every day" is explicit input, not a missing field', () => {
    expect(desc).toMatch(/every night/i);
    expect(desc).toMatch(/every day/i);
    expect(desc).toMatch(/explicit input/i);
  });

  it('gives the exact days/schedule shape for a daily intent', () => {
    expect(desc).toContain('days=[0,1,2,3,4,5,6]');
    expect(desc).toContain('schedule="Every day"');
  });

  it('includes a worked example calling the tool with the daily shape', () => {
    expect(desc).toMatch(/submit_reflection_config\(time="\d{2}:\d{2}", days=\[0,1,2,3,4,5,6\]/);
  });

  it('still documents PM/AM time conversion', () => {
    expect(desc).toMatch(/PM/);
    expect(desc).toMatch(/24-hour/);
  });
});

// Cross-check against add_habit's already-correct pattern (per the QA finding:
// "this same 'every day' phrasing was captured correctly... by the add_habit
// tool... so this looks specific to submit_morning_checkin /
// submit_reflection_config"). Both fixed tools should now carry the same kind
// of worked daily-cadence example add_habit already has.
describe('parity with add_habit\'s already-correct "every day" handling', () => {
  it('add_habit already has a days=[0,1,2,3,4,5,6] / schedule="Every day" example', () => {
    const addHabitDesc = toolDescription('add_habit');
    expect(addHabitDesc).toContain('days=[0,1,2,3,4,5,6]');
    expect(addHabitDesc).toContain('schedule="Every day"');
  });
});
