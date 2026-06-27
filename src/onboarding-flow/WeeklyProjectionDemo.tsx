/**
 * WeeklyProjectionDemo — standalone QA render of the post-capture projection
 * beat, at /weekly-projection-demo. Feeds WeeklyProjection a fixed set of
 * captured habits so the beat can be reviewed without running the full capture.
 * No voice, no login. The real beat consumes the live captured habits instead.
 */
import { WeeklyProjection, type ProjectionHabit } from './WeeklyProjection';

const SAMPLE: ProjectionHabit[] = [
  { name: 'Meditate', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'positive' },
  { name: 'Workout', days: [1, 3, 5], polarity: 'positive' },
  { name: 'Read 10 pages', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'positive' },
  { name: 'No phone in bed', days: [0, 1, 2, 3, 4, 5, 6], polarity: 'negative' },
  { name: 'Journal', days: [1, 2, 3, 4, 5], polarity: 'positive' },
];

export function WeeklyProjectionDemo() {
  return (
    <div className="bg-background flex min-h-screen w-screen justify-center">
      <div className="w-full max-w-[440px] px-4 py-8">
        <WeeklyProjection habits={SAMPLE} />
      </div>
    </div>
  );
}
