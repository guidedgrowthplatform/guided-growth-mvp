import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { SegmentedControl } from '@/components/insights';
import { GuidedTab } from '@/components/journal/GuidedTab';
import { useAuth } from '@/hooks/useAuth';
import { useJournalSave } from '@/hooks/useJournalSave';

const FreeformTab = lazy(() =>
  import('@/components/journal/FreeformTab').then((m) => ({ default: m.FreeformTab })),
);

type Tab = 'guided' | 'freeform';

const tabItems = [
  { label: 'Freeform', value: 'freeform' },
  { label: 'Guided Reflection', value: 'guided' },
];

const GUIDED_TEMPLATE_ID = 'daily-reflection';

export function JournalFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { save, saving } = useJournalSave();
  const userName = user?.nickname ?? user?.name ?? 'there';

  const [activeTab, setActiveTab] = useState<Tab>('guided');
  const [displayTab, setDisplayTab] = useState<Tab>('guided');
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [now] = useState(() => new Date());

  const [freeformTitle, setFreeformTitle] = useState('');
  const [freeformBody, setFreeformBody] = useState('');
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});

  const completedRef = useRef(false);
  const mountTimeRef = useRef<number>(0);
  const activeTabRef = useRef<Tab>(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    mountTimeRef.current = Date.now();
    const start = mountTimeRef.current;
    track('open_journal', { trigger: 'home' });
    return () => {
      if (!completedRef.current) {
        track('abandon_journal', {
          journal_type: activeTabRef.current === 'guided' ? 'template' : 'freeform',
          time_spent_seconds: Math.round((Date.now() - start) / 1000),
        });
      }
    };
  }, []);

  const handleTabChange = useCallback(
    (next: string) => {
      const nextTab = next as Tab;
      if (nextTab === activeTab || animating) return;
      setDirection(nextTab === 'guided' ? 'right' : 'left');
      setAnimating(true);
      setActiveTab(nextTab);
      track('select_journal_type', { type: nextTab === 'guided' ? 'template' : 'freeform' });

      setTimeout(() => {
        setDisplayTab(nextTab);
        scrollRef.current?.scrollTo({ top: 0 });
        requestAnimationFrame(() => setAnimating(false));
      }, 200);
    },
    [activeTab, animating],
  );

  const handleFreeformSave = useCallback(async () => {
    const date = format(now, 'yyyy-MM-dd');
    const ok = await save({
      type: 'freeform',
      title: freeformTitle || undefined,
      date,
      fields: { body: freeformBody },
    });
    if (ok) {
      completedRef.current = true;
      track('complete_journal_entry', {
        journal_type: 'freeform',
        has_title: Boolean(freeformTitle),
        entry_length_chars: freeformBody.length,
        duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
      });
    }
  }, [now, freeformTitle, freeformBody, save]);

  const handleGuidedSave = useCallback(async () => {
    const date = format(now, 'yyyy-MM-dd');
    const ok = await save({
      type: 'template',
      template_id: GUIDED_TEMPLATE_ID,
      date,
      fields: guidedAnswers,
    });
    if (ok) {
      completedRef.current = true;
      track('complete_journal_entry', {
        journal_type: 'template',
        template_id: GUIDED_TEMPLATE_ID,
        prompts_answered_count: Object.values(guidedAnswers).filter((v) => v.trim()).length,
        duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
      });
    }
  }, [now, guidedAnswers, save]);

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setGuidedAnswers((prev) => ({ ...prev, [String(index)]: value }));
  }, []);

  const slideClass = direction === 'right' ? '-translate-x-4' : 'translate-x-4';

  return (
    <div className="min-h-dvh bg-primary-bg">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-primary-bg px-6 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-content hover:bg-surface-secondary active:bg-surface-secondary"
        >
          <Icon icon="mdi:arrow-left" width={24} height={24} />
        </button>
        <SegmentedControl items={tabItems} value={activeTab} onChange={handleTabChange} size="lg" />
      </div>
      <div
        ref={scrollRef}
        className="px-6 pt-2"
        style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}
      >
        <div
          className={`transition-all duration-200 ease-out ${
            animating ? `opacity-0 ${slideClass}` : 'translate-x-0 opacity-100'
          }`}
        >
          {displayTab === 'guided' ? (
            <GuidedTab
              answers={guidedAnswers}
              onAnswerChange={handleAnswerChange}
              onSave={handleGuidedSave}
              saving={saving}
              now={now}
            />
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
                </div>
              }
            >
              <FreeformTab
                title={freeformTitle}
                body={freeformBody}
                onTitleChange={setFreeformTitle}
                onBodyChange={setFreeformBody}
                onSave={handleFreeformSave}
                saving={saving}
                userName={userName}
                now={now}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
