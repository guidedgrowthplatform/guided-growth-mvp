import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createJournalEntry } from '@/api/journal';
import { HabitReportCard } from '@/components/coach/HabitReportCard';
import { CheckInCard } from '@/components/home/CheckInCard';
import { ChatBubble } from '@/components/voice/ChatBubble';
import type { CheckinFlowController } from '@/hooks/useCheckinFlow';
import { useSessionLog } from '@/hooks/useSessionLog';
import { CHECKIN_SCRIPTS } from '@/lib/checkin/scriptLibrary';
import { formatDate } from '@/utils/dates';

const REFLECTION_TITLE: Record<'proud' | 'forgive' | 'grateful', string> = {
  proud: CHECKIN_SCRIPTS.reflection_proud[0],
  forgive: CHECKIN_SCRIPTS.reflection_forgive[0],
  grateful: CHECKIN_SCRIPTS.reflection_grateful[0],
};

interface Props {
  flow: CheckinFlowController;
  displayName?: string;
  onClose: () => void;
}

// Self-contained renderer for the scripted check-in ritual (text path). Kept
// separate from CoachChatView so the existing LLM-driven overlay is untouched
// when the flag is off. Reuses the existing cards + bubbles.
export function ScriptedCheckinView({ flow, displayName, onClose }: Props) {
  const { logEvent } = useSessionLog();
  const today = formatDate(new Date());
  const [answer, setAnswer] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);
  const completedRef = useRef(false);

  // Mark the bucket done once the ritual completes (path-independent signal,
  // mirrors the tap/voice paths).
  useEffect(() => {
    if (flow.terminal && !completedRef.current) {
      completedRef.current = true;
      logEvent(
        'checkin_completed',
        { type: flow.mode, via: 'scripted' },
        flow.mode === 'morning' ? 'MCHECK-01' : 'ECHECK-01',
      );
    }
  }, [flow.terminal, flow.mode, logEvent]);

  const submitReflection = async () => {
    const text = answer.trim();
    if (!text || !flow.reflectionPrompt) return;
    setSavingReflection(true);
    try {
      await createJournalEntry({
        type: 'freeform',
        title: REFLECTION_TITLE[flow.reflectionPrompt],
        date: today,
        fields: { body: text },
      });
      setAnswer('');
      flow.answerReflection();
    } finally {
      setSavingReflection(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <span className="text-sm font-semibold text-content">
          {flow.mode === 'morning' ? 'Morning check-in' : 'Evening check-in'}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 hover:bg-surface-secondary"
        >
          <X className="h-5 w-5 text-content-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {flow.messages.map((msg) => (
          <div key={msg.id} className="mb-1">
            <ChatBubble role="ai" text={msg.text} userName={displayName} />
            {msg.checkinCard && (
              <div className="mt-2 max-w-[360px]">
                <CheckInCard
                  selectedDate={msg.checkinCard.date}
                  embedded
                  onSaved={() => flow.reportProgress(0)}
                />
              </div>
            )}
            {msg.habitReport && <HabitReportCard onProgress={flow.reportProgress} />}
          </div>
        ))}
      </div>

      <div className="border-t border-border-light px-4 py-3">
        {flow.terminal ? (
          <button
            onClick={onClose}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        ) : flow.reflectionPrompt ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
              placeholder="Type your answer…"
              className="w-full resize-none rounded-xl border border-border-light bg-surface p-3 text-sm text-content"
            />
            <button
              onClick={submitReflection}
              disabled={savingReflection || answer.trim().length === 0}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingReflection ? 'Saving…' : 'Send'}
            </button>
          </div>
        ) : (
          <button
            onClick={flow.userDone}
            className="w-full rounded-full border border-border-light py-2.5 text-sm font-semibold text-content-secondary"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
