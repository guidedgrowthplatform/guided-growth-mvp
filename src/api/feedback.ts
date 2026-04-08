import { apiPost } from './client';

interface FeedbackPayload {
  sentiment: 'love' | 'ok' | 'needs-work';
  text: string;
}

export function submitFeedback(data: FeedbackPayload): Promise<{ id: string }> {
  return apiPost<{ id: string }>('/api/reflections/feedback', data);
}
