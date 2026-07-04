/**
 * weekly_advance handler — advances to the next beat of The Weekly session.
 *
 * Server-side this is an ACKNOWLEDGED NO-OP. Unlike onboarding's
 * navigate_next (which owns a hard current_step column on onboarding_states
 * and gates real screen advance server-side), The Weekly's beat sequencing
 * lives client-side in the flow-engine orchestrator (weekly-checkin-v1,
 * useFlowOrchestrator) — the same seam onboarding/check-in beats use for
 * client-visible advance. Wiring this tool's outcome into that client-side
 * advance happens at the live-surface seam (the session that mounts The
 * Weekly onto a real Vapi call + FlowRenderer), not here.
 *
 * This handler exists so the assistant always gets a clean `{ result: 'ok' }`
 * from the shared webhook dispatch (api/vapi/[...path].ts) — never an
 * unknown_tool error — for calls made before that wiring lands.
 *
 * Auth model: see ../../vapi/handlers/submitProfile.ts. Channel auth is
 * X-Vapi-Secret; identity arrives as `anon_id` injected by Vapi from static
 * call params. No anon_id validation here since this handler makes no writes.
 */
export type HandlerResult = { result: string } | { error: string };

export async function weeklyAdvance(_args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=weekly_advance (server no-op, ack only)');
  return { result: 'ok' };
}
