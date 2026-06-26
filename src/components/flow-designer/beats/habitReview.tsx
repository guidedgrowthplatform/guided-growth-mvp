import { useEffect, useState } from 'react';
import { HabitListItem } from '@/components/home/HabitListItem';
import { BeatPlayer, useAnimations, type BeatDef, type BeatStep } from '../beatKit';

// Evening habit review: the interactive list with three states per habit
// (done / not done = missed / pending = none). Reuses the real HabitListItem.
// The habits come in one at a time (staggered fade in place) while animating,
// and show all at once when paused or on the static canvas. Space is reserved
// up front so the list never jumps as each habit lands.
type Mark = 'done' | 'missed' | 'none';
const SAMPLE: { name: string; subtitle: string; streak: number; mark: Mark }[] = [
  { name: 'Morning walk', subtitle: '7:00 AM', streak: 4, mark: 'done' },
  { name: 'No screens after 10 PM', subtitle: '10:00 PM', streak: 6, mark: 'missed' },
  { name: 'Read 10 pages', subtitle: 'Evening', streak: 2, mark: 'none' },
];

function HabitReviewList() {
  const anims = useAnimations();
  const [marks, setMarks] = useState<Mark[]>(SAMPLE.map((h) => h.mark));
  // Reveal one habit at a time while animating; all at once when paused/static.
  const [shown, setShown] = useState(anims ? 0 : SAMPLE.length);
  useEffect(() => {
    if (!anims) {
      setShown(SAMPLE.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= SAMPLE.length) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [anims]);

  const cycle = (m: Mark): Mark => (m === 'none' ? 'done' : m === 'done' ? 'missed' : 'none');
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-2">
      {SAMPLE.map((h, i) => (
        <div
          key={h.name}
          style={{
            opacity: i < shown ? 1 : 0,
            transform: i < shown ? 'none' : 'translateY(8px)',
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          }}
        >
          <HabitListItem
            name={h.name}
            subtitle={h.subtitle}
            streak={h.streak}
            isCompleted={marks[i] === 'done'}
            status={marks[i]}
            onToggleComplete={() => setMarks((p) => p.map((m, j) => (j === i ? cycle(m) : m)))}
          />
        </div>
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
