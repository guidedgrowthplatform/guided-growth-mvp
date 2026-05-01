import { useRef, useState } from 'react';
import {
  InsightsHeader,
  SegmentedControl,
  OverallAnalyticsTab,
  CheckInHistoryTab,
} from '@/components/insights';

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

  function handleTabChange(newTab: string) {
    if (newTab === activeTab || animating) return;
    setDirection(newTab === 'history' ? 'right' : 'left');
    setAnimating(true);
    setActiveTab(newTab);

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
            <CheckInHistoryTab />
          )}
        </div>
      </div>
    </div>
  );
}
