import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddHabitModal } from '@/components/capture/AddHabitModal';
import { HabitManageCard } from '@/components/habits/HabitManageCard';
import { VoiceAiBanner } from '@/components/habits/VoiceAiBanner';
import { useToast } from '@/contexts/ToastContext';
import { useAllMetrics } from '@/hooks/useAllMetrics';
import { useMetrics } from '@/hooks/useMetrics';
import { track } from '@/lib/analytics';
import type { MetricCreate } from '@shared/types';

export function HabitsPage() {
  const navigate = useNavigate();
  const { allMetrics, loading, update } = useAllMetrics();
  const { create } = useMetrics();
  const { addToast } = useToast();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    track('view_habits');
  }, []);

  const handleAddHabit = async (data: MetricCreate) => {
    try {
      await create(data);
      track('create_habit', {
        habit_name: data.name,
        input_type: data.input_type,
        has_target: data.target_value != null,
        frequency: data.frequency,
        source: 'habits_header',
      });
    } catch {
      addToast('error', 'Failed to create habit. Please try again.');
    }
  };

  const activeHabits = allMetrics.filter((m) => m.active);
  const pausedHabits = allMetrics.filter((m) => !m.active);

  const handleToggle = async (id: string) => {
    const metric = allMetrics.find((m) => m.id === id);
    if (!metric) return;
    const newActive = !metric.active;
    try {
      await update(id, { active: newActive });
      track('toggle_habit_active', { active: newActive });
      addToast('success', newActive ? `"${metric.name}" activated` : `"${metric.name}" paused`);
    } catch {
      addToast('error', `Failed to update "${metric.name}". Please try again.`);
    }
  };

  const handleMore = (id: string) => {
    navigate(`/habit/${id}`);
  };

  const handleClick = (id: string) => {
    navigate(`/habit/${id}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-8 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-secondary active:bg-surface-secondary"
          >
            <Icon icon="mdi:chevron-left" className="h-6 w-6 text-content" />
          </button>
          <h1 className="text-[28px] font-semibold leading-tight text-content">My Habits</h1>
        </div>
        <button
          onClick={() => {
            track('tap_create_habit', { source: 'habits_header' });
            setShowAddModal(true);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"
        >
          <Icon icon="mdi:plus" className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Icon icon="mdi:loading" className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : allMetrics.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Icon icon="mdi:playlist-plus" className="h-12 w-12 text-content-secondary" />
          <p className="text-content-secondary">No habits yet. Tap + to create one.</p>
        </div>
      ) : (
        <>
          {activeHabits.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-content-secondary">
                Active Routines
              </h2>
              {activeHabits.map((m) => (
                <HabitManageCard
                  key={m.id}
                  metric={m}
                  onToggleActive={handleToggle}
                  onMore={handleMore}
                  onClick={handleClick}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-content-secondary">
              Paused
            </h2>
            {pausedHabits.length > 0 ? (
              pausedHabits.map((m) => (
                <HabitManageCard
                  key={m.id}
                  metric={m}
                  onToggleActive={handleToggle}
                  onMore={handleMore}
                  onClick={handleClick}
                />
              ))
            ) : (
              <p className="py-4 text-center text-sm text-content-secondary">
                No paused habits. Toggle a habit off to pause it.
              </p>
            )}
          </div>

          {!bannerDismissed && <VoiceAiBanner onDismiss={() => setBannerDismissed(true)} />}
        </>
      )}

      <AddHabitModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddHabit}
      />
    </div>
  );
}
