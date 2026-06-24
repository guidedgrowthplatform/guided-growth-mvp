import { useState } from 'react';
import {
  inferSchedule,
  SCHEDULE_DAYS,
  toggleSetItem,
  WEEKDAYS,
} from '@/components/onboarding/constants';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { Button } from '@/components/ui/Button';
import type { ReflectionCardConfig } from '@/lib/onboarding/onboardingChatTypes';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';
import type { OnboardingCardApi } from './onboardingCardRegistry';

interface OnboardingReflectionCardProps {
  data: { config?: ReflectionCardConfig; selectedPrompts?: string[] };
  api: OnboardingCardApi;
}

// Beat 6 (beginner) — daily reflection schedule + prompt selection (Step6Page,
// minus the routed "create my own prompts" sub-screen). The classic prompt
// pills keep reflection questions configurable.
export function OnboardingReflectionCard({ data, api }: OnboardingReflectionCardProps) {
  const cfg = data.config;
  const [time, setTime] = useState(cfg?.time ?? '21:45');
  const [days, setDays] = useState<Set<number>>(
    cfg?.days?.length ? new Set(cfg.days) : new Set(WEEKDAYS),
  );
  const [reminder, setReminder] = useState(cfg?.reminder ?? true);
  const [schedule, setSchedule] = useState<ScheduleOption>(
    (cfg?.schedule as ScheduleOption) ?? 'Weekday',
  );
  const seededPrompts = data.selectedPrompts?.length
    ? DEFAULT_REFLECTION_PROMPTS.filter((p) => data.selectedPrompts!.includes(p))
    : DEFAULT_REFLECTION_PROMPTS;
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(
    seededPrompts.length ? seededPrompts : DEFAULT_REFLECTION_PROMPTS,
  );
  const [touched, setTouched] = useState(false);

  function handleTogglePrompt(q: string) {
    setTouched(true);
    setSelectedPrompts((prev) => {
      const has = prev.includes(q);
      // Keep at least one — a 0-prompt state silently falls back to defaults.
      if (has && prev.length === 1) return prev;
      return DEFAULT_REFLECTION_PROMPTS.filter((p) => (p === q ? !has : prev.includes(p)));
    });
  }

  function handleScheduleChange(value: ScheduleOption) {
    setSchedule(value);
    setDays(new Set(SCHEDULE_DAYS[value]));
  }

  function handleToggleDay(day: number) {
    setDays((prev) => {
      const next = toggleSetItem(prev, day);
      setSchedule(inferSchedule(next) ?? 'Weekday');
      return next;
    });
  }

  const isDefaultSelection =
    selectedPrompts.length === DEFAULT_REFLECTION_PROMPTS.length &&
    DEFAULT_REFLECTION_PROMPTS.every((p) => selectedPrompts.includes(p));

  function handleConfirm() {
    const reflectionConfig: ReflectionCardConfig = { time, days: [...days], reminder, schedule };
    api.submitReflection?.(
      touched
        ? {
            reflectionConfig,
            reflectionMode: 'prompts',
            customPrompts: isDefaultSelection ? [] : selectedPrompts,
          }
        : { reflectionConfig },
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <DailyReflectionCard
        time={time}
        onTimeChange={setTime}
        days={days}
        onToggleDay={handleToggleDay}
        reminder={reminder}
        onToggleReminder={setReminder}
        schedule={schedule}
        onScheduleChange={handleScheduleChange}
        prompts={DEFAULT_REFLECTION_PROMPTS}
        selectedPrompts={selectedPrompts}
        onTogglePrompt={handleTogglePrompt}
      />
      <Button variant="primary" size="lg" fullWidth onClick={handleConfirm} loading={api.busy}>
        Continue
      </Button>
    </div>
  );
}
