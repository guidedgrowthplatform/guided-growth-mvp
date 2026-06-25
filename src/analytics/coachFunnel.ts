import { track } from '@/analytics';
import { currentCheckinType } from '@/utils/dates';
import type { LLMToolEvent } from '@gg/shared/types/llm';

const COACH_SOURCE = 'coach_chat';

export const isCheckinScreen = (screenId: string): boolean =>
  screenId === 'HOME-CHECKIN' || screenId.startsWith('MCHECK') || screenId.startsWith('ECHECK');

// Prefix wins (MCHECK/ECHECK are time-of-day screens); clock only for HOME-CHECKIN.
function checkinType(screenId: string): 'morning' | 'evening' {
  if (screenId.startsWith('MCHECK')) return 'morning';
  if (screenId.startsWith('ECHECK')) return 'evening';
  return currentCheckinType();
}

export function trackCoachToolEvent(evt: LLMToolEvent): void {
  const a = evt.args ?? {};
  switch (evt.name) {
    case 'create_habit':
      track('create_habit', {
        source: COACH_SOURCE,
        habit_name: a.name,
        frequency_days: Array.isArray(a.schedule_days) ? a.schedule_days.length : undefined,
      });
      break;
    case 'complete_habit':
      track('complete_habit', { source: COACH_SOURCE, habit_name: a.name });
      break;
    case 'record_checkin':
      track('complete_checkin', {
        source: COACH_SOURCE,
        sleep_quality: a.sleep,
        mood: a.mood,
        energy_level: a.energy,
        stress_level: a.stress,
      });
      break;
    case 'log_reflection':
      track('log_reflection', { source: COACH_SOURCE, has_title: !!a.title });
      break;
  }
}

export function trackCheckinStarted(screenId: string): void {
  track('start_checkin', {
    source: COACH_SOURCE,
    trigger: COACH_SOURCE,
    checkin_type: checkinType(screenId),
  });
}
