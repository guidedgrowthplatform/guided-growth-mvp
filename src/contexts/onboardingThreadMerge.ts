import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';

/**
 * Merge a server-hydrated onboarding thread with the live in-memory thread.
 *
 * The old rule replaced the live thread whenever the server set was LONGER,
 * which silently dropped live turns that had not mirrored yet (bubbles
 * disappearing mid-run, B6). The merge keeps both sides:
 *
 * - Server history provides the base order (it is the durable record).
 * - A live turn that shares an id with a server row wins when its text is at
 *   least as long (live turns grow in place under a stable client_turn_key, so
 *   the live copy is the freshest).
 * - Live turns the server does not know yet (not mirrored) append at the tail
 *   in their live order, so nothing on screen ever vanishes.
 *
 * Pure and unit-tested; the provider applies it inside setMessages.
 */
export function mergeThreadMessages(
  hydrated: VoiceMessage[],
  live: VoiceMessage[],
): VoiceMessage[] {
  if (hydrated.length === 0) return live;
  if (live.length === 0) return hydrated;
  const liveById = new Map(live.map((m) => [m.id, m]));
  const merged = hydrated.map((m) => {
    const liveCopy = liveById.get(m.id);
    return liveCopy && (liveCopy.text?.length ?? 0) >= (m.text?.length ?? 0) ? liveCopy : m;
  });
  const hydratedIds = new Set(hydrated.map((m) => m.id));
  for (const m of live) {
    if (!hydratedIds.has(m.id)) merged.push(m);
  }
  return merged;
}
