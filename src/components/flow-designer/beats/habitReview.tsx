import { useState } from 'react';
import { HabitListItem } from '@/components/home/HabitListItem';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// Evening habit review: the interactive list with three states per habit
// (done / not done = missed / pending = none). Reuses the real HabitListItem.
type Mark = 'done' | 'missed' | 'none';
const SAMPLE: { name: string; subtitle: string; streak: number; mark: Mark }[] = [
  { name: 'Morning walk', subtitle: '7:00 AM', streak: 4, mark: 'done' },
  { name: 'No screens after 10 PM', subtitle: '10:00 PM', streak: 6, mark: 'missed' },
  { name: 'Read 10 pages', subtitle: 'Evening', streak: 2, mark: 'none' },
];

function HabitReviewList() {
  const [marks, setMarks] = useState<Mark[]>(SAMPLE.map((h) => h.mark));
  const cycle = (m: Mark): Mark => (m === 'none' ? 'done' : m === 'done' ? 'missed' : 'none');
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-2">
      {SAMPLE.map((h, i) => (
        <HabitListItem
          key={h.name}
          name={h.name}
          subtitle={h.subtitle}
          streak={h.streak}
          isCompleted={marks[i] === 'done'}
          status={marks[i]}
          onToggleComplete={() => setMarks((p) => p.map((m, j) => (j === i ? cycle(m) : m)))}
        />
      ))}
    </div>
  );
}

function HabitReviewBeat() {
  const steps: BeatStep[] = [{ id: 'list', speaker: 'coach', render: <HabitReviewList /> }];
  return <BeatPlayer steps={steps} />;
}

const habitReviewBeat: BeatDef = {
  type: 'habit-review',
  group: 'Check-in',
  label: 'Habit review (done / not done / pending)',
  Comp: HabitReviewBeat,
};

export default habitReviewBeat;
