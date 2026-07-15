import type { HabitPolarity } from './HabitScheduleCard';
import { polarityForHabit } from '@gg/shared';

// Classify a habit as build (do more of it) or break (stay away from it).
// Predefined habits resolve through the explicit catalog map; genuinely custom
// (user-spoken) habits fall back to a wording regex. The single source lives in
// @gg/shared (polarityForHabit) so the builder preview and the engine agree.
//
// Examples:
//   "10-minute walk after lunch"  -> build
//   "No screens after 10 PM"      -> break
//   "Phone stays outside bedroom" -> build (owner decision, from the map)
export function classifyHabitPolarity(name: string): HabitPolarity {
  return polarityForHabit(name);
}
