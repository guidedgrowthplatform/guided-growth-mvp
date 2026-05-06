import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import {
  InsightsHeader,
  SegmentedControl,
  OverallAnalyticsTab,
  CheckInHistoryTab,
} from '@/components/insights';
import { useCheckInHistory } from '@/hooks/useCheckInHistory';

const tabItems = [
  { label: 'Overall Analytics', value: 'analytics' },
  { label: 'Check-in History', value: 'history' },
];

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [timeRange, setTimeRange] = useState('week');
  const [animating, setAnimating] = useState(false);
  const [displayTab, setDisplayTab] = useState(activeTab);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lift hook to page level so we can read selectedMonth + entry_count
  // for the view_checkin_history event without prop-drilling.
  const checkInHistory = useCheckInHistory();

  // Re-fire view_insights when timeRange changes — the previous
  // useEffect(..., []) + eslint-disable meant only the initial 'week' value
  // was ever captured, so metric/time-range pivots were invisible in PostHog.
  useEffect(() => {
    track('view_insights', { view_mode: timeRange });
  }, [timeRange]);

  function handleTabChange(newTab: string) {
    if (newTab === activeTab || animating) return;
    setDirection(newTab === 'history' ? 'right' : 'left');
    setAnimating(true);
    setActiveTab(newTab);
    if (newTab === 'history') {
      // Pass the actual selected month (not a hardcoded placeholder) and the
      // real number of entries visible to the user.
      track('view_checkin_history', {
        date_range: checkInHistory.selectedMonth,
        entry_count: checkInHistory.groups.reduce((sum, g) => sum + g.entries.length, 0),
      });
    }

    setTimeout(() => {
      setDisplayTab(newTab);
      scrollRef.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => setAnimating(false));
    }, 200);
  }

  const slideClass = direction === 'right' ? '-translate-x-4' : 'translate-x-4';

  return (
    <div className="min-h-dvh bg-primary-bg">
      <div className="sticky top-0 z-10 flex flex-col gap-6 bg-primary-bg px-6 pb-4 pt-[max(2rem,env(safe-area-inset-top))]">
        <InsightsHeader />
        <SegmentedControl items={tabItems} value={activeTab} onChange={handleTabChange} size="lg" />
      </div>
      <div ref={scrollRef} className="px-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div
          className={`transition-all duration-200 ease-out ${
            animating ? `opacity-0 ${slideClass}` : 'translate-x-0 opacity-100'
          }`}
        >
          {displayTab === 'analytics' ? (
            <OverallAnalyticsTab timeRange={timeRange} onTimeRangeChange={setTimeRange} />
          ) : (
            <CheckInHistoryTab history={checkInHistory} />
          )}
        </div>
      </div>
    </div>
  );
}
