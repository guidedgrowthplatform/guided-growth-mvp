import { useCallback, useState } from 'react';
import type { HabitConfig } from '@/components/onboarding/HabitCustomizeSheet';
import { goalsByCategory, habitsByGoal } from '@/data/onboardingHabits';

export const categories = Object.entries(goalsByCategory).map(([category, goals]) => ({
  category,
  habits: goals.flatMap((goal) => habitsByGoal[goal] ?? []),
}));

export function useBeginnerPath() {
  const [expandedCategory, setExpandedCategory] = useState(categories[0].category);
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set());
  const [customHabits, setCustomHabits] = useState<Record<string, string[]>>({});
  const [habitConfigs, setHabitConfigs] = useState<Record<string, HabitConfig>>({});
  const [customizingHabit, setCustomizingHabit] = useState<string | null>(null);
  const [habitQueue, setHabitQueue] = useState<string[]>([]);

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

  function addCustomHabit(category: string, habit: string) {
    if (selectedHabits.size >= 2) return;
    setCustomHabits((prev) => ({
      ...prev,
      [category]: [...(prev[category] ?? []), habit],
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
    expandedCategory,
    setExpandedCategory,
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
