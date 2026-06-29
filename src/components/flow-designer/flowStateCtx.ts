import { createContext, useContext } from 'react';

// Shared selection state for a live Play run: what the user picked in the
// onboarding beats, so a later beat can read an earlier beat's choice. The
// category drives the goals beat, the chosen goals drive the habits beat, and
// the plan beat reads the picked habits. It lives only inside Play (owned by
// FlowPhone) and resets on restart.
//
// Beats also render as static tiles on the build canvas, where there is no
// provider. useFlowState() returns null there, and each beat falls back to its
// own local demo state so the tile still looks interactive in the editor.

// The per-habit schedule the user sets on the schedule card: which days, what
// time, whether to remind. Lifted to flow state so the plan recap and the home
// tour can show the real schedule the user picked, not a placeholder. `days` is
// an array (not a Set) so it stays plain-serializable.
export interface HabitScheduleCfg {
  days: number[];
  time: string; // "HH:MM" 24-hour
  reminder: boolean;
}

export interface FlowState {
  path: 'new' | 'exp' | null;
  category: string | null;
  goals: string[];
  habits: string[];
  setPath: (v: 'new' | 'exp' | null) => void;
  setCategory: (v: string) => void;
  toggleGoal: (v: string, max?: number) => void;
  toggleHabit: (v: string, max?: number) => void;
  // Set the whole habit list at once. The advanced path captures many habits with
  // no per-pick cap, unlike the capped toggleHabit the beginner path uses.
  setHabits: (v: string[]) => void;
  // Captured schedule + check-in times, lifted from the schedule / morning /
  // evening beats so the plan recap and the home tour reflect the real plan.
  morningTime: string | null;
  eveningTime: string | null;
  habitConfigs: Record<string, HabitScheduleCfg>;
  setMorningTime: (v: string) => void;
  setEveningTime: (v: string) => void;
  setHabitConfig: (habit: string, cfg: HabitScheduleCfg) => void;
  // App-tour interactive state, lifted so habit toggles + the selected date
  // survive moving between the tour's beats (each beat is a separate mount).
  tourHabitStatus: Record<string, 'done' | 'missed' | 'none'>;
  tourSelectedDate: string | null;
  setTourHabitStatus: (next: Record<string, 'done' | 'missed' | 'none'>) => void;
  setTourSelectedDate: (v: string) => void;
}

export const FlowStateCtx = createContext<FlowState | null>(null);

export const useFlowState = () => useContext(FlowStateCtx);
