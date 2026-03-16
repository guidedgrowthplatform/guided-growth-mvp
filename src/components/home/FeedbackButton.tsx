import { MessageSquare } from 'lucide-react';

export function FeedbackButton() {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface px-4 py-2 shadow-sm">
      <MessageSquare className="h-4 w-4 text-primary" />
      <span className="text-xs font-bold tracking-wide text-primary">Give Feedback</span>
    </button>
  );
}
