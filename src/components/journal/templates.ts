export interface TemplateConfig {
  title: string;
  questions: string[];
}

export const TEMPLATE_MAP: Record<string, TemplateConfig> = {
  '5-minute-morning': {
    title: '5-Minute Morning',
    questions: [
      'What are three things you are grateful for today?',
      'What is one main goal that would make today great?',
      'A daily affirmation for myself:',
    ],
  },
  'evening-wind-down': {
    title: 'Evening Wind Down',
    questions: [
      'What went well today?',
      'What is one thing I could improve tomorrow?',
      'What am I looking forward to?',
    ],
  },
  'anxiety-relief': {
    title: 'Anxiety Relief',
    questions: [
      'What am I feeling anxious about right now?',
      'What is within my control in this situation?',
      'What is one small step I can take right now?',
    ],
  },
  'daily-reflection': {
    title: 'Daily Reflection',
    questions: [
      'How am I feeling emotionally right now?',
      'What was the most meaningful moment today?',
      'What did I learn about myself today?',
    ],
  },
};

export function getTemplate(templateId: string | null | undefined): TemplateConfig {
  if (!templateId) return TEMPLATE_MAP['5-minute-morning'];
  return TEMPLATE_MAP[templateId] ?? TEMPLATE_MAP['5-minute-morning'];
}
