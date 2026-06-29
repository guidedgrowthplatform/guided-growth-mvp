import type { HabitPolarity } from './HabitScheduleCard';

// Auto-classify a spoken habit phrase as build (do more of it) or break (stay
// away from it), so the advanced capture beat can label each card without asking
// the user per habit. Avoidance wording reads as break; everything else defaults
// to build. The user can flip any chip, so this only has to be right most of the
// time. Kept in one place so the builder preview and the engine classify the same
// way (the engine should import this same helper at the seam).
//
// Examples:
//   "10-minute walk after lunch"  -> build
//   "No screens after 10 PM"      -> break
//   "Meditate for 5 minutes"      -> build
//   "Phone away while working"    -> break
const BREAK_PATTERN =
  /\b(no|not|never|avoid|stop|quit|less|fewer|without|away|off|cut|reduce|limit|skip|ban|drop|ditch|unplug|put down|cut out|stay off)\b/i;

export function classifyHabitPolarity(name: string): HabitPolarity {
  return BREAK_PATTERN.test(name) ? 'break' : 'build';
}
