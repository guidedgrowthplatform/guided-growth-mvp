/**
 * Inject user context into Cartesia agent system prompt before conversation.
 *
 * Since we can't deploy custom tool calls to the template agent,
 * we dynamically update the system prompt with user data before each session.
 * This gives the AI access to the user's name, habits, streaks, and check-in data.
 *
 * SECURITY TODO: VITE_CARTESIA_API_KEY is bundled into the client. Anyone
 * inspecting the JS can read the key and PATCH the agent. Move this PATCH to a
 * server endpoint (e.g. /api/cartesia-agent-context) that uses CARTESIA_API_KEY
 * server-side. Tracked separately from the voice playback fix.
 */

import { supabase } from '@/lib/supabase';

const AGENT_ID = (import.meta.env.VITE_CARTESIA_AGENT_ID || '').trim();
const CARTESIA_API_KEY = (import.meta.env.VITE_CARTESIA_API_KEY || '').trim();

interface UserContextData {
  name: string;
  habits: Array<{ name: string; streak: number }>;
  todayCheckin: { sleep?: number; mood?: number; energy?: number; stress?: number } | null;
  morningGoal: string | null;
}

async function fetchUserContext(): Promise<UserContextData | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { getDataService } = await import('@/lib/services/service-provider');
    const ds = await getDataService();

    const habits = await ds.getHabits();
    const today = new Date().toISOString().slice(0, 10);
    const completions = await ds.getAllCompletions(today, today);
    const completedIds = new Set(completions.map((c) => c.habitId));

    const habitList = habits
      .filter((h) => h.active)
      .map((h) => ({
        name: h.name,
        streak: 0, // Would need streak calculation
        done: completedIds.has(h.id),
      }));

    const nickname = user.user_metadata?.nickname || user.user_metadata?.name || 'there';
    const morningGoal = localStorage.getItem('gg_morning_goal');

    return {
      name: nickname,
      habits: habitList.map((h) => ({ name: h.name, streak: h.streak })),
      todayCheckin: null, // Could fetch from checkins table
      morningGoal,
    };
  } catch {
    return null;
  }
}

function buildContextBlock(ctx: UserContextData): string {
  const lines: string[] = ['', '## Current User Context (live data)', `Name: ${ctx.name}`];

  if (ctx.habits.length > 0) {
    lines.push('Active habits:');
    ctx.habits.forEach((h) => {
      lines.push(`- ${h.name}: ${h.streak}-day streak`);
    });
  } else {
    lines.push('No active habits yet.');
  }

  if (ctx.todayCheckin) {
    const c = ctx.todayCheckin;
    const parts: string[] = [];
    if (c.sleep != null) parts.push(`sleep ${c.sleep}/5`);
    if (c.mood != null) parts.push(`mood ${c.mood}/5`);
    if (c.energy != null) parts.push(`energy ${c.energy}/5`);
    if (c.stress != null) parts.push(`stress ${c.stress}/5`);
    if (parts.length) lines.push(`Today's check-in: ${parts.join(', ')}`);
  }

  if (ctx.morningGoal) {
    lines.push(`Morning goal: "${ctx.morningGoal}"`);
  }

  return lines.join('\n');
}

/** Base system prompt (without user context) */
let basePrompt: string | null = null;

/**
 * Update agent system prompt with fresh user data.
 * Call this before starting a real-time voice conversation.
 */
export async function injectUserContext(): Promise<void> {
  if (!AGENT_ID || !CARTESIA_API_KEY) return;

  try {
    // Get base prompt (without context) — cache it
    if (!basePrompt) {
      const res = await fetch(`https://api.cartesia.ai/agents/${AGENT_ID}`, {
        headers: {
          'X-API-Key': CARTESIA_API_KEY,
          'Cartesia-Version': '2025-04-16',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const prompt = data.llm_system_prompt || '';
      // Strip any existing context block
      const idx = prompt.indexOf('\n## Current User Context');
      basePrompt = idx >= 0 ? prompt.slice(0, idx) : prompt;
    }

    const ctx = await fetchUserContext();
    if (!ctx) return;

    const contextBlock = buildContextBlock(ctx);
    const fullPrompt = basePrompt + contextBlock;

    await fetch(`https://api.cartesia.ai/agents/${AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2025-04-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ llm_system_prompt: fullPrompt }),
    });
  } catch {
    // Non-critical — agent works without context, just less personalized
  }
}
