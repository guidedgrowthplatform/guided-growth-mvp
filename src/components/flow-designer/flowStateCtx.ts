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
}

export const FlowStateCtx = createContext<FlowState | null>(null);

export const useFlowState = () => useContext(FlowStateCtx);
