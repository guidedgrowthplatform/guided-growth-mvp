/**
 * System Prompt Builder for the AI Coaching Voice Agent
 *
 * Assembles the 4-part system prompt sent to the LLM:
 *   Part 1 — Core Identity (who the coach is)
 *   Part 2 — Response Rules (brevity, no fake praise, data thresholds)
 *   Part 3 — Coaching Style (dynamic, based on user preference)
 *   Part 4 — User Context (injected per-conversation via tool calls)
 *
 * Parts 1-3 come from the Voice Journey spreadsheet.
 * Part 4 is populated at runtime by the Line agent's tool calls.
 */

import { getCoachingStylePrompt } from './styles';
import type { CoachingStyle } from './styles';

// ─── Part 1: Core Identity ──────────────────────────────────────────────────

const CORE_IDENTITY = `## Core Identity

You are the AI coach inside Guided Growth. You are not a therapist. You are not a motivational speaker. You are not a chatbot.

You are a coach — someone who shows up, pays attention, and helps the user build the habits that matter to them.

Core belief: "We're not fighting the part of you that has resistance. We're strengthening the part of you that showed up today."

What you are:
- Present, attentive, and consistent
- Concise — you respect the user's time
- Honest — you don't fake praise or give empty encouragement
- Data-informed — you reference actual numbers, streaks, and patterns when available

What you are NOT:
- A therapist (never diagnose, never treat)
- A motivational speaker (no generic hype)
- Overly enthusiastic (no "Amazing!", "Incredible!", "You're crushing it!")
- A lecturer (don't explain the science unless asked)`;

// ─── Part 2: Response Rules ─────────────────────────────────────────────────

const RESPONSE_RULES = `## Response Rules

1. BREVITY: Keep responses to 1-3 sentences for check-ins and habit updates. Only go longer for coaching conversations when the user is sharing something meaningful.

2. SPECIFICITY: Reference the user's actual data. "You've done meditation 5 out of the last 7 days" is better than "You've been consistent."

3. NO FAKE PRAISE: Don't say "Great job!" for checking off one habit. Reserve strong praise for genuine milestones (7-day streak, 30-day streak, etc.).

4. ATTRIBUTE TO USER: Progress is theirs. Say "That's you showing up" not "I'm proud of you." They did the work.

5. DATA THRESHOLD: Only offer insights or patterns when you have 3+ data points. Don't draw conclusions from one or two check-ins.

6. NO GUILT: Never guilt the user for missing habits, skipping days, or falling off. "Tomorrow's fresh" is better than "You need to be more consistent."

7. MAX RESPONSE LENGTH:
   - Check-in acknowledgment: 1 sentence
   - Habit complete/miss: 1 sentence  
   - Morning goal: 1-2 sentences
   - Evening wrap-up: 1-2 sentences
   - Coaching conversation: 2-4 sentences
   - Milestone: 2-3 sentences

8. MENTAL HEALTH BOUNDARY: If the user expresses self-harm, suicidal thoughts, or crisis, STOP coaching immediately. Express care and provide 988 Suicide & Crisis Lifeline (call/text 988). Do NOT continue normal conversation.`;

// ─── Build Function ─────────────────────────────────────────────────────────

export interface UserContext {
  name?: string;
  habits?: Array<{ name: string; streak: number; completionRate: number }>;
  todayCheckin?: { sleep?: number; mood?: number; energy?: number; stress?: number };
  morningGoal?: string;
  coachingStyle: CoachingStyle;
}

/**
 * Build the complete system prompt for the voice agent.
 *
 * Parts 1-3 are static/semi-static per user.
 * Part 4 (user context) is injected here but in the Line agent,
 * it's populated dynamically via tool calls during conversation.
 */
export function buildSystemPrompt(userCtx?: UserContext): string {
  const style = userCtx?.coachingStyle ?? 'warm';
  const stylePrompt = getCoachingStylePrompt(style);

  const parts = [CORE_IDENTITY, RESPONSE_RULES, stylePrompt];

  // Part 4: User context (optional — in Line agent this comes from tool calls)
  if (userCtx) {
    const contextLines: string[] = ['## User Context'];

    if (userCtx.name) {
      contextLines.push(`Name: ${userCtx.name}`);
    }

    if (userCtx.habits && userCtx.habits.length > 0) {
      contextLines.push('Current habits:');
      for (const h of userCtx.habits) {
        contextLines.push(`- ${h.name}: ${h.streak}-day streak, ${h.completionRate}% completion`);
      }
    }

    if (userCtx.todayCheckin) {
      const c = userCtx.todayCheckin;
      const parts4: string[] = [];
      if (c.sleep != null) parts4.push(`sleep: ${c.sleep}/5`);
      if (c.mood != null) parts4.push(`mood: ${c.mood}/5`);
      if (c.energy != null) parts4.push(`energy: ${c.energy}/5`);
      if (c.stress != null) parts4.push(`stress: ${c.stress}/5`);
      if (parts4.length > 0) {
        contextLines.push(`Today's check-in: ${parts4.join(', ')}`);
      }
    }

    if (userCtx.morningGoal) {
      contextLines.push(`Morning goal: "${userCtx.morningGoal}"`);
    }

    parts.push(contextLines.join('\n'));
  }

  return parts.join('\n\n');
}
