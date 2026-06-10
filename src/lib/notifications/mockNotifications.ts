import type { AppNotification } from './types';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// Placeholder fixtures until the notifications backend lands.
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'streak-milestone-7',
    category: 'habit',
    icon: 'mdi:fire',
    iconClass: 'text-streak',
    iconBg: 'bg-[#eaf1fe]',
    title: 'Streak Milestone!',
    body: "You've maintained 'Early Morning Meditation' for 7 days.",
    createdAt: hoursAgo(2),
    unread: true,
    detail: {
      eyebrow: 'Milestone reached',
      heading: '7-Day Streak!',
      paragraphs: [
        'You have successfully maintained your Early Morning Meditation habit for 7 consecutive days. Your consistency is placing you in the top 5% of users this week.',
        'This achievement unlocks the "Consistent Mind" badge. Regularly practicing at the same time each day has strengthened your neural pathways, making the habit 40% more likely to stick permanently.',
      ],
      insight: {
        title: 'Growth Insight',
        body: 'To reach a 14-day streak, try "habit stacking." Perform your meditation immediately after your morning coffee to use an existing anchor.',
      },
      action: { label: 'Go to Habits', to: '/habits' },
    },
  },
  {
    id: 'goal-updated-hydration',
    category: 'habit',
    icon: 'mdi:trending-up',
    iconClass: 'text-primary',
    iconBg: 'bg-[#eaf1fe]',
    title: 'Goal Updated',
    body: "Your 'Daily Hydration' target was increased to 10 glasses based on activity.",
    createdAt: hoursAgo(5),
    unread: false,
    detail: {
      eyebrow: 'Goal updated',
      heading: 'Daily Hydration: 10 glasses',
      paragraphs: [
        "Based on your recent activity levels, your 'Daily Hydration' target was increased from 8 to 10 glasses per day.",
        'Staying hydrated supports focus and energy throughout your day. You can adjust this target anytime from the habit settings.',
      ],
      action: { label: 'Go to Habits', to: '/habits' },
    },
  },
  {
    id: 'reminder-afternoon-walk',
    category: 'habit',
    icon: 'mdi:map-marker-outline',
    iconClass: 'text-primary',
    iconBg: 'bg-[#eaf1fe]',
    title: 'Reminder',
    body: "It's time for your 'Afternoon Walk' session.",
    createdAt: hoursAgo(26),
    unread: false,
    detail: {
      eyebrow: 'Reminder',
      heading: 'Afternoon Walk',
      paragraphs: [
        "It's time for your 'Afternoon Walk' session. A short walk is a great way to reset your focus and get some movement into your day.",
      ],
      action: { label: 'Go to Habits', to: '/habits' },
    },
  },
  {
    id: 'feature-templating',
    category: 'habit',
    icon: 'mdi:star-four-points',
    iconClass: 'text-primary',
    iconBg: 'bg-[#eaf1fe]',
    image: '/logo.svg',
    title: 'New Feature Alert!',
    body: "We're pleased to introduce the latest enhancements in our templating experience.",
    createdAt: hoursAgo(14),
    unread: false,
    cta: { label: 'Try now', to: '/journal' },
    detail: {
      eyebrow: 'New feature',
      heading: 'A better templating experience',
      paragraphs: [
        "We're pleased to introduce the latest enhancements in our templating experience. Guided prompts are now easier to customize and reuse.",
      ],
      action: { label: 'Open Journal', to: '/journal' },
    },
  },
  {
    id: 'journal-evening-saved',
    category: 'journal',
    icon: 'mdi:notebook-outline',
    iconClass: 'text-primary',
    iconBg: 'bg-[#eaf1fe]',
    title: 'Reflection Saved',
    body: 'Your evening reflection was saved. Nice work showing up today.',
    createdAt: hoursAgo(10),
    unread: true,
    detail: {
      eyebrow: 'Journal',
      heading: 'Reflection Saved',
      paragraphs: [
        'Your evening reflection was saved. Nice work showing up today — small consistent entries add up to real self-awareness over time.',
      ],
      action: { label: 'View Reflections', to: '/reflections' },
    },
  },
  {
    id: 'journal-new-prompt',
    category: 'journal',
    icon: 'mdi:pencil-outline',
    iconClass: 'text-primary',
    iconBg: 'bg-[#eaf1fe]',
    title: 'New Prompt Ready',
    body: "A guided prompt is waiting for you: 'What are you grateful for today?'",
    createdAt: hoursAgo(30),
    unread: false,
    detail: {
      eyebrow: 'Journal',
      heading: 'New Prompt Ready',
      paragraphs: [
        "A guided prompt is waiting for you: 'What are you grateful for today?' Take two minutes to capture it while it's fresh.",
      ],
      action: { label: 'Open Journal', to: '/journal' },
    },
  },
];
