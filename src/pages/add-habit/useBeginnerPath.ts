import { useCallback, useState } from 'react';
import type { HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { habitsByGoal } from '@/data/onboardingHabits';

export function useBeginnerPath() {
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set());
  const [customHabits, setCustomHabits] = useState<Record<string, string[]>>({});
  const [habitConfigs, setHabitConfigs] = useState<Record<string, HabitConfig>>({});
  const [customizingHabit, setCustomizingHabit] = useState<string | null>(null);
  const [habitQueue, setHabitQueue] = useState<string[]>([]);

  function setSelectedCategory(c: string) {
    if (c === selectedCategory) return;
    setSelectedCategoryState(c);
    setSelectedGoals(new Set());
    setSelectedHabits(new Set());
    setCustomHabits({});
    setHabitConfigs({});
  }

  function toggleGoal(goal: string) {
    const next = new Set(selectedGoals);
    if (next.has(goal)) {
      next.delete(goal);
    } else if (next.size < 2) {
      next.add(goal);
    } else {
      return;
    }
    setSelectedGoals(next);

    // Drop habits whose goal is no longer selected.
    const allowedHabits = new Set<string>();
    for (const g of next) {
      for (const h of habitsByGoal[g] ?? []) allowedHabits.add(h);
      for (const h of customHabits[g] ?? []) allowedHabits.add(h);
    }
    setSelectedHabits((prev) => {
      const filtered = new Set<string>();
      for (const h of prev) if (allowedHabits.has(h)) filtered.add(h);
      return filtered;
    });
    setHabitConfigs((prev) => {
      const filtered: Record<string, HabitConfig> = {};
      for (const [name, cfg] of Object.entries(prev)) {
        if (allowedHabits.has(name)) filtered[name] = cfg;
      }
      return filtered;
    });
    if (!next.has(goal)) {
      setCustomHabits((prev) => {
        if (!(goal in prev)) return prev;
        const { [goal]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  function toggleHabit(habit: string) {
    if (selectedHabits.has(habit)) {
      const next = new Set(selectedHabits);
      next.delete(habit);
      setSelectedHabits(next);
      setHabitConfigs((c) => {
        const updated = { ...c };
        delete updated[habit];
        return updated;
      });
      return;
    }
    if (selectedHabits.size >= 2) return;
    setSelectedHabits(new Set(selectedHabits).add(habit));
  }

  function addCustomHabit(goal: string, habit: string) {
    if (selectedHabits.size >= 2) return;
    setCustomHabits((prev) => ({
      ...prev,
      [goal]: [...(prev[goal] ?? []), habit],
    }));
    setSelectedHabits(new Set(selectedHabits).add(habit));
  }

  const startCustomizationQueue = useCallback(() => {
    const queue = [...selectedHabits];
    setHabitQueue(queue);
    setCustomizingHabit(queue[0]);
  }, [selectedHabits]);

  function handleSheetClose() {
    setCustomizingHabit(null);
    setHabitQueue([]);
  }

  function handleSheetNext(config: HabitConfig, onAllDone: () => void) {
    if (!customizingHabit) return;
    const currentIdx = habitQueue.indexOf(customizingHabit);
    const nextIdx = currentIdx + 1;
    setHabitConfigs((prev) => ({ ...prev, [customizingHabit]: config }));
    if (nextIdx < habitQueue.length) {
      setCustomizingHabit(habitQueue[nextIdx]);
    } else {
      setCustomizingHabit(null);
      setHabitQueue([]);
      onAllDone();
    }
  }

  function handleEditHabit(habit: string) {
    setHabitQueue([habit]);
    setCustomizingHabit(habit);
  }

  const isLastHabit = customizingHabit
    ? habitQueue.indexOf(customizingHabit) === habitQueue.length - 1
    : true;

  return {
    selectedCategory,
    setSelectedCategory,
    selectedGoals,
    toggleGoal,
    selectedHabits,
    customHabits,
    habitConfigs,
    customizingHabit,
    isLastHabit,
    toggleHabit,
    addCustomHabit,
    startCustomizationQueue,
    handleSheetClose,
    handleSheetNext,
    handleEditHabit,
  };
}
