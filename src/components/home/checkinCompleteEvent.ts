import type { CheckInData } from '@gg/shared/types';

export type CheckinType = 'morning' | 'evening';

export const TYPE_FOR_FLOW: Record<'morning-checkin-v1' | 'evening-checkin-v1', CheckinType> = {
  'morning-checkin-v1': 'morning',
  'evening-checkin-v1': 'evening',
};

export function buildCheckinCompleteEvent(
  type: CheckinType,
  checkin: Partial<CheckInData>,
  alreadyDone: boolean,
  durationSeconds: number,
) {
  return {
    checkin_type: type,
    sleep_quality: checkin.sleep,
    mood: checkin.mood,
    energy_level: checkin.energy,
    stress_level: checkin.stress,
    duration_seconds: durationSeconds,
    is_update: alreadyDone,
  };
}
